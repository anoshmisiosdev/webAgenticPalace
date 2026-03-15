// Voice loop controller: Wake Word (Porcupine) → STT → Scout Agent → TTS reply
// Runs entirely client-side except for the Scout API call and optional server TTS

/**
 * VoiceLoop — hands-free voice interaction for VR
 *
 * Flow:
 *   1. Porcupine listens for wake word ("Hey Scout" / "Scout")
 *   2. On detection → beep + start STT recording
 *   3. User speaks their mission
 *   4. STT transcript → POST /api/scout-mission
 *   5. Agent response narration → TTS playback
 *   6. Return to wake word listening
 */
class VoiceLoop {
  /**
   * @param {object} options
   * @param {string} options.serverUrl - Base URL of Scout server (e.g. http://10.104.2.175:3000)
   * @param {string} options.worldDescription - Current world description for agent context
   * @param {string} [options.picovoiceAccessKey] - Picovoice access key (optional, falls back to always-listen)
   * @param {string} [options.wakeWord] - Wake word keyword (default: "hey scout" or "computer")
   * @param {function} [options.onStateChange] - Callback when state changes: 'idle' | 'listening' | 'processing' | 'speaking'
   * @param {function} [options.onTranscript] - Callback with STT transcript text
   * @param {function} [options.onResponse] - Callback with full Scout agent response
   * @param {function} [options.onError] - Callback on error
   */
  constructor(options = {}) {
    this.serverUrl = options.serverUrl || '';
    this.worldDescription = options.worldDescription || 'Unknown environment';
    this.picovoiceAccessKey = options.picovoiceAccessKey || null;
    this.wakeWord = options.wakeWord || 'hey scout';
    this.onStateChange = options.onStateChange || (() => {});
    this.onTranscript = options.onTranscript || (() => {});
    this.onResponse = options.onResponse || (() => {});
    this.onError = options.onError || ((e) => console.error('VoiceLoop error:', e));

    this.state = 'idle'; // idle | listening | processing | speaking
    this.recognition = null;
    this.porcupine = null;
    this.usePorcupine = false;
    this.isRunning = false;
  }

  /**
   * Starts the voice loop. Attempts Porcupine wake word, falls back to push-to-talk / always-listen.
   */
  async start() {
    if (this.isRunning) return;
    this.isRunning = true;

    // Try to init Porcupine wake word
    if (this.picovoiceAccessKey) {
      try {
        await this._initPorcupine();
        this.usePorcupine = true;
        console.log('🎤 Porcupine wake word active — say "' + this.wakeWord + '" to begin');
      } catch (err) {
        console.warn('⚠️ Porcupine init failed, using manual trigger:', err.message);
        this.usePorcupine = false;
      }
    }

    if (!this.usePorcupine) {
      console.log('🎤 Voice loop ready — call voiceLoop.listen() to activate STT');
    }

    this._setState('idle');
  }

  /**
   * Stops the voice loop entirely.
   */
  stop() {
    this.isRunning = false;
    if (this.recognition) {
      this.recognition.abort();
      this.recognition = null;
    }
    if (this.porcupine) {
      this.porcupine.release();
      this.porcupine = null;
    }
    this._setState('idle');
  }

  /**
   * Manually trigger listening (for push-to-talk or when wake word is not available).
   */
  listen() {
    if (this.state !== 'idle') return;
    this._playBeep(880, 0.15);
    this._startSTT();
  }

  /**
   * Update the world description (e.g. when a new world loads).
   * @param {string} desc
   */
  setWorldDescription(desc) {
    this.worldDescription = desc;
  }

  // ── Porcupine Wake Word ──────────────────────────────────────

  async _initPorcupine() {
    // Dynamic import — Porcupine Web SDK must be installed or loaded via CDN
    if (typeof window.PorcupineWorker === 'undefined') {
      // Try loading from CDN
      await this._loadScript('https://unpkg.com/@picovoice/porcupine-web@latest/dist/porcupine_worker.js');
    }

    const { PorcupineWorker } = window;
    if (!PorcupineWorker) throw new Error('PorcupineWorker not available');

    this.porcupine = await PorcupineWorker.create(
      this.picovoiceAccessKey,
      { builtin: this.wakeWord },
      (detection) => {
        if (detection.index >= 0) {
          console.log('🔊 Wake word detected!');
          this._onWakeWord();
        }
      }
    );
  }

  _onWakeWord() {
    if (this.state !== 'idle') return;
    this._playBeep(880, 0.15);
    setTimeout(() => this._startSTT(), 200);
  }

  // ── Speech-to-Text (Web Speech API) ──────────────────────────

  _startSTT() {
    this._setState('listening');

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      this.onError('SpeechRecognition API not available in this browser');
      this._setState('idle');
      return;
    }

    this.recognition = new SpeechRecognition();
    this.recognition.lang = 'en-US';
    this.recognition.interimResults = false;
    this.recognition.maxAlternatives = 1;
    this.recognition.continuous = false;

    this.recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      console.log('📝 Transcript:', transcript);
      this.onTranscript(transcript);
      this._playBeep(440, 0.1);
      this._sendMission(transcript);
    };

    this.recognition.onerror = (event) => {
      console.warn('STT error:', event.error);
      if (event.error === 'no-speech') {
        // No speech detected — go back to idle
        this._setState('idle');
      } else {
        this.onError('STT error: ' + event.error);
        this._setState('idle');
      }
    };

    this.recognition.onend = () => {
      // If we're still in listening state, it ended without result
      if (this.state === 'listening') {
        this._setState('idle');
      }
    };

    this.recognition.start();
  }

  // ── Scout Agent Call ─────────────────────────────────────────

  async _sendMission(mission) {
    this._setState('processing');

    try {
      const res = await fetch(this.serverUrl + '/api/scout-mission', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          world_description: this.worldDescription,
          user_mission: mission,
        }),
      });

      const data = await res.json();
      console.log('🛰️ Scout response:', data);
      this.onResponse(data);

      // Speak the narration
      if (data.narration) {
        await this._speak(data.narration);
      }
    } catch (err) {
      console.error('❌ Mission request failed:', err);
      this.onError('Mission request failed: ' + err.message);
    }

    this._setState('idle');
  }

  // ── Text-to-Speech ───────────────────────────────────────────

  async _speak(text) {
    this._setState('speaking');

    // Try server TTS first (ElevenLabs)
    try {
      const res = await fetch(this.serverUrl + '/api/speak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });

      if (res.status === 200 && res.headers.get('content-type')?.includes('audio')) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        await this._playAudio(url);
        URL.revokeObjectURL(url);
        return;
      }
    } catch (err) {
      console.warn('Server TTS failed, using browser fallback:', err.message);
    }

    // Fallback: browser SpeechSynthesis
    await this._browserTTS(text);
  }

  /**
   * Plays an audio URL and resolves when done.
   * @param {string} url
   * @returns {Promise<void>}
   */
  _playAudio(url) {
    return new Promise((resolve, reject) => {
      const audio = new Audio(url);
      audio.onended = resolve;
      audio.onerror = reject;
      audio.play().catch(reject);
    });
  }

  /**
   * Browser SpeechSynthesis fallback TTS.
   * @param {string} text
   * @returns {Promise<void>}
   */
  _browserTTS(text) {
    return new Promise((resolve) => {
      if (!window.speechSynthesis) {
        console.warn('No SpeechSynthesis available');
        resolve();
        return;
      }

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 0.9;
      utterance.volume = 1.0;

      // Try to pick a good voice
      const voices = speechSynthesis.getVoices();
      const preferred = voices.find(v => v.name.includes('Google') && v.lang === 'en-US')
        || voices.find(v => v.lang === 'en-US')
        || voices[0];
      if (preferred) utterance.voice = preferred;

      utterance.onend = resolve;
      utterance.onerror = () => resolve();
      speechSynthesis.speak(utterance);
    });
  }

  // ── Utilities ────────────────────────────────────────────────

  _setState(state) {
    this.state = state;
    this.onStateChange(state);
  }

  /**
   * Plays a short beep tone.
   * @param {number} freq - Frequency in Hz
   * @param {number} duration - Duration in seconds
   */
  _playBeep(freq, duration) {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      gain.gain.value = 0.3;
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch (e) {
      // Audio context not available — ignore
    }
  }

  /**
   * Dynamically loads a script.
   * @param {string} src
   * @returns {Promise<void>}
   */
  _loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }
}

// Export for module or global use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = VoiceLoop;
} else {
  window.VoiceLoop = VoiceLoop;
}
