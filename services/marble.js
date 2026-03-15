// services/marble.js
// World Labs Marble API client — correct API per docs.worldlabs.ai/api
// Auth: WLT-Api-Key header
// Generate: POST /marble/v1/worlds:generate
// Poll: GET /marble/v1/operations/{operation_id}
// Download: response.assets.splats.spz_urls.full_res

const BASE = 'https://api.worldlabs.ai';

function getHeaders(apiKey) {
  return {
    'WLT-Api-Key': apiKey,
    'Content-Type': 'application/json'
  };
}

// Pre-loaded world descriptions for fallback
const PRELOADED = {
  space: {
    keywords: ['space', 'station', 'sci-fi', 'scifi'],
    splat_url: '/worlds/space_station.spz',
    world_description: 'Abandoned space station interior. Dark corridors with exposed pipes and conduit running along walls and ceiling. Emergency blue lighting casts harsh shadows across metal grating floor. Large central hub with four branching corridors heading north, south, east, and west. Debris and broken equipment scattered throughout. Structural damage visible on eastern wall with breach. Control panels line the walls, most dark and inoperative. Zero gravity warning signs throughout.'
  },
  jungle: {
    keywords: ['jungle', 'temple', 'ruins', 'ancient'],
    splat_url: '/worlds/jungle_temple.spz',
    world_description: 'Dense jungle temple ruins at dusk. Ancient moss-covered stone walls with carved relief panels, partially collapsed archways frame key passages. Central courtyard surrounded by four crumbling stone towers at cardinal compass points. Thick vines and roots cover most surfaces. Low orange-purple light filters through dense jungle canopy above. Stone pathways overgrown with ferns and vegetation. Large ceremonial altar at centre, cracked and weathered. Multiple cave-like tunnel entrances visible in temple walls at ground level.'
  },
  cyber: {
    keywords: ['cyber', 'rooftop', 'neon', 'tokyo', 'futuristic'],
    splat_url: '/worlds/cyberpunk_rooftop.spz',
    world_description: 'Futuristic cyberpunk rooftop at night. Rain-slicked concrete surface reflecting neon signs from surrounding megastructures. Ventilation units, satellite dishes, and server cooling towers clustered across surface. Two access stairwells on north and south ends. Low concrete barriers and HVAC units provide partial cover positions. Holographic advertisement billboards on surrounding buildings. City skyline 40 floors below in all directions. Puddles reflecting pink and cyan neon light. Light rain falling continuously.'
  }
};

function checkPreloaded(prompt) {
  const lower = prompt.toLowerCase();
  for (const [key, world] of Object.entries(PRELOADED)) {
    if (world.keywords.some(kw => lower.includes(kw))) {
      console.log(`\u{1F5FA}\uFE0F  Using pre-loaded world: ${key}`);
      return world;
    }
  }
  return null;
}

async function pollForCompletion(operationId, apiKey) {
  const MAX_ATTEMPTS = 60;
  const INTERVAL = 10000;

  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    await new Promise(r => setTimeout(r, INTERVAL));

    const res = await fetch(`${BASE}/marble/v1/operations/${operationId}`, {
      headers: getHeaders(apiKey)
    });

    if (!res.ok) {
      console.warn(`Poll attempt ${i+1}: HTTP ${res.status}`);
      continue;
    }

    const data = await res.json();
    const status = data.metadata?.progress?.status || data.status || 'UNKNOWN';
    const done = data.done || false;
    console.log(`\u{1F30D} Poll ${i+1}/${MAX_ATTEMPTS}: done=${done} status=${status}`);

    if (done) {
      return data.response || data;
    }
    if (status === 'FAILED' || status === 'ERROR') {
      throw new Error(`World generation failed: ${data.error || 'unknown'}`);
    }
  }
  throw new Error('World generation timed out');
}

async function generateWorld(prompt) {
  const preloaded = checkPreloaded(prompt);
  if (preloaded) return preloaded;

  const apiKey = process.env.WORLDLABS_API_KEY;
  if (!apiKey) {
    console.warn('\u26A0\uFE0F  No WORLDLABS_API_KEY -- returning generic fallback');
    return { splat_url: '/worlds/space_station.spz', world_description: PRELOADED.space.world_description };
  }

  console.log(`\u{1F30D} Generating world: "${prompt.substring(0, 50)}..."`);

  const createRes = await fetch(`${BASE}/marble/v1/worlds:generate`, {
    method: 'POST',
    headers: getHeaders(apiKey),
    body: JSON.stringify({
      display_name: prompt.substring(0, 30),
      world_prompt: { type: 'text', text_prompt: prompt },
      model: 'Marble 0.1-mini'
    })
  });

  if (!createRes.ok) {
    const errText = await createRes.text();
    console.error(`Marble API error ${createRes.status}:`, errText);
    return PRELOADED.space;
  }

  const created = await createRes.json();
  const operationId = created.operation_id || created.id;

  if (!operationId) {
    console.error('No operation ID in response:', created);
    return PRELOADED.space;
  }

  console.log(`\u2705 World job created: operation ${operationId}`);

  const completed = await pollForCompletion(operationId, apiKey);

  const splatUrl =
    completed.assets?.splats?.spz_urls?.full_res ||
    completed.assets?.splats?.spz_urls?.['500k'] ||
    completed.assets?.splats?.spz_urls?.['100k'] ||
    completed.splat_url ||
    completed.output_url ||
    '/worlds/space_station.spz';

  const { buildWorldDescriptor } = require('../utils/worldDescriptor');
  const world_description = buildWorldDescriptor(prompt, {
    source: 'marble_api',
    world_id: operationId
  });

  console.log(`\u{1F389} World ready: ${splatUrl}`);
  return { splat_url: splatUrl, world_description };
}

module.exports = { generateWorld };
