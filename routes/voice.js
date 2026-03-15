// POST /api/speak — TTS endpoint, returns audio/mpeg or 204 for browser fallback
const express = require('express');
const router = express.Router();
const { speak } = require('../services/tts');

/**
 * POST /api/speak
 * Body: { text: string }
 * Returns: audio/mpeg blob (200) OR 204 No Content (client falls back to SpeechSynthesis)
 */
router.post('/speak', async (req, res) => {
  const { text } = req.body;

  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'Missing "text" field in request body' });
  }

  try {
    const audioBuffer = await speak(text);

    if (!audioBuffer) {
      // No TTS available — client should use browser SpeechSynthesis
      return res.status(204).send();
    }

    res.set({
      'Content-Type': 'audio/mpeg',
      'Content-Length': audioBuffer.length,
    });
    res.send(audioBuffer);
  } catch (err) {
    console.error('❌ Error in /api/speak:', err);
    res.status(500).json({ error: 'TTS generation failed' });
  }
});

module.exports = router;
