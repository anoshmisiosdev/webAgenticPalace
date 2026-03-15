// POST /api/scout-mission — the main Scout agent endpoint
const express = require('express');
const router = express.Router();
const { scoutMission } = require('../services/claude');

/**
 * POST /api/scout-mission
 * Body: { world_description: string, user_mission: string }
 * Returns: { narration, waypoints, summary, threat_level }
 * NEVER returns non-200 — always returns valid waypoint JSON even if degraded.
 */
router.post('/scout-mission', async (req, res) => {
  const { world_description, user_mission } = req.body;

  if (!world_description || !user_mission) {
    // Even on bad input, return 200 with a fallback so the voice loop never hangs
    const { getFallbackResponse } = require('../utils/validate');
    console.warn('⚠️  /api/scout-mission called with missing fields');
    return res.json(getFallbackResponse());
  }

  try {
    const result = await scoutMission(world_description, user_mission);
    res.json(result);
  } catch (err) {
    console.error('❌ Unexpected error in /api/scout-mission:', err);
    const { getFallbackResponse } = require('../utils/validate');
    res.json(getFallbackResponse());
  }
});

module.exports = router;
