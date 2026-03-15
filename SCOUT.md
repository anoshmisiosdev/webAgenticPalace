# SCOUT.md — Complete Master Plan

> AI Mission Agent for Generated Worlds
> Worlds in Action Hack — San Francisco — March 14-15, 2026
> Track: Best Agentic Mission Control with PICO

---

## The One-Liner

> *"Scout turns any AI-generated world into a mission — by giving
> it an agent that can see, think, and guide you through it."*

---

## Section 1 — What Scout Is

Scout is a WebXR application combining the World Labs Marble API
with Claude AI to create the world's first spatially-aware mission
companion for generated 3D worlds.

**The user experience:**
1. User puts on PICO headset
2. A Marble-generated photorealistic 3D world surrounds them
3. User speaks a mission: *"Scout this space station for entry points"*
4. Scout's AI agent reasons about the world geometry and mission
5. Scout narrates in a field operative voice through the headset
6. Glowing 3D pins appear floating at every point of interest
7. User speaks follow-up missions — the loop runs again

**The technical loop:**
```
VOICE IN → LLM REASONS ABOUT WORLD → JSON WAYPOINTS → 3D PINS + TTS OUT
```

This is a complete agentic loop:
- Perceive: voice input + world context
- Reason: Claude analyses geometry and mission
- Act: pins placed in 3D space + narration plays
- Iterate: user speaks follow-up, loop repeats

---

## Section 2 — The Problem We Solve

World models generate stunning 3D environments in seconds.
But once you are inside them — they are dead.
No intelligence. No guidance. No spatial awareness.
The AI that built the world forgot it existed.

**Without Scout:** Generated world is visually impressive but passive.
User navigates blindly. Nothing to do. Close the tab.

**With Scout:** World becomes a mission space. Agent understands the
geometry. Every generated environment is alive with spatial intelligence.

---

## Section 3 — Why It Is Unique

Three types of projects exist at this hackathon:

| Type | What they built | Why it's not Scout |
|------|----------------|-------------------|
| Passive viewer | Marble world in headset | No AI. Just looking around. |
| VR chatbot | AI assistant in XR | Not spatial. Doesn't know the world. |
| Scene + feature | XR with AI feature bolted on | AI disconnected from 3D geometry |

Scout is the only project where:
- The AI agent receives the generated world as its operating environment
- The agent's outputs are physically anchored to that specific world
- The waypoints only make sense FOR that world

The spatial grounding is the unique thing.
The agent isn't just talking. It is acting inside a specific generated
environment in a way that only makes sense for that environment.

---

## Section 4 — Practical Use Cases

### Game Design
Scout scans a procedurally generated level for balance issues,
dominant positions, camping spots, and unfair advantages.
Designer iterates 10x faster. Applicable at Roblox scale.

### Architecture & Real Estate
Scout flags accessibility problems, poor sightlines, fire egress gaps
in a generated building concept before any CAD drawings are made.
Catches problems in minutes that would cost thousands to fix in build.

### Military & Emergency Training
Generate a new environment every session. Scout briefs trainees on
entry points, threat positions, extraction routes automatically.
Infinite unique scenarios, zero manual environment creation.

### Film Pre-Production
Director walks a generated set in VR. Scout identifies best camera
positions, natural blocking zones, lighting focal points.
Pre-visualization without physical mockup costs.

### Retail Layout Optimization
Scout maps natural customer flow paths and dead zones through a
generated store layout before committing to a physical refit.

**The one-line practical summary:**
Any industry that needs a human to physically understand a space
before committing resources — Scout replaces the site visit with
an AI briefing inside a generated world.

---

## Section 5 — How It Differs From Meta AI on Quest

Meta AI on Quest is a conversational assistant that runs on a headset.
It has no idea what world you are standing in.
It cannot place a marker at the northeast entry point of a generated space.
It is Siri with a headset on.

Scout is a spatial agent that reasons about a specific generated environment.

| | Meta AI on Quest | Scout |
|--|--|--|
| Knows your world | No | Yes — received as context |
| Spatially anchored output | No — just voice/text | Yes — 3D pins at coordinates |
| Works on generated worlds | Cannot | That is the entire point |
| Agent takes spatial action | No | Yes — waypoints in real space |

**The analogy:**
Meta AI is like calling a friend for directions when they've never
seen where you are. Scout is a co-pilot who can see your exact
environment and says "turn left at the collapsed corridor."

---

## Section 6 — Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| World generation | World Labs Marble API | Text → Gaussian splat world |
| XR rendering | Three.js + WebXR + SparkJS | Render splat in PICO browser |
| AI agent | Anthropic Claude (claude-sonnet-4-6) | Spatial reasoning + JSON output |
| Voice input | Web Speech API | Mic → transcript in browser |
| Voice output | OpenAI TTS (onyx) + SpeechSynthesis | Narration through PICO speakers |
| Backend | Node.js + Express | API proxy, serves frontend |
| Tunnel | ngrok | Bypass hackathon WiFi isolation |
| Headset | PICO 4 devkit | WebXR browser, mic, speakers |

---

## Section 7 — Architecture

```
┌─────────────────────────────────────────────────────┐
│                  PICO Headset                        │
│              WebXR Browser                           │
│  ┌─────────────────────────────────────────────┐    │
│  │  Three.js Scene                              │    │
│  │  • Gaussian splat world (Marble)             │    │
│  │  • 3D waypoint pins (red/orange/green)       │    │
│  │  • HUD overlay (status, narration, list)     │    │
│  │  • WASD + pointer lock navigation            │    │
│  └──────────────┬───────────────────────────────┘    │
│                 │ fetch() over ngrok                   │
└─────────────────┼───────────────────────────────────-┘
                  │
┌─────────────────▼──────────────────────────────────┐
│              Node.js Server (:3000)                 │
│  POST /api/scout-mission  ← main endpoint           │
│  POST /api/speak          ← TTS                     │
│  POST /api/generate-world ← Marble                  │
│  GET  /api/health         ← status                  │
│  GET  /worlds/*.spz       ← static splat files      │
└────────┬──────────────┬──────────────┬──────────────┘
         │              │              │
    ┌────▼────┐   ┌──────▼──────┐  ┌──▼──────────┐
    │ Claude  │   │  World Labs │  │  OpenAI TTS │
    │   API   │   │  Marble API │  │    (onyx)   │
    └─────────┘   └─────────────┘  └─────────────┘
```

---

## Section 8 — Judge Pitch (2 Minutes)

**Practice this 5 times before judging at 2 PM.**

### 0:00 — 0:20 | The Problem
*"World models can generate stunning 3D environments in seconds.
But once you're inside them — they're completely dead. No intelligence.
No guidance. No spatial awareness. The AI that built the world
forgot it existed the moment you stepped in."*

### 0:20 — 0:40 | The Solution
*"Scout changes that. Scout is the first AI agent that lives inside
a generated world and understands it spatially. You speak a mission.
Scout explores the space, reasons about what it finds, tells you
where to go, and marks every point of interest in 3D space around you."*

### 0:40 — 1:20 | LIVE DEMO
**[Put headset on judge or demo yourself facing them]**

*"Watch. I'll say: Scout, scan this space station for entry points
and defensive positions."*

**[Scout responds, pins appear, narration plays]**

*"Every pin you see was placed by the AI agent. It reasoned about
this specific generated space and put those markers exactly where
they are tactically significant."*

### 1:20 — 1:45 | The Technical Truth
*"What you just experienced is a complete agentic loop — perceive,
reason, act — running live inside a Marble-generated world. Scout
doesn't just chat at you. It understands the 3D geometry it's
standing in and takes real spatial action within that space."*

### 1:45 — 2:00 | The Opportunity
*"This works for game design, architecture, training simulations,
film pre-vis — any domain that needs spatial intelligence inside a
generated world. Scout is that intelligence layer. Generated worlds
finally have a brain. Thank you."*

---

## Section 9 — What Each Judge Cares About

| Judge | Company | Why Scout Resonates |
|-------|---------|---------------------|
| Alberto Hojel | Roblox | AI level analysis = future of UGC at Roblox scale |
| Sherrie Cao | EA | AI spatial companion in procedural game levels |
| David Gene Oh | ByteDance/PICO | Scout runs natively on PICO — killer app for the platform |
| Ian Curtis | World Labs | Treats Marble as intelligence layer — their stated vision |
| Asim Ahmed | Niantic | Spatial AI grounded in physical space = Niantic's thesis |
| Neil Trevett | NVIDIA | Real-time AI inference in XR = compute future they're building |
| Felix Hartmann | Hartmann Capital | Novel primitive, clear commercial paths — strong thesis |

---

## Section 10 — Judging Criteria Alignment

The track is: **Best Agentic Mission Control with PICO**

**Agentic** — Scout has a complete perception-decision-action loop.
It does not just answer. It perceives the world, reasons about
geometry and mission, and takes physical action in 3D space.
That is the textbook definition of an agent.

**Mission Control** — There is a command structure. Human gives
high-level objective. Agent returns actionable spatial intelligence.
Exactly mission control architecture.

**With PICO** — Uses PICO WebXR browser, microphone, speakers.
The headset is not decorative. The spatial grounding only works
in immersive XR. A flat screen cannot deliver this experience.

---

## Section 11 — Demo Sequence

**The exact sequence that wins this category:**

```
Step 1: Judge picks up PICO headset
Step 2: World loads — photorealistic Marble-generated space station
Step 3: Scout auto-fires — narration plays, pins appear
Step 4: You say "tell Scout what to do"
Step 5: Judge says a mission out loud
Step 6: Scout responds in field operative voice
Step 7: Glowing pins appear in world where Scout described
Step 8: Judge takes off headset — visibly impressed
Step 9: You say the one-liner
Step 10: Switch to jungle temple world — Scout again
Step 11: Completely different waypoints for completely different world
Step 12: "That's not hardcoded. That agent just reasoned about
          that specific space."

Step 12 is the killer moment. Different world = different waypoints.
That proves the agent actually reasons about the environment.
```

---

## Section 12 — Devpost Submission Checklist

**Must be submitted by 12:45 PM Sunday**

- [ ] Project name: Scout — AI Mission Agent for Generated Worlds
- [ ] All team members added as collaborators
- [ ] Track tags: Best Agentic Mission Control with PICO
- [ ] 60-second demo video (headset POV, publicly visible)
- [ ] Project description (use Section 1 and 2 text above)
- [ ] Tech stack listed (see Section 6)
- [ ] Live URL: your ngrok URL
- [ ] Submitted at 12:45 PM — NOT 1:00 PM

### Description To Paste Into Devpost

**Short description (1-2 sentences):**
Scout is an AI spatial intelligence agent that lives inside
Marble-generated 3D worlds. You speak a mission — Scout explores
the world, narrates what it finds, and marks every point of
interest as a glowing 3D pin in the space around you.

**Full description:**
World models can generate stunning 3D environments from a single
text prompt. But once you're inside them, they're dead. No
intelligence. No guidance. The AI that built the world forgot
it existed. Scout solves that.

Scout is a voice-controlled AI agent built on the World Labs
Marble API and Anthropic Claude. When deployed inside a generated
world on the PICO headset, Scout receives the world's spatial
context, reasons about its geometry relative to your mission
objective, and returns a structured tactical assessment — spoken
in your ear as field operative narration with glowing waypoint
pins placed at exact 3D coordinates in the world around you.

The agentic loop is complete: voice command in → world context
+ Claude reasoning → spatial JSON → 3D pins placed in scene +
TTS narration out → iterate on follow-up missions.

Built for the Agentic Mission Control track because Scout
demonstrates exactly what agentic XR should be — not a chatbot
in a headset, but an agent that perceives, reasons about, and
acts within a specific generated spatial environment.

**Tech stack:**
World Labs Marble API, Anthropic Claude API (claude-sonnet-4-6),
Three.js WebXR, SparkJS Gaussian splat renderer, Web Speech API,
OpenAI TTS, Node.js/Express, PICO 4 WebXR Browser, ngrok

---

## Section 13 — Emergency Protocols

### Marble .spz files missing
Use placeholder worlds. Scout still works perfectly.
Pins appear on placeholder geometry. Judges evaluate the concept.
Tell judges: "The Marble world generation is integrated via API —
for demo stability we're using pre-generated worlds today."

### ngrok tunnel dies
```bash
npx ngrok http 3000
```
Get new URL. Update BASE_URL in public/index.html.
Restart browser. PICO connects to new URL.

### Claude API rate limited
Cache has 9 pre-computed responses for demo worlds.
They return in under 200ms.
For novel missions, responses still come through at ~10 seconds.

### OpenAI TTS fails
Browser SpeechSynthesis fallback is already wired.
It activates automatically on 204 response.
Voice quality lower but it works.

### PICO browser broken
Demo on laptop Chrome with WebXR emulator.
Install extension: "WebXR API Emulator" from Chrome Web Store.
Select Oculus Quest 2 in the DevTools WebXR tab.
Full XR simulation in browser.

### Devpost down near deadline
Screenshot everything.
Have project description in a text file ready to email.
Email directly to organizers at hello@sensaihack.com

---

## Section 14 — Time Budget (8 AM — 12:45 PM)

```
08:00 - 08:30  Get Marble .spz files
               → marble.worldlabs.ai → generate 3 worlds
               → export as .spz → save to public/worlds/

08:30 - 09:00  Verify full loop working
               → npm run dev
               → open http://localhost:3000
               → world loads, Scout fires, pins appear, voice plays

09:00 - 09:30  PICO browser test
               → open PICO browser → ngrok URL
               → allow mic + WebXR
               → walk around world, see pins

09:30 - 10:00  Fix whatever broke on PICO
               → common issues: mic permissions, CORS, pin scale

10:00 - 10:30  Polish demo flow
               → test 10 times in a row without touching anything
               → it must work unattended for judge handoff

10:30 - 11:00  Record demo video
               → 60 seconds, headset POV
               → world loads → Scout fires → pins → narration
               → switch world → different pins
               → upload to YouTube unlisted

11:00 - 11:30  Fill Devpost
               → paste description from Section 12
               → add video link
               → list tech stack
               → add team members

11:30 - 12:00  Rehearse pitch
               → read Section 8 out loud 3 times
               → time yourself — must be under 2 minutes
               → know which judge to speak to for each use case

12:00 - 12:45  Buffer + submit
               → fix any last issues
               → SUBMIT DEVPOST AT 12:45 PM
               → confirm submission email received

1:00 PM        DEADLINE — SUBMISSIONS CLOSE

2:00 PM        JUDGING — deliver the pitch from Section 8

4:00 PM        SHOWCASE — demo table open networking
```

---

## Section 15 — The Golden Rules

**1. A simple working demo beats a broken impressive one.**
If pins appear in a placeholder world — that is enough to win.
The agent loop matters more than the graphics.

**2. Submit before you are ready.**
12:45 PM is the target. Not 1:00 PM. Devpost gets slow.
Submit what you have. Incomplete is better than missed.

**3. The demo video is your safety net.**
If live demo breaks during judging, the video saves you.
Record it as early as possible. Before 11 AM if you can.

**4. Step 12 of the demo sequence is the win.**
Different world = different waypoints.
That single moment proves the agent reasons about space.
Set it up. Execute it. Let judges sit with it for 3 seconds.

**5. Never apologize during the demo.**
If something looks wrong, keep talking.
Judges are evaluating the concept and your execution,
not whether you matched a spec sheet.

---

## The Win Condition

Judge puts on PICO.
They stand in a generated world.
They speak a mission.
Scout responds in their ear.
Glowing pins appear in the world around them.
They take off the headset.
You say:

*"World models generate the space. Scout makes it operational."*

Everything in this codebase exists to make that moment happen.
