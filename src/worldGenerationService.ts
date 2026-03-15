import type { Entity } from "@iwsdk/core";
import type { GaussianSplatLoaderSystem } from "./gaussianSplatLoader.js";
import { GaussianSplatLoader } from "./gaussianSplatLoader.js";

const GENERATE_URL = "https://api.worldlabs.ai/marble/v1/worlds:generate";
const OPERATIONS_URL = "https://api.worldlabs.ai/marble/v1/operations";
const DB_NAME = "worldlabs-cache";
const DB_VERSION = 1;
const STORE_NAME = "worlds";
const POLL_INTERVAL_MS = 2_000;


interface GenerateResponse {
  operation_id: string;
}

interface OperationProgress {
  description?: string;
}

interface OperationMetadata {
  world_id?: string;
  progress?: OperationProgress;
}

interface OperationAssets {
  caption?: string;
  splats?: {
    spz_urls?: {
      full_res?: string;
    };
  };
  mesh?: {
    collider_mesh_url?: string;
  };
}

interface OperationResult {
  assets?: OperationAssets;
}

interface OperationResponse {
  done?: boolean;
  error?: unknown;
  metadata?: OperationMetadata;
  response?: OperationResult;
}

interface GeneratedWorldUrls {
  worldId: string;
  caption?: string;
  splatUrl: string;
  collisionMeshUrl?: string;
}

interface CachedWorld {
  worldId: string;
  prompt: string;
  caption?: string;
  createdAt: number;
  splatBlob: Blob;
  colliderBlob?: Blob;
}

interface CachedWorldUse {
  worldId: string;
  prompt: string;
  caption?: string;
  createdAt: number;
  splatObjectUrl: string;
  colliderObjectUrl?: string;
}

const activeObjectUrls = new Set<string>();

function getWorldLabsApiKey(): string {
  const env = import.meta.env as Record<string, string | undefined>;
  const key = env.VITE_WORLDLABS_API_KEY ?? env.WORLDLABS_API_KEY;
  if (!key) {
    throw new Error(
      "Missing World Labs API key. Set VITE_WORLDLABS_API_KEY in .env.",
    );
  }
  return key;
}

async function generateWorld(prompt: string): Promise<GenerateResponse> {
  const response = await fetch(GENERATE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "WLT-Api-Key": getWorldLabsApiKey(),
    },
    body: JSON.stringify({
      display_name: "Generated World",
      world_prompt: {
        type: "text",
        text_prompt: prompt,
      },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`World generation failed (${response.status}): ${text}`);
  }

  return (await response.json()) as GenerateResponse;
}

async function delay(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function pollOperationUntilDone(
  operationId: string,
): Promise<GeneratedWorldUrls> {
  while (true) {
    const response = await fetch(`${OPERATIONS_URL}/${operationId}`, {
      headers: {
        "WLT-Api-Key": getWorldLabsApiKey(),
      },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Operation polling failed (${response.status}): ${text}`);
    }

    const operation = (await response.json()) as OperationResponse;

    if (operation.error) {
      throw new Error(`World Labs operation failed: ${JSON.stringify(operation.error)}`);
    }

    if (operation.done) {
      const assets = operation.response?.assets;
      const splatUrl = assets?.splats?.spz_urls?.full_res;
      if (!splatUrl) {
        throw new Error("Generation completed without a splat URL.");
      }
      return {
        worldId: operation.metadata?.world_id ?? crypto.randomUUID(),
        caption: assets?.caption,
        splatUrl,
        collisionMeshUrl: assets?.mesh?.collider_mesh_url,
      };
    }

    console.log(
      "[WorldLabs] Generation in progress:",
      operation.metadata?.progress?.description ?? "pending",
    );
    await delay(POLL_INTERVAL_MS);
  }
}

async function fetchBlob(url: string): Promise<Blob> {
  const response = await fetch(url);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to fetch generated asset (${response.status}): ${text}`);
  }
  return response.blob();
}

function openCacheDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "worldId" });
        store.createIndex("createdAt", "createdAt");
      }
    };
    request.onsuccess = () => resolve(request.result);
  });
}

async function putCachedWorld(entry: CachedWorld): Promise<void> {
  const db = await openCacheDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.objectStore(STORE_NAME).put(entry);
  });
  db.close();
}

async function getLatestCachedWorld(): Promise<CachedWorld | null> {
  const db = await openCacheDb();
  const result = await new Promise<CachedWorld | null>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const index = tx.objectStore(STORE_NAME).index("createdAt");
    const request = index.openCursor(null, "prev");
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const cursor = request.result;
      resolve(cursor ? (cursor.value as CachedWorld) : null);
    };
  });
  db.close();
  return result;
}

function toObjectUrls(entry: CachedWorld): CachedWorldUse {
  const splatObjectUrl = URL.createObjectURL(entry.splatBlob);
  activeObjectUrls.add(splatObjectUrl);

  let colliderObjectUrl: string | undefined;
  if (entry.colliderBlob) {
    colliderObjectUrl = URL.createObjectURL(entry.colliderBlob);
    activeObjectUrls.add(colliderObjectUrl);
  }

  return {
    worldId: entry.worldId,
    prompt: entry.prompt,
    caption: entry.caption,
    createdAt: entry.createdAt,
    splatObjectUrl,
    colliderObjectUrl,
  };
}

export function releaseCachedObjectUrls(): void {
  for (const url of activeObjectUrls) {
    URL.revokeObjectURL(url);
  }
  activeObjectUrls.clear();
}

export async function generateAndCacheWorldFromPrompt(
  prompt: string,
): Promise<CachedWorldUse> {
  const generate = await generateWorld(prompt);
  const generated = await pollOperationUntilDone(generate.operation_id);

  const splatBlob = await fetchBlob(generated.splatUrl);
  const colliderBlob = generated.collisionMeshUrl
    ? await fetchBlob(generated.collisionMeshUrl)
    : undefined;

  const cacheEntry: CachedWorld = {
    worldId: generated.worldId,
    prompt,
    caption: generated.caption,
    createdAt: Date.now(),
    splatBlob,
    colliderBlob,
  };

  await putCachedWorld(cacheEntry);
  return toObjectUrls(cacheEntry);
}

export interface CachedWorldMeta {
  worldId: string;
  prompt: string;
  caption?: string;
  createdAt: number;
}

export async function getAllCachedWorldsMeta(): Promise<CachedWorldMeta[]> {
  const db = await openCacheDb();
  const items = await new Promise<CachedWorldMeta[]>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const index = tx.objectStore(STORE_NAME).index("createdAt");
    const req = index.openCursor(null, "prev");
    const acc: CachedWorldMeta[] = [];
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const cursor = req.result;
      if (cursor) {
        const v = cursor.value as CachedWorld;
        acc.push({ worldId: v.worldId, prompt: v.prompt, caption: v.caption, createdAt: v.createdAt });
        cursor.continue();
      } else {
        resolve(acc);
      }
    };
  });
  db.close();
  return items;
}

export async function loadCachedWorldById(worldId: string): Promise<CachedWorldUse | null> {
  const db = await openCacheDb();
  const entry = await new Promise<CachedWorld | null>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).get(worldId);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result as CachedWorld ?? null);
  });
  db.close();
  if (!entry) return null;
  return toObjectUrls(entry);
}

export async function loadLatestCachedWorld(): Promise<CachedWorldUse | null> {
  const latest = await getLatestCachedWorld();
  if (!latest) return null;
  return toObjectUrls(latest);
}

export async function applyCachedWorldToSplatEntity(
  splatEntity: Entity,
  splatSystem: GaussianSplatLoaderSystem,
  cached: CachedWorldUse,
): Promise<void> {
  splatEntity.setValue(GaussianSplatLoader, "splatUrl", cached.splatObjectUrl);
  splatEntity.setValue(
    GaussianSplatLoader,
    "meshUrl",
    cached.colliderObjectUrl ?? "",
  );
  await splatSystem.load(splatEntity, { animate: false });
}

