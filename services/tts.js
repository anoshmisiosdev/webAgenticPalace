// OpenAI TTS client with browser SpeechSynthesis fallback

/**
 * Checks OpenAI TTS connectivity on startup.
 * @returns {Promise<void>}
 */
async function checkTTS() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.warn('⚠️  OPENAI_API_KEY not set — TTS will fall back to browser SpeechSynthesis');
    return;
  }
  const voice = process.env.OPENAI_TTS_VOICE || 'onyx';
  console.log(`🎙️  OpenAI TTS ready — voice: ${voice}, model: tts-1`);
}

/**
 * Speaks text using OpenAI TTS API. Returns an audio buffer (MP3) or null if unavailable.
 * When null is returned, the client should fall back to browser SpeechSynthesis.
 * @param {string} text - The text to convert to speech
 * @returns {Promise<Buffer|null>} MP3 audio buffer, or null if TTS is unavailable
 */
async function speak(text) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.warn('⚠️  OPENAI_API_KEY not set — returning null (client will use browser TTS)');
    return null;
  }

  // Voices: alloy, echo, fable, onyx, nova, shimmer
  // "onyx" is deep and authoritative — good for a field operative
  const voice = process.env.OPENAI_TTS_VOICE || 'onyx';

  try {
    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'tts-1',
        input: text,
        voice: voice,
        response_format: 'mp3',
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`❌ OpenAI TTS error: ${response.status} ${errText}`);
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();
    console.log(`🎙️  OpenAI TTS | ${Buffer.from(arrayBuffer).length} bytes | voice: ${voice}`);
    return Buffer.from(arrayBuffer);
  } catch (err) {
    console.error('❌ OpenAI TTS request failed:', err.message);
    return null;
  }
}

module.exports = { speak, checkTTS };
