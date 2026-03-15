import {
  createSystem,
  Entity,
  PanelUI,
  PanelDocument,
  eq,
  VisibilityState,
  UIKitDocument,
} from "@iwsdk/core";
import { Container, Text } from "@pmndrs/uikit";
import * as THREE from "three";
import {
  getWorldList,
  onWorldListChange,
  threatColor,
  type WorldListEntry,
} from "./worldListService.js";

// -----------------------------------------------------------------------
// Module-level state
// -----------------------------------------------------------------------

export interface PanelCallbacks {
  onScout: () => Promise<void>;
  onGenerate: () => Promise<void>;
  onVisitWorld: (entry: WorldListEntry) => Promise<void>;
  onHome: () => void;
  onToggleXR: () => void;
  getXRLabel: () => string;
}

let _callbacks: PanelCallbacks | null = null;
let _worldListEl: Container | null = null;
let _statusTextEl: Text | null = null;
let _scoutLabelEl: Text | null = null;
let _genLabelEl: Text | null = null;
let _xrLabelEl: Text | null = null;
let _activeWorldId: string | null = null;

export function registerPanelCallbacks(cb: PanelCallbacks): void {
  _callbacks = cb;
}

export function setPanelStatus(msg: string | null): void {
  _statusTextEl?.setProperties({ text: msg ?? " " } as any);
}

export function setActivePanelWorld(worldId: string | null): void {
  _activeWorldId = worldId;
  rebuildWorldList();
}

export function setPanelButtonLabel(
  button: "scout" | "gen" | "xr",
  label: string,
): void {
  if (button === "scout") _scoutLabelEl?.setProperties({ text: label } as any);
  if (button === "gen") _genLabelEl?.setProperties({ text: label } as any);
  if (button === "xr") _xrLabelEl?.setProperties({ text: label } as any);
}

// -----------------------------------------------------------------------
// World list helpers
// -----------------------------------------------------------------------

function formatAge(ts: number): string {
  const m = Math.floor((Date.now() - ts) / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function buildWorldRow(
  entry: WorldListEntry | null, // null = home row
  isActive: boolean,
  onClick: () => void,
): Container {
  const isHome = entry === null;
  const label = isHome
    ? "🏠  Host World"
    : (entry!.label ?? entry!.summary.slice(0, 50));
  const color = isHome ? "#9E9E9E" : threatColor(entry!.threat_level);
  const statusSuffix =
    !isHome && entry!.status === "generating"
      ? "  ⏳"
      : !isHome && entry!.status === "failed"
        ? "  ✗"
        : "";

  const row = new Container({
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    backgroundColor: isActive
      ? "rgba(124,58,237,0.35)"
      : "rgba(255,255,255,0.07)",
    overflow: "hidden",
    gap: 0,
  } as any);

  // Threat-color left stripe
  const stripe = new Container({
    width: 4,
    alignSelf: "stretch",
    backgroundColor: color,
  } as any);
  row.add(stripe);

  // Content area
  const content = new Container({
    flex: 1,
    flexDirection: "column",
    padding: 10,
    gap: 2,
  } as any);

  const nameText = new Text({
    text: label + statusSuffix,
    fontSize: 13,
    color: "white",
  } as any);
  content.add(nameText);

  if (!isHome) {
    const meta = new Text({
      text: `${entry!.threat_level ?? "UNKNOWN"}  ·  ${formatAge(entry!.created_at)}`,
      fontSize: 10,
      color: "rgba(160,160,210,1)",
    } as any);
    content.add(meta);
  }

  row.add(content);

  // Active dot
  if (isActive) {
    const dot = new Container({
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: "rgba(200,160,255,1)",
      marginRight: 10,
    } as any);
    row.add(dot);
  }

  row.addEventListener("click", onClick);
  return row;
}

function rebuildWorldList(): void {
  if (!_worldListEl) return;
  const toRemove = [..._worldListEl.children];
  toRemove.forEach((c) => _worldListEl!.remove(c));

  // Home row
  _worldListEl.add(
    buildWorldRow(null, _activeWorldId === null, () => _callbacks?.onHome()),
  );

  // Generated world rows
  const worlds = getWorldList();
  for (const entry of worlds) {
    _worldListEl.add(
      buildWorldRow(
        entry,
        entry.id === _activeWorldId,
        () => void _callbacks?.onVisitWorld(entry),
      ),
    );
  }
}

// -----------------------------------------------------------------------
// Depth-override: force UI to render on top of Gaussian Splats
// -----------------------------------------------------------------------

const APPLIED_FLAG = "__uiDepthApplied";

function configureUIMaterial(m: THREE.Material | null | undefined): void {
  if (!m) return;
  m.depthTest = true;
  m.depthWrite = true;
  m.depthFunc = THREE.AlwaysDepth;
  if (m instanceof THREE.MeshBasicMaterial && m.map) {
    m.transparent = true;
    m.alphaTest = 0.01;
  }
}

function applyRenderOrder(obj3d: THREE.Object3D): void {
  obj3d.traverse((obj) => {
    obj.renderOrder = 10_000;
    if (obj instanceof THREE.Mesh) {
      if (obj.userData[APPLIED_FLAG]) return;
      obj.userData[APPLIED_FLAG] = true;
      if (Array.isArray(obj.material)) {
        obj.material.forEach(configureUIMaterial);
      } else {
        configureUIMaterial(obj.material);
      }
      const orig = obj.onBeforeRender;
      obj.onBeforeRender = function (r, s, c, g, material, group) {
        configureUIMaterial(material as THREE.Material);
        if (typeof orig === "function")
          orig.call(this, r, s, c, g, material, group);
      };
    }
  });
}

export function makeEntityRenderOnTop(entity: Entity): void {
  let attempts = 0;
  const try_ = () => {
    if (entity.object3D) {
      applyRenderOrder(entity.object3D);
      return;
    }
    if (++attempts < 10) requestAnimationFrame(try_);
  };
  try_();
}

// -----------------------------------------------------------------------
// PanelSystem
// -----------------------------------------------------------------------

export class PanelSystem extends createSystem({
  sensaiPanel: {
    required: [PanelUI, PanelDocument],
    where: [eq(PanelUI, "config", "./ui/sensai.json")],
  },
}) {
  init() {
    // Rebuild list whenever worldListService notifies us
    onWorldListChange(() => rebuildWorldList());

    this.queries.sensaiPanel.subscribe(
      "qualify",
      (entity) => {
        makeEntityRenderOnTop(entity);

        const doc = PanelDocument.data.document[
          entity.index
        ] as UIKitDocument;
        if (!doc) return;

        // --- Status bar ---
        const statusBarEl = doc.getElementById("status-bar") as Container | null;
        if (statusBarEl) {
          _statusTextEl = new Text({
            text: " ",
            fontSize: 12,
            color: "rgba(180,180,255,1)",
            textAlign: "center",
            flex: 1,
          } as any);
          statusBarEl.add(_statusTextEl);
        }

        // --- Scout button ---
        const scoutBtnEl = doc.getElementById("scout-btn") as Container | null;
        if (scoutBtnEl) {
          _scoutLabelEl = new Text({
            text: "🎤  Scout Mission",
            fontSize: 13,
            fontWeight: "bold",
            color: "white",
            textAlign: "center",
          } as any);
          scoutBtnEl.add(_scoutLabelEl);
          scoutBtnEl.addEventListener("click", () => void _callbacks?.onScout());
        }

        // --- Generate button ---
        const genBtnEl = doc.getElementById("gen-btn") as Container | null;
        if (genBtnEl) {
          _genLabelEl = new Text({
            text: "🌍  New World",
            fontSize: 13,
            fontWeight: "bold",
            color: "white",
            textAlign: "center",
          } as any);
          genBtnEl.add(_genLabelEl);
          genBtnEl.addEventListener("click", () => void _callbacks?.onGenerate());
        }

        // --- World list ---
        _worldListEl = doc.getElementById("world-list") as Container | null;
        rebuildWorldList();

        // --- XR button ---
        const xrBtnEl = doc.getElementById("xr-button") as Container | null;
        if (xrBtnEl) {
          _xrLabelEl = new Text({
            text: _callbacks?.getXRLabel() ?? "Enter XR",
            fontSize: 13,
            fontWeight: "bold",
            color: "rgba(180,200,255,1)",
            textAlign: "center",
          } as any);
          xrBtnEl.add(_xrLabelEl);
          xrBtnEl.addEventListener("click", () => _callbacks?.onToggleXR());
          this.world.visibilityState.subscribe((state) => {
            _xrLabelEl?.setProperties({
              text:
                state === VisibilityState.NonImmersive
                  ? "Enter XR"
                  : "Exit to Browser",
            } as any);
          });
        }
      },
      true,
    );
  }
}
