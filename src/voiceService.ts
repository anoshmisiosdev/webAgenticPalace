import * as THREE from "three";
import { clearPins, placePins } from "./waypointManager.js";
import {
  addWorldToFloatList,
  updateWorldEntry,
  type WorldListEntry,
} from "./worldListService.js";

const _env = import.meta.env as Record<string, string | undefined>;
const BASE_URL = _env.VITE_API_BASE_URL ?? "http://localhost:3000";

// Local speech API types (avoids relying on DOM lib globals)
interface ISpeechRecognition {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  onerror: ((e: { error: string }) => void) | null;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onnomatch: (() => void) | null;
  start(): void;
  stop(): void;
}
type SpeechRecognitionCtor = new () => ISpeechRecognition;

// -----------------------------------------------------------------------
// Headers — ngrok interstitial bypass only in dev
// -----------------------------------------------------------------------

function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (import.meta.env.DEV) {
    headers["ngrok-skip-browser-warning"] = "true";
  }
  return headers;
}

// -----------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------

interface ScoutMissionResponse {
  narration: string;
  waypoints: Array<{
    x: number;
    z: number;
    y?: number;
    label?: string;
    priority?: "high" | "medium" | "low";
  }>;
  summary: string;
  threat_level: string;
}

interface GenerateWorldResponse {
  job_id: string;
  status: string;
}

interface WorldStatusResponse {
  status: "pending" | "processing" | "complete" | "failed";
  world_url: string | null;
  thumbnail_url: string | null;
  world_id: string | null;
}

// -----------------------------------------------------------------------
// Voice / Speech Recognition
// -----------------------------------------------------------------------

/** Thrown when the user cancels or the mic times out — not a real error. */
export class ListenCancelledError extends Error {
  constructor() {
    super("Listening cancelled");
    this.name = "ListenCancelledError";
  }
}

// Module-level guard so a second click aborts the previous session cleanly
// instead of letting two recognition instances fight each other.
let _activeRecognition: ISpeechRecognition | null = null;

export async function listenForMissionPrompt(): Promise<string> {
  const maybeCtor = (
    window as unknown as {
      SpeechRecognition?: SpeechRecognitionCtor;
      webkitSpeechRecognition?: SpeechRecognitionCtor;
    }
  ).SpeechRecognition ??
    (window as unknown as { webkitSpeechRecognition?: SpeechRecognitionCtor })
      .webkitSpeechRecognition;

  if (!maybeCtor) {
    throw new Error("Speech recognition is not supported in this browser.");
  }

  // Abort any previous session so two instances never overlap
  if (_activeRecognition) {
    _activeRecognition.stop();
    _activeRecognition = null;
  }

  return new Promise<string>((resolve, reject) => {
    const recognition = new maybeCtor();
    _activeRecognition = recognition;

    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;

    let done = false;
    const finish = (fn: () => void) => {
      if (done) return;
      done = true;
      _activeRecognition = null;
      recognition.stop();
      fn();
    };

    // "aborted" / "no-speech" are user cancellations — not real errors
    const CANCEL_CODES = new Set(["aborted", "no-speech"]);
    recognition.onerror = (e: { error: string }) =>
      finish(() =>
        CANCEL_CODES.has(e.error)
          ? reject(new ListenCancelledError())
          : reject(new Error(`Speech recognition error: ${e.error}`)),
      );

    recognition.onresult = (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => {
      const transcript = e.results[0]?.[0]?.transcript?.trim();
      if (!transcript) {
        finish(() => reject(new ListenCancelledError()));
        return;
      }
      finish(() => resolve(transcript));
    };

    recognition.onnomatch = () => finish(() => reject(new ListenCancelledError()));

    recognition.start();
  });
}

// -----------------------------------------------------------------------
// Scout mission
// -----------------------------------------------------------------------

async function scoutMission(
  worldDescription: string,
  userMission: string,
): Promise<ScoutMissionResponse> {
  const response = await fetch(`${BASE_URL}/api/scout-mission`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      world_description: worldDescription,
      user_mission: userMission,
    }),
  });

  if (!response.ok) {
    throw new Error(`Scout mission error: ${response.status}`);
  }

  return (await response.json()) as ScoutMissionResponse;
}

// -----------------------------------------------------------------------
// TTS / Speak
// -----------------------------------------------------------------------

function browserSpeak(text: string): void {
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 0.95;
  u.pitch = 0.9;
  u.volume = 1.0;
  const voices = window.speechSynthesis.getVoices();
  const deep = voices.find(
    (v) =>
      v.name.includes("Google UK English Male") ||
      v.name.includes("Daniel") ||
      v.name.includes("Alex"),
  );
  if (deep) u.voice = deep;
  window.speechSynthesis.speak(u);
}

export async function speak(narration: string): Promise<void> {
  try {
    const res = await fetch(`${BASE_URL}/api/speak`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ text: narration }),
    });

    if (res.status === 204 || !res.ok) {
      browserSpeak(narration);
      return;
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.onended = () => URL.revokeObjectURL(url);
    await audio.play();
  } catch {
    browserSpeak(narration);
  }
}

// -----------------------------------------------------------------------
// Backend world generation + polling
// -----------------------------------------------------------------------

async function submitWorldGeneration(
  description: string,
): Promise<GenerateWorldResponse> {
  const res = await fetch(`${BASE_URL}/api/generate-world`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ description }),
  });
  if (!res.ok) throw new Error(`Generate world error: ${res.status}`);
  return (await res.json()) as GenerateWorldResponse;
}

async function pollWorldStatus(
  jobId: string,
  intervalMs = 3_000,
  maxAttempts = 40,
): Promise<WorldStatusResponse> {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const timer = setInterval(async () => {
      attempts++;
      try {
        const res = await fetch(`${BASE_URL}/api/world-status/${jobId}`, {
          headers: getHeaders(),
        });
        const data = (await res.json()) as WorldStatusResponse;

        if (data.status === "complete") {
          clearInterval(timer);
          resolve(data);
        } else if (data.status === "failed" || attempts >= maxAttempts) {
          clearInterval(timer);
          reject(
            new Error(
              `World generation ${data.status === "failed" ? "failed" : "timed out"}. Job: ${jobId}`,
            ),
          );
        } else {
          console.log(
            `[WorldGen] Job ${jobId}: ${data.status} (attempt ${attempts}/${maxAttempts})`,
          );
        }
      } catch (err) {
        clearInterval(timer);
        reject(err);
      }
    }, intervalMs);
  });
}

async function generateAndTrackWorld(
  summary: string,
  threatLevel: string,
): Promise<void> {
  const tempId = `pending-${Date.now()}`;
  const entry: WorldListEntry = {
    id: tempId,
    label: summary.slice(0, 50),
    summary,
    threat_level: threatLevel,
    thumbnail_url: null,
    world_url: null,
    created_at: Date.now(),
    status: "generating",
  };

  addWorldToFloatList(entry);

  try {
    const { job_id } = await submitWorldGeneration(summary);
    const worldData = await pollWorldStatus(job_id);

    updateWorldEntry(tempId, {
      id: worldData.world_id ?? tempId,
      world_url: worldData.world_url,
      thumbnail_url: worldData.thumbnail_url,
      status: "complete",
    });

    console.log("[WorldGen] World ready:", worldData.world_id);
  } catch (err) {
    console.error("[WorldGen] Generation failed:", err);
    updateWorldEntry(tempId, { status: "failed" });
  }
}

// -----------------------------------------------------------------------
// Full mission executor — scout → TTS + pins → generate world in background
// -----------------------------------------------------------------------

// Fallback pins placed at compass points when the API fails
const FALLBACK_WAYPOINTS = [
  { x: 0,    z: -0.7, label: "North",  priority: "medium" as const },
  { x: 0.7,  z: 0,    label: "East",   priority: "low"    as const },
  { x: 0,    z: 0.7,  label: "South",  priority: "low"    as const },
  { x: -0.7, z: 0,    label: "West",   priority: "high"   as const },
];

export async function executeMission(
  worldDescription: string,
  userMission: string,
  scene: THREE.Scene,
  onWaypoints?: (waypoints: ScoutMissionResponse["waypoints"]) => void,
  onThreat?: (level: string) => void,
): Promise<ScoutMissionResponse> {
  const missionData = await scoutMission(worldDescription, userMission).catch(
    (err) => {
      console.error("[Scout] API failed, placing fallback pins:", err);
      clearPins(scene);
      placePins(FALLBACK_WAYPOINTS, scene);
      throw err;
    },
  );

  clearPins(scene);
  placePins(missionData.waypoints, scene);
  if (onWaypoints) onWaypoints(missionData.waypoints);
  if (onThreat) onThreat(missionData.threat_level);

  speak(missionData.narration).catch(console.error);
  generateAndTrackWorld(missionData.summary, missionData.threat_level).catch(
    console.error,
  );

  return missionData;
}

export { scoutMission };
export type { ScoutMissionResponse };
