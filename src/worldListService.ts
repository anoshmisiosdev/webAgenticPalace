/**
 * In-memory float world list — stores every world generated during the session.
 * Persists to localStorage so the list survives page reloads.
 */

const STORAGE_KEY = "xr-world-list";

export interface WorldListEntry {
  id: string;
  label: string;
  summary: string;
  threat_level: string; // 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  thumbnail_url: string | null;
  world_url: string | null;
  created_at: number;
  status: "generating" | "complete" | "failed";
}

type WorldListListener = (list: WorldListEntry[]) => void;

let _list: WorldListEntry[] = loadFromStorage();
const _listeners: WorldListListener[] = [];

function loadFromStorage(): WorldListEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as WorldListEntry[]) : [];
  } catch {
    return [];
  }
}

function persist(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(_list));
  } catch {
    // ignore storage errors
  }
}

function notify(): void {
  _listeners.forEach((fn) => fn([..._list]));
}

export function getWorldList(): WorldListEntry[] {
  return [..._list];
}

export function onWorldListChange(fn: WorldListListener): () => void {
  _listeners.push(fn);
  return () => {
    const i = _listeners.indexOf(fn);
    if (i >= 0) _listeners.splice(i, 1);
  };
}

export function addWorldToFloatList(entry: WorldListEntry): void {
  _list.unshift(entry); // newest first
  persist();
  notify();
}

export function updateWorldEntry(
  id: string,
  patch: Partial<WorldListEntry>,
): void {
  const idx = _list.findIndex((e) => e.id === id);
  if (idx < 0) return;
  _list[idx] = { ..._list[idx], ...patch };
  persist();
  notify();
}

/** Threat-level → hex color per master prompt spec */
export function threatColor(level: string): string {
  switch (level?.toUpperCase()) {
    case "LOW":
      return "#4CAF50";
    case "MEDIUM":
      return "#FFC107";
    case "HIGH":
      return "#FF5722";
    case "CRITICAL":
      return "#F44336";
    default:
      return "#9E9E9E";
  }
}
