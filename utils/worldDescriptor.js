// Converts a Marble prompt + metadata into an LLM-readable world description string

/**
 * Keyword lists for lightweight inference from the Marble prompt.
 */
const ENV_KEYWORDS = {
  'industrial': 'abandoned industrial space',
  'factory': 'abandoned factory floor',
  'warehouse': 'industrial warehouse',
  'space': 'orbital space environment',
  'station': 'space station interior',
  'jungle': 'dense jungle environment',
  'temple': 'ancient temple complex',
  'forest': 'forested wilderness',
  'city': 'urban cityscape',
  'cyberpunk': 'cyberpunk urban environment',
  'rooftop': 'elevated rooftop platform',
  'cave': 'subterranean cave system',
  'underwater': 'underwater environment',
  'desert': 'arid desert landscape',
  'ruins': 'ancient ruins',
  'lab': 'research laboratory',
  'bunker': 'underground bunker',
  'office': 'office interior',
  'hospital': 'medical facility',
  'ship': 'vessel interior',
};

const STYLE_KEYWORDS = {
  'dark': 'dark, low-key lighting',
  'neon': 'neon-lit, high contrast',
  'cyberpunk': 'cyberpunk aesthetic, neon and grime',
  'sci-fi': 'science fiction, futuristic',
  'fantasy': 'fantasy, mystical',
  'realistic': 'photorealistic',
  'abstract': 'abstract, stylised',
  'horror': 'dark, unsettling atmosphere',
  'bright': 'bright, well-lit',
  'foggy': 'foggy, low visibility',
  'overgrown': 'overgrown, nature reclaiming',
};

const LIGHTING_KEYWORDS = {
  'dark': 'Low ambient light, deep shadows',
  'neon': 'Neon accent lighting, artificial glow',
  'bright': 'Bright, even illumination',
  'sunset': 'Warm sunset lighting, long shadows',
  'foggy': 'Diffuse, scattered light through fog',
  'moonlit': 'Cool moonlight, high contrast shadows',
  'fire': 'Warm flickering firelight',
  'fluorescent': 'Harsh fluorescent overhead lighting',
};

/**
 * Matches keywords from a dictionary against the prompt string.
 * @param {string} prompt - The Marble generation prompt
 * @param {object} keywords - A keyword-to-description map
 * @returns {string[]} Matched descriptions
 */
function matchKeywords(prompt, keywords) {
  const lower = prompt.toLowerCase();
  return Object.entries(keywords)
    .filter(([key]) => lower.includes(key))
    .map(([, desc]) => desc);
}

/**
 * Builds a rich LLM-readable world description from a Marble prompt and optional metadata.
 * Uses lightweight keyword analysis — no LLM call needed.
 * @param {string} marblePrompt - The text prompt used to generate the world
 * @param {object} [metadata={}] - Optional extra metadata (e.g. { scale, tags })
 * @returns {string} Structured world description for the Scout system prompt
 */
function buildWorldDescriptor(marblePrompt, metadata = {}) {
  const envMatches = matchKeywords(marblePrompt, ENV_KEYWORDS);
  const styleMatches = matchKeywords(marblePrompt, STYLE_KEYWORDS);
  const lightMatches = matchKeywords(marblePrompt, LIGHTING_KEYWORDS);

  const envType = envMatches.length > 0 ? envMatches.join(', ') : 'unknown interior environment';
  const style = styleMatches.length > 0 ? styleMatches.join(', ') : 'realistic, detailed';
  const lighting = lightMatches.length > 0 ? lightMatches.join('; ') : 'Standard ambient lighting';
  const scale = metadata.scale || 'room-sized to large interior';
  const notable = metadata.tags ? metadata.tags.join(', ') : extractNotableElements(marblePrompt);

  return [
    `ENVIRONMENT TYPE: ${envType}`,
    `VISUAL STYLE: ${style}`,
    `KEY ARCHITECTURAL FEATURES: ${extractArchFeatures(marblePrompt)}`,
    `APPROXIMATE SCALE: ${scale}`,
    `LIGHTING: ${lighting}`,
    `NOTABLE ELEMENTS: ${notable}`,
    `SPATIAL ORIENTATION: Standard XR coordinate system, user starts at origin facing -Z`,
    `GENERATION PROMPT: "${marblePrompt}"`,
  ].join('\n');
}

/**
 * Extracts architectural feature hints from a prompt.
 * @param {string} prompt
 * @returns {string}
 */
function extractArchFeatures(prompt) {
  const archWords = ['wall', 'door', 'window', 'corridor', 'hall', 'stair', 'column', 'pillar',
    'bridge', 'platform', 'ceiling', 'floor', 'roof', 'arch', 'tunnel', 'passage',
    'balcony', 'tower', 'dome', 'gate', 'ramp', 'ledge'];
  const lower = prompt.toLowerCase();
  const found = archWords.filter((w) => lower.includes(w));
  return found.length > 0 ? found.join(', ') : 'Infer from visual scene — no explicit features in prompt';
}

/**
 * Extracts notable elements (objects, features) mentioned in the prompt.
 * @param {string} prompt
 * @returns {string}
 */
function extractNotableElements(prompt) {
  const objectWords = ['vehicle', 'car', 'tree', 'water', 'fire', 'debris', 'crate', 'barrel',
    'computer', 'screen', 'chair', 'table', 'statue', 'crystal', 'rock',
    'plant', 'light', 'sign', 'weapon', 'container', 'pipe', 'vent'];
  const lower = prompt.toLowerCase();
  const found = objectWords.filter((w) => lower.includes(w));
  return found.length > 0 ? found.join(', ') : 'No specific objects identified — infer from scene';
}

module.exports = { buildWorldDescriptor };
