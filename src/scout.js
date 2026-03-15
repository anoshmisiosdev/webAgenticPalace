import {
  createSystem,
  PanelUI,
  PanelDocument,
  eq,
} from '@iwsdk/core';

import { Waypoint, createWaypointMesh } from './waypoint.js';

// -- Cyberpunk Rooftop world description for Scout context --
const WORLD_DESCRIPTION =
  'Futuristic cyberpunk rooftop at night. Rain-slicked concrete surface reflecting neon signs from surrounding megastructures. Ventilation units, satellite dishes, and server cooling towers scattered across surface. Two access stairwells visible on north and south ends. Low concrete barriers provide partial cover.';

const WORLD_SCALE = 4;
const API_BASE = '/api';

export class ScoutSystem extends createSystem({
  hudPanel: {
    required: [PanelUI, PanelDocument],
    where: [eq(PanelUI, 'config', './ui/scout-hud.json')],
  },
}) {
  init() {
    this.isRunning = false;
    this.waypointEntities = [];
    this.doc = null;
    this.alwaysListening = false;
    this.recognition = null;

    // Wire up HTML DOM buttons immediately
    this._wireHtmlButtons();

    // When IWSDK HUD panel loads, wire up VR panel buttons too
    this.queries.hudPanel.subscribe('qualify', (entity) => {
      const doc = PanelDocument.data.document[entity.index];
      if (!doc) return;
      this.doc = doc;

      const scoutBtn = doc.getElementById('scout-btn');
      const voiceBtn = doc.getElementById('voice-btn');

      if (scoutBtn) scoutBtn.addEventListener('click', () => this.runMission());
      if (voiceBtn) voiceBtn.addEventListener('click', () => this.listenForMission());

      this.setStatus('Cyberpunk Rooftop - Ready');
      this.startAlwaysListening();
      setTimeout(() => this.runMission(), 1500);
    });
  }

  _wireHtmlButtons() {
    const scoutBtn = document.getElementById('btn-scout');
    const voiceBtn = document.getElementById('btn-voice');
    const missionInput = document.getElementById('mission-input');

    if (scoutBtn) scoutBtn.addEventListener('click', () => this.runMission());
    if (voiceBtn) {
      voiceBtn.addEventListener('click', () => {
        this.playBeep(880, 0.15);
        this.setStatus('Listening...');
        voiceBtn.classList.add('listening');
        this.listenForMission();
      });
    }
    if (missionInput) {
      missionInput.addEventListener('keydown', (e) => {
        if (e.code === 'Enter') this.runMission();
      });
    }

    // Hide world switcher row in HTML (locked to cyberpunk)
    const worldRow = document.getElementById('world-row');
    if (worldRow) worldRow.style.display = 'none';
  }

  // ---- Dual UI updates: HTML DOM + IWSDK panel ----

  setStatus(text) {
    const el = document.getElementById('status-text');
    if (el) el.textContent = text;
    if (this.doc) {
      const pEl = this.doc.getElementById('status-text');
      if (pEl) pEl.setProperties({ text });
    }
  }

  setThreat(level) {
    const badge = document.getElementById('threat-badge');
    if (badge) {
      const colors = { low: '#00ff88', medium: '#ff8800', high: '#ff3333' };
      badge.textContent = 'THREAT: ' + (level || 'UNKNOWN').toUpperCase();
      badge.style.color = colors[level] || '#aaa';
      badge.style.borderColor = colors[level] || '#aaa';
      badge.style.background = (colors[level] || '#333') + '22';
    }
    if (this.doc) {
      const pEl = this.doc.getElementById('threat-badge');
      if (pEl) pEl.setProperties({ text: 'THREAT: ' + (level || 'UNKNOWN').toUpperCase() });
    }
  }

  setNarration(text) {
    const box = document.getElementById('narration-box');
    const nEl = document.getElementById('narration-text');
    if (nEl) nEl.textContent = text;
    if (box) box.style.display = 'block';
    if (this.doc) {
      const pEl = this.doc.getElementById('narration-text');
      if (pEl) pEl.setProperties({ text });
    }
  }

  showLoading(show) {
    const el = document.getElementById('loading');
    if (el) el.style.display = show ? 'block' : 'none';
  }

  getMissionText() {
    const htmlInput = document.getElementById('mission-input');
    if (htmlInput && htmlInput.value && htmlInput.value.trim()) {
      return htmlInput.value.trim();
    }
    if (this.doc) {
      const el = this.doc.getElementById('mission-input');
      if (el) return el.value || el.text || 'scout for entry points and defensive positions';
    }
    return 'scout for entry points and defensive positions';
  }

  updateWaypointList(waypoints) {
    // HTML DOM
    const list = document.getElementById('waypoint-list');
    if (list) {
      list.innerHTML = '';
      waypoints.forEach((wp) => {
        const item = document.createElement('div');
        item.className = 'wp-item ' + wp.priority;
        item.innerHTML =
          '<div class="wp-label">' + wp.label + '</div>' +
          '<div class="wp-note">' + wp.note + '</div>';
        list.appendChild(item);
      });
      list.style.display = waypoints.length > 0 ? 'block' : 'none';
    }
    // IWSDK panel
    if (this.doc) {
      const pList = this.doc.getElementById('wp-list');
      if (pList) {
        const text = waypoints
          .map((wp) => `[${wp.priority.toUpperCase()}] ${wp.label}: ${wp.note}`)
          .join('\n');
        pList.setProperties({ text: text || 'No waypoints yet' });
      }
    }
  }

  // ---- Waypoint management ----

  clearWaypoints() {
    for (const entity of this.waypointEntities) {
      entity.dispose();
    }
    this.waypointEntities = [];
    this.updateWaypointList([]);
  }

  placeWaypoints(waypoints) {
    this.clearWaypoints();

    waypoints.forEach((wp, i) => {
      const mesh = createWaypointMesh(wp.priority);
      mesh.position.set(wp.x * WORLD_SCALE, 1.6, wp.z * WORLD_SCALE);
      mesh.scale.setScalar(0);

      const entity = this.world
        .createTransformEntity(mesh)
        .addComponent(Waypoint, {
          priority: wp.priority,
          label: wp.label,
          note: wp.note || '',
          pulsePhase: i * 1.2,
          baseY: 1.6,
          animProgress: 0,
          spawning: true,
        });

      this.waypointEntities.push(entity);
      console.log(`[${wp.priority.toUpperCase()}] ${wp.label} -> (${wp.x}, ${wp.z})`);
    });

    this.updateWaypointList(waypoints);
  }

  // ---- Scout Mission ----

  async runMission() {
    if (this.isRunning) return;
    this.isRunning = true;

    const mission = this.getMissionText();

    this.setStatus('Scout is thinking...');
    this.setNarration('Analyzing environment...');
    this.showLoading(true);
    const scoutBtn = document.getElementById('btn-scout');
    if (scoutBtn) scoutBtn.disabled = true;

    try {
      const res = await fetch(API_BASE + '/scout-mission', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
        },
        body: JSON.stringify({
          world_description: WORLD_DESCRIPTION,
          user_mission: mission,
        }),
      });

      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();

      this.placeWaypoints(data.waypoints);
      this.setThreat(data.threat_level);
      this.setNarration(data.narration);
      this.setStatus('Cyberpunk Rooftop - ' + data.waypoints.length + ' targets marked');
      await this.speakText(data.narration);
    } catch (err) {
      console.error('Scout mission error:', err);
      this.setStatus('Scout offline - using fallback');
      this.placeWaypoints([
        { id: 'n', label: 'North Stairwell', x: 0, z: -0.7, y: 0, priority: 'high', note: 'Primary access point' },
        { id: 'e', label: 'East Antenna Array', x: 0.7, z: 0, y: 0, priority: 'medium', note: 'Elevated position' },
        { id: 'w', label: 'West Barrier', x: -0.7, z: 0, y: 0, priority: 'low', note: 'Partial cover zone' },
      ]);
    } finally {
      this.isRunning = false;
      this.showLoading(false);
      if (scoutBtn) scoutBtn.disabled = false;
    }
  }

  // ---- TTS ----

  async speakText(text) {
    try {
      const res = await fetch(API_BASE + '/speak', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
        },
        body: JSON.stringify({ text }),
      });
      if (res.status === 204 || !res.ok) { this.browserSpeak(text); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onended = () => URL.revokeObjectURL(url);
      await audio.play();
    } catch (e) {
      this.browserSpeak(text);
    }
  }

  browserSpeak(text) {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.92;
    u.pitch = 0.85;
    u.volume = 1.0;
    const voices = window.speechSynthesis.getVoices();
    const preferred =
      voices.find((v) =>
        v.name.includes('Google UK English Male') ||
        v.name.includes('Daniel') ||
        v.name.includes('Alex'),
      ) || voices.find((v) => v.lang.startsWith('en'));
    if (preferred) u.voice = preferred;
    window.speechSynthesis.speak(u);
  }

  // ---- Voice input (always-listening with "Scout" wake word) ----

  startAlwaysListening() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    this.recognition = new SpeechRecognition();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = 'en-US';
    this.alwaysListening = true;

    this.recognition.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const transcript = e.results[i][0].transcript.trim().toLowerCase();

        if (!e.results[i].isFinal) {
          if (transcript.indexOf('scout') !== -1) {
            const voiceBtn = document.getElementById('btn-voice');
            if (voiceBtn) voiceBtn.classList.add('listening');
          }
          continue;
        }

        console.log('Heard:', transcript);

        const scoutIdx = transcript.indexOf('scout');
        if (scoutIdx !== -1) {
          let mission = transcript.substring(scoutIdx + 5).trim();
          mission = mission.replace(/^[,.\s]+/, '');

          if (mission.length > 2) {
            this.playBeep(880, 0.15);
            const htmlInput = document.getElementById('mission-input');
            if (htmlInput) htmlInput.value = mission;
            if (this.doc) {
              const input = this.doc.getElementById('mission-input');
              if (input) input.setProperties({ value: mission });
            }
            this.setStatus('Wake word detected: "' + mission + '"');
            const voiceBtn = document.getElementById('btn-voice');
            if (voiceBtn) voiceBtn.classList.remove('listening');
            this.runMission();
          } else {
            this.playBeep(880, 0.15);
            this.setStatus('Scout activated - speak your mission...');
            const voiceBtn = document.getElementById('btn-voice');
            if (voiceBtn) voiceBtn.classList.add('listening');
            this.listenForMission();
          }
          return;
        }
      }
    };

    this.recognition.onerror = (e) => {
      if (e.error === 'no-speech' || e.error === 'aborted') return;
      console.warn('Voice error:', e.error);
    };

    this.recognition.onend = () => {
      if (this.alwaysListening) {
        try { this.recognition.start(); } catch (e) {
          setTimeout(() => { try { this.recognition.start(); } catch (e2) {} }, 100);
        }
      }
    };

    try { this.recognition.start(); } catch (e) {}
    console.log('Always-listening mode active - say "Scout" to activate');
  }

  listenForMission() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    this.alwaysListening = false;
    try { this.recognition.stop(); } catch (e) {}

    const missionRec = new SpeechRecognition();
    missionRec.continuous = false;
    missionRec.interimResults = false;
    missionRec.lang = 'en-US';

    missionRec.onresult = (e) => {
      const transcript = e.results[0][0].transcript;
      const htmlInput = document.getElementById('mission-input');
      if (htmlInput) htmlInput.value = transcript;
      if (this.doc) {
        const input = this.doc.getElementById('mission-input');
        if (input) input.setProperties({ value: transcript });
      }
      const voiceBtn = document.getElementById('btn-voice');
      if (voiceBtn) voiceBtn.classList.remove('listening');
      this.playBeep(440, 0.1);
      this.runMission();
      this.alwaysListening = true;
      this.startAlwaysListening();
    };

    missionRec.onerror = () => {
      const voiceBtn = document.getElementById('btn-voice');
      if (voiceBtn) voiceBtn.classList.remove('listening');
      this.setStatus('Voice error - type your mission instead');
      this.alwaysListening = true;
      this.startAlwaysListening();
    };

    missionRec.onend = () => {
      const voiceBtn = document.getElementById('btn-voice');
      if (voiceBtn) voiceBtn.classList.remove('listening');
      if (!this.alwaysListening) {
        this.alwaysListening = true;
        this.startAlwaysListening();
      }
    };

    missionRec.start();
  }

  playBeep(freq, duration) {
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
    } catch (e) {}
  }
}
