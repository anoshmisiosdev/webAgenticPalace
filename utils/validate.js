// Validates Scout mission JSON responses against the waypoint schema

const VALID_PRIORITIES = ['high', 'medium', 'low'];
const VALID_THREAT_LEVELS = ['low', 'medium', 'high'];

/**
 * Validates a single waypoint object.
 * @param {object} wp - A waypoint object
 * @param {number} index - Index for error messages
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateWaypoint(wp, index) {
  const errors = [];
  if (!wp.id || typeof wp.id !== 'string') {
    errors.push(`waypoint[${index}]: missing or invalid "id"`);
  }
  if (!wp.label || typeof wp.label !== 'string') {
    errors.push(`waypoint[${index}]: missing or invalid "label"`);
  }
  if (typeof wp.x !== 'number' || wp.x < -1 || wp.x > 1) {
    errors.push(`waypoint[${index}]: "x" must be a number between -1 and 1`);
  }
  if (typeof wp.z !== 'number' || wp.z < -1 || wp.z > 1) {
    errors.push(`waypoint[${index}]: "z" must be a number between -1 and 1`);
  }
  if (typeof wp.y !== 'number') {
    errors.push(`waypoint[${index}]: "y" must be a number`);
  }
  if (!VALID_PRIORITIES.includes(wp.priority)) {
    errors.push(`waypoint[${index}]: "priority" must be one of: ${VALID_PRIORITIES.join(', ')}`);
  }
  if (!wp.note || typeof wp.note !== 'string') {
    errors.push(`waypoint[${index}]: missing or invalid "note"`);
  }
  return { valid: errors.length === 0, errors };
}

/**
 * Validates the full Scout mission response JSON.
 * @param {object} json - The parsed JSON response from Claude
 * @returns {{ valid: boolean, errors: string[], data: object|null }}
 */
function validateMissionResponse(json) {
  const errors = [];

  if (!json || typeof json !== 'object') {
    return { valid: false, errors: ['Response is not a valid object'], data: null };
  }

  if (!json.narration || typeof json.narration !== 'string') {
    errors.push('Missing or invalid "narration"');
  }

  if (!Array.isArray(json.waypoints) || json.waypoints.length === 0) {
    errors.push('Missing or empty "waypoints" array');
  } else {
    json.waypoints.forEach((wp, i) => {
      const result = validateWaypoint(wp, i);
      errors.push(...result.errors);
    });
  }

  if (!json.summary || typeof json.summary !== 'string') {
    errors.push('Missing or invalid "summary"');
  }

  if (!VALID_THREAT_LEVELS.includes(json.threat_level)) {
    errors.push(`"threat_level" must be one of: ${VALID_THREAT_LEVELS.join(', ')}`);
  }

  return {
    valid: errors.length === 0,
    errors,
    data: errors.length === 0 ? json : null,
  };
}

/**
 * Returns a safe fallback mission response for when all else fails.
 * @returns {object} A valid Scout mission response with recon waypoints at centre
 */
function getFallbackResponse() {
  return {
    narration: "Comms degraded — running blind recon from origin point. Scanning immediate perimeter for points of interest. Recommend manual sweep until sensor feed stabilises.",
    waypoints: [
      { id: "wp1", label: "Origin — Rally Point", x: 0.0, z: 0.0, y: 0.0, priority: "high", note: "Centre of scene. Regroup here." },
      { id: "wp2", label: "North Scan", x: 0.0, z: -0.5, y: 0.0, priority: "medium", note: "Northern perimeter check." },
      { id: "wp3", label: "East Scan", x: 0.5, z: 0.0, y: 0.0, priority: "medium", note: "Eastern perimeter check." },
    ],
    summary: "Sensor feed unavailable — fallback recon pattern deployed from origin.",
    threat_level: "low",
  };
}

module.exports = { validateMissionResponse, getFallbackResponse };
