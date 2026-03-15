# Scout — AI Tactical Mission Agent for 3D Worlds

Built for the **Worlds in Action Hackathon** — "Best Agentic Mission Control with PICO" track.

## Quick Start

```bash
cd scout
cp .env.example .env        # Fill in your API keys
npm install
npm run dev                  # Starts on http://0.0.0.0:3000
```

## Team Setup

### Person A — World / WebXR Lead
- Place your WebXR kit files in `public/`
- Your files are served at `http://<IP>:3000/`
- Demo worlds: `http://<IP>:3000/worlds/space_station.spz` etc.
- API endpoints you consume:

```
POST /api/generate-world
Body: { "prompt": "dark sci-fi corridor with neon lights" }
Returns: { "splat_url": "/worlds/space_station.spz", "world_description": "..." }

POST /api/scout-mission
Body: { "world_description": "...", "user_mission": "find entry points" }
Returns: { "narration": "...", "waypoints": [...], "summary": "...", "threat_level": "low" }
```

### Person B — Agent Lead (You're reading this)
- Main files: `services/claude.js`, `routes/agent.js`, `prompts/system.js`
- Test: `curl -X POST http://localhost:3000/api/scout-mission -H "Content-Type: application/json" -d '{"world_description":"dark industrial warehouse","user_mission":"find exits"}'`

### Person C — Voice Lead
- API endpoints you consume:

```
POST /api/speak
Body: { "text": "Scanning the perimeter now." }
Returns: audio/mpeg blob (200) OR 204 No Content (use browser SpeechSynthesis)
```

- Send the `narration` field from `/api/scout-mission` response to `/api/speak`
- If you get 204, fall back to `window.speechSynthesis`

### Person D — Demo Lead
- Pre-load `.spz` files into `public/worlds/`
- Use `/api/generate-world` to create new worlds on the fly
- Health check: `GET /api/health`

## API Reference

| Endpoint | Method | Body | Returns |
|---|---|---|---|
| `/api/scout-mission` | POST | `{ world_description, user_mission }` | `{ narration, waypoints, summary, threat_level }` |
| `/api/generate-world` | POST | `{ prompt }` | `{ splat_url, world_description }` |
| `/api/speak` | POST | `{ text }` | `audio/mpeg` or `204` |
| `/api/health` | GET | — | `{ status, apis }` |

## Waypoint Schema

```json
{
  "id": "wp1",
  "label": "North Entry Point",
  "x": 0.3,
  "z": -0.8,
  "y": 0.0,
  "priority": "high",
  "note": "Primary access route."
}
```

- `x`, `z`: normalised coordinates from -1.0 to 1.0
- `y`: always 0.0
- `priority`: "high" | "medium" | "low"

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `CLAUDE_API_KEY` | Yes | Anthropic API key |
| `WORLDLABS_API_KEY` | For world gen | World Labs Marble API key |
| `ELEVENLABS_API_KEY` | For TTS | ElevenLabs API key |
| `ELEVENLABS_VOICE_ID` | No | Default: Rachel (21m00Tcm4TlvDq8ikWAM) |
| `PORT` | No | Default: 3000 |
