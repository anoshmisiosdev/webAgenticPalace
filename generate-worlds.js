require('dotenv').config();
const fs = require('fs');
const path = require('path');

const API_KEY = process.env.WORLDLABS_API_KEY;
const BASE = 'https://api.worldlabs.ai';

const WORLDS = [
  {
    filename: 'space_station.spz',
    imagePath: './images/space_station.jpg',
    prompt: 'Abandoned space station interior, dark metal corridors with exposed pipes and conduit, emergency blue lighting casting dramatic shadows, large central hub with four branching corridors, debris scattered on metal grating floor, structural damage on eastern wall, control panels dark and inoperative, sci-fi atmosphere'
  },
  {
    filename: 'jungle_temple.spz',
    imagePath: './images/jungle_temple.jpg',
    prompt: 'Ancient jungle temple ruins at dusk, moss-covered stone walls with carved reliefs, partially collapsed archways, central courtyard surrounded by four crumbling stone towers, thick vines and roots covering surfaces, golden orange light filtering through dense jungle canopy, stone pathways overgrown with vegetation, mysterious atmospheric lighting'
  },
  {
    filename: 'cyberpunk_rooftop.spz',
    imagePath: './images/cyberpunk_rooftop.jpg',
    prompt: 'Futuristic cyberpunk rooftop at night, rain-slicked concrete surface, ventilation units and satellite dishes scattered across roof, two access stairwells visible north and south, concrete barriers providing cover, neon pink and cyan reflections in puddles, city skyline 40 floors below, light rain falling, atmospheric fog, Tokyo aesthetic'
  }
];

// Auth header per World Labs docs: WLT-Api-Key
function getHeaders() {
  return {
    'WLT-Api-Key': API_KEY,
    'Content-Type': 'application/json'
  };
}

function imageToBase64(imagePath) {
  const resolved = path.resolve(__dirname, imagePath);
  if (!imagePath || !fs.existsSync(resolved)) return null;
  const buffer = fs.readFileSync(resolved);
  return buffer.toString('base64');
}

// Upload a local image via media-assets API, returns media_asset_id
async function uploadImage(imagePath) {
  const resolved = path.resolve(__dirname, imagePath);
  const buffer = fs.readFileSync(resolved);
  const ext = path.extname(imagePath).toLowerCase();
  const contentType = ext === '.png' ? 'image/png' : 'image/jpeg';

  // Step 1: Prepare upload
  console.log(`  Preparing upload for ${imagePath}...`);
  const prepRes = await fetch(`${BASE}/marble/v1/media-assets:prepare_upload`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ content_type: contentType, file_name: path.basename(imagePath), kind: 'image' })
  });

  if (!prepRes.ok) {
    const text = await prepRes.text();
    console.warn(`  Upload prepare failed ${prepRes.status}: ${text}`);
    return null;
  }

  const prepData = await prepRes.json();
  console.log('  Upload prepared:', JSON.stringify(prepData, null, 2));
  const uploadUrl = prepData.upload_info?.upload_url || prepData.upload_url || prepData.signed_url || prepData.url;
  const mediaAssetId = prepData.media_asset?.media_asset_id || prepData.media_asset_id || prepData.id;
  const requiredHeaders = prepData.upload_info?.required_headers || {};

  if (!uploadUrl) {
    console.warn('  No upload URL in prepare response');
    return null;
  }

  // Step 2: PUT the file
  console.log(`  Uploading ${(buffer.length / 1024 / 1024).toFixed(1)} MB...`);
  const putRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType, ...requiredHeaders },
    body: buffer
  });

  if (!putRes.ok) {
    console.warn(`  Upload PUT failed ${putRes.status}`);
    return null;
  }

  console.log(`  Upload complete: media_asset_id=${mediaAssetId}`);
  return mediaAssetId;
}

async function createWorld(world) {
  const hasImage = fs.existsSync(path.resolve(__dirname, world.imagePath));

  let worldPrompt;

  if (hasImage) {
    console.log(`  Image found: ${world.imagePath}, attempting upload...`);
    const mediaAssetId = await uploadImage(world.imagePath);

    if (mediaAssetId) {
      worldPrompt = {
        type: 'image',
        text_prompt: world.prompt,
        image_prompt: {
          source: 'media_asset',
          media_asset_id: mediaAssetId
        }
      };
    } else {
      console.log('  Image upload failed, using text-only');
      worldPrompt = {
        type: 'text',
        text_prompt: world.prompt
      };
    }
  } else {
    console.log(`  No image at ${world.imagePath}, using text only`);
    worldPrompt = {
      type: 'text',
      text_prompt: world.prompt
    };
  }

  const body = {
    display_name: world.filename.replace('.spz', ''),
    world_prompt: worldPrompt,
    model: 'Marble 0.1-mini'
  };

  console.log(`  Creating: "${world.prompt.substring(0, 50)}..."`);

  const res = await fetch(`${BASE}/marble/v1/worlds:generate`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const text = await res.text();
    // If image format rejected, retry text-only
    if (worldPrompt.type === 'image' && (res.status === 400 || res.status === 422)) {
      console.warn(`  Image rejected (${res.status}), retrying text-only...`);
      body.world_prompt = { type: 'text', text_prompt: world.prompt };
      const res2 = await fetch(`${BASE}/marble/v1/worlds:generate`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(body)
      });
      if (!res2.ok) throw new Error(`Create failed: ${await res2.text()}`);
      const data2 = await res2.json();
      console.log('  Create response:', JSON.stringify(data2, null, 2));
      return data2.operation_id || data2.id;
    }
    throw new Error(`Create failed ${res.status}: ${text}`);
  }

  const data = await res.json();
  console.log('  Create response:', JSON.stringify(data, null, 2));
  return data.operation_id || data.id;
}

async function pollOperation(operationId) {
  console.log(`  Polling operation: ${operationId}`);
  const MAX_ATTEMPTS = 60;
  const INTERVAL = 10000; // 10s — generation takes 30-45s for mini, ~5min for plus

  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    await new Promise(r => setTimeout(r, INTERVAL));

    const res = await fetch(`${BASE}/marble/v1/operations/${operationId}`, {
      headers: getHeaders()
    });

    if (!res.ok) {
      console.warn(`  Poll ${i + 1}: HTTP ${res.status}`);
      continue;
    }

    const data = await res.json();
    const status = data.metadata?.progress?.status || data.status || 'UNKNOWN';
    const done = data.done || false;
    console.log(`  Poll ${i + 1}/${MAX_ATTEMPTS}: done=${done} status=${status}`);

    // Log full response on first poll and when done
    if (i === 0 || done) console.log('  Response:', JSON.stringify(data, null, 2));

    if (done) {
      return data.response || data;
    }

    if (status === 'FAILED' || status === 'ERROR') {
      throw new Error(`Generation failed: ${JSON.stringify(data)}`);
    }
  }
  throw new Error('Timed out after 10 minutes');
}

function extractDownloadUrl(data) {
  // Per docs: assets.splats.spz_urls.full_res / 500k / 100k
  const candidates = [
    data.assets?.splats?.spz_urls?.full_res,
    data.assets?.splats?.spz_urls?.['500k'],
    data.assets?.splats?.spz_urls?.['100k'],
    data.assets?.splat_url,
    data.assets?.splat,
    data.splat_url,
    data.output_url,
    data.download_url,
    data.url,
  ];

  const url = candidates.find(c => c && typeof c === 'string' && c.startsWith('http'));
  if (!url) {
    console.error('Could not find download URL in response:');
    console.error(JSON.stringify(data, null, 2));
    throw new Error('No download URL found in API response');
  }
  return url;
}

async function downloadSplat(url, filename) {
  console.log(`  Downloading: ${url.substring(0, 80)}...`);

  // SPZ URLs are typically pre-signed, try without auth first
  let res = await fetch(url);

  if (!res.ok) {
    console.log(`  Unauthenticated got ${res.status}, trying with WLT-Api-Key...`);
    res = await fetch(url, { headers: { 'WLT-Api-Key': API_KEY } });
    if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  }

  const buffer = await res.arrayBuffer();
  const outPath = path.join(__dirname, 'public', 'worlds', filename);
  fs.writeFileSync(outPath, Buffer.from(buffer));
  console.log(`  Saved: ${outPath} (${(buffer.byteLength / 1024 / 1024).toFixed(1)} MB)`);
}

async function generateAll() {
  if (!API_KEY) {
    console.error('ERROR: No WORLDLABS_API_KEY in .env');
    process.exit(1);
  }

  const worldsDir = path.join(__dirname, 'public', 'worlds');
  if (!fs.existsSync(worldsDir)) fs.mkdirSync(worldsDir, { recursive: true });

  console.log(`\nGenerating ${WORLDS.length} worlds...`);
  console.log(`API Key: ${API_KEY.substring(0, 8)}...`);
  console.log(`Endpoint: POST ${BASE}/marble/v1/worlds:generate`);
  console.log(`Auth: WLT-Api-Key header`);
  console.log(`Model: Marble 0.1-mini\n`);

  // Step 1: Create jobs sequentially (avoid rate limits)
  console.log('=== Step 1: Creating world generation jobs ===\n');
  const jobs = [];
  for (const world of WORLDS) {
    try {
      const operationId = await createWorld(world);
      console.log(`  Job created: ${world.filename} -> operation ${operationId}\n`);
      jobs.push({ ...world, operationId });
    } catch (err) {
      console.error(`  FAILED to create ${world.filename}: ${err.message}\n`);
      jobs.push({ ...world, operationId: null, error: err.message });
    }
    await new Promise(r => setTimeout(r, 2000));
  }

  const validJobs = jobs.filter(j => j.operationId);
  if (validJobs.length === 0) {
    console.error('\nAll world creation requests failed.');
    process.exit(1);
  }

  // Step 2: Poll all jobs simultaneously
  console.log('\n=== Step 2: Waiting for world generation ===\n');
  const results = await Promise.all(
    validJobs.map(async (job) => {
      try {
        console.log(`Polling ${job.filename}...`);
        const result = await pollOperation(job.operationId);
        console.log(`  ${job.filename}: DONE\n`);
        return { ...job, result };
      } catch (err) {
        console.error(`  ${job.filename}: FAILED - ${err.message}\n`);
        return { ...job, result: null, error: err.message };
      }
    })
  );

  const completedJobs = results.filter(r => r.result);
  if (completedJobs.length === 0) {
    console.error('\nAll world generation jobs failed.');
    process.exit(1);
  }

  // Step 3: Download
  console.log('\n=== Step 3: Downloading .spz files ===\n');
  for (const job of completedJobs) {
    try {
      const url = extractDownloadUrl(job.result);
      await downloadSplat(url, job.filename);
    } catch (err) {
      console.error(`  FAILED to download ${job.filename}: ${err.message}`);
    }
  }

  // Summary
  console.log('\n=== Done ===\n');
  const files = fs.readdirSync(worldsDir).filter(f => f.endsWith('.spz'));
  if (files.length > 0) {
    console.log('Files in public/worlds/:');
    files.forEach(f => {
      const size = fs.statSync(path.join(worldsDir, f)).size;
      console.log(`  ${f}: ${(size / 1024 / 1024).toFixed(1)} MB`);
    });
    console.log(`\n${files.length}/${WORLDS.length} worlds ready.`);
  } else {
    console.log('No .spz files were downloaded. Check the logs above.');
  }
}

generateAll().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
