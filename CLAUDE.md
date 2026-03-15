# CLAUDE.md — AI Assistant Context for Scout

> This file tells Claude Code exactly what we are building,
> what is done, what is left, and how to help.
> Read this entire file before touching any code.

---

## What We Are Building

**Scout** is a voice-controlled AI spatial intelligence agent
that lives inside AI-generated 3D worlds on a PICO XR headset.

The user stands inside a Marble-generated Gaussian splat world,
speaks a mission brief, and Scout's AI agent reasons about the
3D space, narrates what it finds in a field operative voice,
and places glowing 3D waypoint pins at points of interest
directly inside the world around the user.

**One sentence:** World models generate the space. Scout makes it operational.

---

## Hackathon Context

- Event: Worlds in Action Hack — San Francisco, March 14-15 2026
- Venue: Founders Inc, Fort Mason
- Track: **Best Agentic Mission Control with PICO**
- Secondary track: Best World Models Implementation with PICO
- Deadline: **Sunday March 15, 1:00 PM — submit by 12:45 PM**
- Current time: 8:00 AM Sunday March 15
- Time remaining: ~4 hours

---

## Project Structure

```
scout/
├── CLAUDE.md                 ← you are here
├── SCOUT.md                  ← full master plan
├── .env                      ← API keys (never commit)
├── .env.example              ← template
├── .gitignore
├── package.json
├── server.js                 ← Express entry point
├── routes/
│   ├── agent.js              ← POST /api/scout-mission ✅ DONE
│   ├── world.js              ← POST /api/generate-world ✅ DONE
│   └── voice.js              ← POST /api/speak ✅ DONE
├── services/
│   ├── claude.js             ← Anthropic client + cache ✅ DONE
│   ├── marble.js             ← World Labs API ✅ DONE
│   └── tts.js                ← OpenAI TTS ✅ DONE
├── prompts/
│   └── system.js             ← Scout system prompt ✅ DONE
├── utils/
│   ├── validate.js           ← JSON schema validator ✅ DONE
│   └── worldDescriptor.js    ← World context builder ✅ DONE
├── cache/
│   └── demoCache.js          ← Pre-cached responses ✅ DONE
└── public/
    ├── index.html            ← WebXR frontend ✅ DONE
    ├── worlds/               ← .spz Marble splat files
    │   ├── space_station.spz ← NEEDED
    │   ├── jungle_temple.spz ← NEEDED
    │   └── cyberpunk_rooftop.spz ← NEEDED
    └── js/
        └── voice-loop.js     ← Advanced voice (not integrated yet)
```

---

## What Is DONE and Working

### Backend — 100% Complete
- Express server running on port 3000
- `POST /api/scout-mission` — calls Claude, returns waypoints JSON
- `POST /api/speak` — OpenAI TTS voice, falls back to 204
- `POST /api/generate-world` — Marble API with pre-loaded fallback
- `GET /api/health` — confirms all API keys loaded
- `GET /api/cache-status` — shows primed cache state
- Claude response cache — 9 pre-computed responses for 3 demo worlds
- Cache primes automatically on server startup
- Retry logic on Claude JSON parse failure
- Hardcoded fallback if all else fails — never returns error to frontend
- ngrok tunnel live at: https://uneffected-maile-refringent.ngrok-free.dev

### Frontend — Built, Needs Marble Worlds
- Single file: `public/index.html`
- Three.js scene with WebXR support
- Procedural placeholder worlds (space station, jungle temple, cyberpunk)
- 3D waypoint pins with pulse animation — red/orange/green by priority
- HUD: status bar, narration panel, waypoint list, threat badge
- Mission input with voice button
- World switcher buttons (3 worlds)
- WASD + mouse look on desktop
- VRButton for PICO WebXR
- Auto-fires Scout mission 1.5s after load for demo effect
- Graceful fallback: splat fails → placeholder, TTS fails → browser speech

---

## What Is NOT Done (Do These In Order)

### 1. Marble .spz world files — CRITICAL
The `/public/worlds/` folder is empty.
Without real worlds the frontend shows placeholder geometry.

**How to fix:**
Go to marble.worldlabs.ai → generate 3 worlds → export as .spz
→ save to public/worlds/ as:
- space_station.spz
- jungle_temple.spz
- cyberpunk_rooftop.spz

OR use the API (key is in .env as WORLDLABS_API_KEY).

### 2. End-to-end test on PICO browser — NEEDED
Open PICO browser → navigate to ngrok URL
→ allow mic → allow WebXR → Enter XR → test Scout

### 3. Demo video recording — NEEDED
60-second headset POV showing:
world loads → Scout auto-fires → pins appear → narration plays
→ switch world → Scout again → different pins

### 4. Devpost submission — CRITICAL DEADLINE
Must submit by 12:45 PM at devpost.com
Fields needed: name, description, video, tech stack, team members

### 5. Judge pitch preparation
2-minute script — see SCOUT.md Section 8

---

## API Keys In .env

```
WORLDLABS_API_KEY=     ← World Labs Marble API
CLAUDE_API_KEY=        ← Anthropic Claude API
OPENAI_API_KEY=        ← OpenAI TTS (voice: onyx)
PORT=3000
NODE_ENV=development
```

**Never log these. Never commit .env. Never hardcode them.**

---

## Backend API Contract

### POST /api/scout-mission
```json
Request:
{
  "world_description": "string — describe the 3D environment",
  "user_mission": "string — what to scout for"
}

Response (always 200, never errors):
{
  "narration": "2-4 sentences, field operative tone, first person",
  "waypoints": [
    {
      "id": "wp1",
      "label": "North Entry Point",
      "x": 0.3,
      "z": -0.8,
      "y": 0.0,
      "priority": "high",
      "note": "Collapsed doorframe, primary access route"
    }
  ],
  "summary": "one sentence tactical assessment",
  "threat_level": "low | medium | high"
}
```

x and z are normalised: -1.0 to 1.0, relative to scene centre.
WORLD_SCALE = 4 in frontend (multiply coords by 4 for Three.js units).
priority must be exactly: "high", "medium", or "low"
threat_level must be exactly: "low", "medium", or "high"

### POST /api/speak
```json
Request: { "text": "string to speak" }
Response: audio/mpeg blob OR 204 No Content
```
Frontend uses browser SpeechSynthesis on 204.

### POST /api/generate-world
```json
Request: { "prompt": "world description prompt" }
Response: {
  "splat_url": "/worlds/space_station.spz or remote URL",
  "world_description": "detailed text description for Scout context"
}
```

### GET /api/health
```json
Response: {
  "status": "ok",
  "apis": { "claude": true, "marble": true, "elevenlabs": false }
}
```

---

## Claude System Prompt (in prompts/system.js)

Scout acts as a tactical spatial intelligence agent.
Always returns ONLY valid JSON — no preamble, no markdown fences.
Waypoints have x/z normalised -1 to 1.
Narration sounds like a field operative — never a chatbot.
2-4 waypoints per mission. Quality over quantity.
Fallback: if mission is vague, run a general recon sweep.

---

## ngrok URL

Current tunnel: https://uneffected-maile-refringent.ngrok-free.dev

**Do not restart ngrok unless it dies.**
If it dies, run: npx ngrok http 3000
Send new URL to anyone testing.

PICO connects to this URL — it must stay alive through the demo.

---

## Demo Worlds and Descriptions

### Space Station
World file: /worlds/space_station.spz
Description for Scout context:
"Abandoned space station interior. Dark corridors with exposed
pipes and conduit. Emergency blue lighting. Central hub with
four corridors heading north, south, east, west. Debris on
metal grating floor. Structural damage on eastern wall."

### Jungle Temple
World file: /worlds/jungle_temple.spz
Description for Scout context:
"Dense jungle temple ruins at dusk. Moss-covered stone walls,
collapsed archways. Central courtyard with four crumbling towers
at compass points. Thick vines everywhere. Multiple cave-like
tunnel entrances in temple walls at ground level."

### Cyberpunk Rooftop
World file: /worlds/cyberpunk_rooftop.spz
Description for Scout context:
"Futuristic cyberpunk rooftop at night. Rain-slicked concrete,
neon reflections. Ventilation units, satellite dishes scattered
across surface. Two stairwell access points north and south.
Concrete barriers provide partial cover."

---

## Known Issues From Audit

| Issue | Severity | Status |
|-------|----------|--------|
| .spz files missing from /public/worlds/ | CRITICAL | Fix now |
| SparkJS CDN uses @latest tag | Medium | Pin version |
| addWaypointToList uses innerHTML | Low | Safe (own backend) |
| multer in package.json unused | Low | Remove |
| .env.example stale (ELEVENLABS vs OPENAI) | Medium | Update |
| voice-loop.js not integrated | Medium | Skip for now |
| Marble API endpoint unverified for novel prompts | Medium | Pre-loaded covers demo |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| AI Agent | Anthropic Claude API (claude-sonnet-4-6) |
| World Generation | World Labs Marble API (.spz Gaussian splats) |
| XR Rendering | Three.js + WebXR + SparkJS (Gaussian splats) |
| Voice Input | Web Speech API (browser-native) |
| Voice Output | OpenAI TTS (onyx voice) + browser fallback |
| Backend | Node.js + Express |
| Tunnel | ngrok (LAN bypass for hackathon WiFi) |
| Headset | PICO 4 (WebXR browser) |

---

## How To Run

```bash
# Start backend
npm run dev

# Server starts at:
http://localhost:3000

# Frontend at:
http://localhost:3000  (serves public/index.html)

# PICO connects to:
https://uneffected-maile-refringent.ngrok-free.dev

# Health check:
curl http://localhost:3000/api/health
```

---

## Time Budget (8AM - 12PM)

```
8:00 - 8:30  Get Marble .spz files into /public/worlds/
8:30 - 9:00  Test full loop: world loads, Scout fires, pins appear
9:00 - 9:30  Test on PICO browser via ngrok
9:30 - 10:00 Fix whatever breaks on PICO
10:00 - 10:30 Polish demo flow, test 10 times
10:30 - 11:00 Record 60-second demo video
11:00 - 11:30 Fill and submit Devpost
11:30 - 12:00 Rehearse 2-minute judge pitch
12:00 - 12:45 Buffer — fix anything broken
12:45         SUBMIT DEVPOST
1:00 PM       DEADLINE — DOORS CLOSE
2:00 PM       JUDGING BEGINS
```

---

## Rules For Claude Code In This Session

1. Never suggest adding new features — time is gone
2. Every fix must take under 15 minutes
3. If something is broken and the fix is complex, implement the fallback instead
4. Always test after every change: does http://localhost:3000 still load?
5. The demo video matters more than perfect code
6. Devpost submission matters more than everything
7. A working simple demo beats a broken impressive one

---

## Emergency Fallbacks

| Problem | Solution |
|---------|----------|
| Marble .spz fails to load | Placeholder world still works — Scout pins still appear |
| ngrok dies | npx ngrok http 3000 — get new URL — update VITE_API_BASE_URL |
| Claude rate limited | Cache has 9 pre-computed responses — demo worlds work instantly |
| OpenAI TTS fails | Browser SpeechSynthesis fallback — already wired |
| PICO browser broken | Demo on laptop Chrome — still shows full loop |
| Devpost down | Screenshot everything — email judges directly |

---

## What Winning Looks Like

Judge puts on PICO. They are inside a generated world.
They say a mission. Scout's voice responds immediately.
Glowing pins appear floating in the world where Scout described.
Judge takes off headset. You say:

*"World models generate the space. Scout makes it operational.
That agent just reasoned about the 3D geometry it was standing
in and placed those markers in real space. Nobody else has built
this coupling before today."*

That is the win condition. Everything in this codebase
exists to make that 4-beat sequence happen perfectly.
