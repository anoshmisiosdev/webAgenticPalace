// Anthropic Claude client — handles Scout mission calls with retry, fallback, and caching
const Anthropic = require('@anthropic-ai/sdk');
const SCOUT_SYSTEM_PROMPT = require('../prompts/system');
const { validateMissionResponse, getFallbackResponse } = require('../utils/validate');
const { DEMO_WORLDS } = require('../cache/demoCache');

let client = null;

/** @type {Map<string, object>} In-memory response cache */
const responseCache = new Map();

/**
 * Generates a cache key from world description and mission.
 * @param {string} worldDesc - World description
 * @param {string} mission - Mission text
 * @returns {string} Cache key
 */
function cacheKey(worldDesc, mission) {
  const w = worldDesc.substring(0, 40).toLowerCase().replace(/\s/g, '');
  const m = mission.substring(0, 30).toLowerCase().replace(/\s/g, '');
  return `${w}|${m}`;
}

/**
 * Lazily initialises the Anthropic client.
 * @returns {Anthropic|null}
 */
function getClient() {
  if (client) return client;
  if (!process.env.CLAUDE_API_KEY) {
    console.error('❌ CLAUDE_API_KEY not set — Scout missions will use fallback responses');
    return null;
  }
  client = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY });
  return client;
}

/**
 * Calls Claude with the Scout system prompt and returns the raw text response.
 * @param {string} userMessage - The combined WORLD + MISSION message
 * @param {boolean} [retryHint=false] - If true, appends a JSON-only reminder
 * @returns {Promise<string>} Raw text from Claude
 */
async function callClaude(userMessage, retryHint = false) {
  const anthropic = getClient();
  if (!anthropic) return null;

  const message = retryHint
    ? userMessage + '\n\nIMPORTANT: Return ONLY raw valid JSON. No markdown fences, no explanation, no preamble.'
    : userMessage;

  const start = Date.now();
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: SCOUT_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: message }],
  });
  const latency = Date.now() - start;
  const usage = response.usage || {};
  console.log(`🧠 Claude API | ${latency}ms | in:${usage.input_tokens || '?'} out:${usage.output_tokens || '?'} | ${new Date().toISOString()}`);

  let text = response.content[0].text;
  // Strip markdown fences if Claude wraps the JSON
  text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  return text;
}

/**
 * Runs a Scout mission: checks cache first, then calls Claude with retry and fallback.
 * @param {string} worldDescription - The LLM-readable world description
 * @param {string} mission - The user's spoken mission objective
 * @returns {Promise<object>} A valid Scout mission response (narration, waypoints, summary, threat_level)
 */
async function scoutMission(worldDescription, mission) {
  const key = cacheKey(worldDescription, mission);

  // Check cache
  if (responseCache.has(key)) {
    console.log(`⚡ CACHE HIT | ${key}`);
    return responseCache.get(key);
  }

  const userMessage = `WORLD:\n${worldDescription}\n\nMISSION:\n${mission}`;

  // First attempt
  try {
    const raw = await callClaude(userMessage);
    if (!raw) return getFallbackResponse();

    const parsed = JSON.parse(raw);
    const result = validateMissionResponse(parsed);
    if (result.valid) {
      responseCache.set(key, result.data);
      const latency = 'LIVE RESPONSE';
      console.log(`📦 ${latency} cached as: ${key}`);
      return result.data;
    }

    console.warn('⚠️  Validation errors on first attempt:', result.errors);
  } catch (err) {
    console.warn('⚠️  First Claude attempt failed:', err.message);
  }

  // Retry with JSON hint
  try {
    console.log('🔄 Retrying Claude call with JSON reminder...');
    const raw = await callClaude(userMessage, true);
    if (!raw) return getFallbackResponse();

    const parsed = JSON.parse(raw);
    const result = validateMissionResponse(parsed);
    if (result.valid) {
      responseCache.set(key, result.data);
      console.log(`📦 LIVE RESPONSE (retry) cached as: ${key}`);
      return result.data;
    }

    console.warn('⚠️  Validation errors on retry:', result.errors);
  } catch (err) {
    console.warn('⚠️  Retry Claude attempt failed:', err.message);
  }

  // Fallback
  console.warn('🔻 Both Claude attempts failed — returning fallback response');
  return getFallbackResponse();
}

/**
 * Primes the response cache with all demo world + mission combinations.
 * Runs 9 total Claude calls (3 worlds x 3 missions). Call without awaiting.
 * @returns {Promise<{ primed: number }>}
 */
async function primeDemoCache() {
  const worldNames = Object.keys(DEMO_WORLDS);
  let count = 0;
  const total = worldNames.length * 3;

  for (const worldName of worldNames) {
    const world = DEMO_WORLDS[worldName];
    for (const mission of world.missions) {
      count++;
      console.log(`🔥 Priming cache: ${worldName} [${count}/${total}]...`);
      await scoutMission(world.description, mission);
    }
  }

  console.log(`✅ Cache priming complete: ${count} responses ready`);
  return { primed: count };
}

module.exports = { scoutMission, primeDemoCache, responseCache };
