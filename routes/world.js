// POST /api/generate-world — triggers Marble world generation or returns fallback
const express = require('express');
const router = express.Router();
const { generateWorld } = require('../services/marble');

/** @type {Map<string, string>} Remote splat URL cache for proxying */
const remoteWorlds = new Map();

/**
 * POST /api/generate-world
 * Body: { prompt: string }
 * Returns: { splat_url: string, world_description: string }
 */
router.post('/generate-world', async (req, res) => {
  const { prompt } = req.body;

  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'Missing "prompt" field in request body' });
  }

  try {
    const result = await generateWorld(prompt);

    // If splat_url is a remote URL (from Marble API),
    // proxy it through our server so PICO can access it
    // (avoids CORS and mixed content issues with direct URLs)
    if (result.splat_url && result.splat_url.startsWith('http')) {
      const worldId = Date.now().toString();
      remoteWorlds.set(worldId, result.splat_url);
      result.splat_url = `/api/world-proxy/${worldId}`;
    }

    res.json(result);
  } catch (err) {
    console.error('\u274C Error in /api/generate-world:', err);
    // Always return something usable
    res.json({
      splat_url: '/worlds/space_station.spz',
      world_description: 'Space station interior with dark corridors and emergency lighting.'
    });
  }
});

/**
 * GET /api/world-proxy/:id
 * Proxies a remote splat file through this server
 */
router.get('/world-proxy/:id', async (req, res) => {
  const url = remoteWorlds.get(req.params.id);
  if (!url) {
    return res.status(404).json({ error: 'World not found' });
  }

  try {
    const upstream = await fetch(url);
    if (!upstream.ok) {
      return res.status(502).json({ error: `Upstream returned ${upstream.status}` });
    }
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Access-Control-Allow-Origin', '*');
    upstream.body.pipe(res);
  } catch (err) {
    res.status(502).json({ error: 'Failed to fetch world' });
  }
});

module.exports = router;
