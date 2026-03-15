import * as THREE from "three";
import {
  EnvironmentType,
  Follower,
  FollowBehavior,
  Interactable,
  LocomotionEnvironment,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  PhysicsBody,
  PhysicsShape,
  PhysicsShapeType,
  PhysicsState,
  PanelUI,
  SessionMode,
  VisibilityState,
  World,
} from "@iwsdk/core";
import {
  PanelSystem,
  registerPanelCallbacks,
  setPanelStatus,
  setPanelButtonLabel,
  setActivePanelWorld,
} from "./uiPanel.js";
import {
  GaussianSplatLoader,
  GaussianSplatLoaderSystem,
} from "./gaussianSplatLoader.js";
import { spawnHologramSphere } from "./interactableExample.js";
import { executeMission, listenForMissionPrompt, ListenCancelledError } from "./voiceService.js";
import {
  applyCachedWorldToSplatEntity,
  generateAndCacheWorldFromPrompt,
  loadCachedWorldById,
  releaseCachedObjectUrls,
} from "./worldGenerationService.js";
import type { WorldListEntry } from "./worldListService.js";

// Master prompt host-world description
const CURRENT_WORLD_DESC =
  "A sci-fi reconnaissance hub world with a central command post, atmospheric fog, and ambient space station ambiance.";

// -----------------------------------------------------------------------
// World init
// -----------------------------------------------------------------------

World.create(document.getElementById("scene-container") as HTMLDivElement, {
  assets: {},
  xr: {
    sessionMode: SessionMode.ImmersiveVR,
    offer: "always",
    features: { handTracking: true, layers: true },
  },
  render: { defaultLighting: false },
  features: {
    locomotion: true,
    grabbing: true,
    physics: true,
    sceneUnderstanding: false,
    spatialUI: { forwardHtmlEvents: true },
  },
})
  .then((world) => {
    world.camera.position.set(0, 1.5, 0);
    // Black skybox cube surrounding the scene
    const skyboxGeo = new THREE.BoxGeometry(500, 500, 500);
    const skyboxMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      side: THREE.BackSide,
    });
    world.scene.add(new THREE.Mesh(skyboxGeo, skyboxMat));
    world.scene.add(new THREE.AmbientLight(0xffffff, 1.0));

    world
      .registerSystem(PanelSystem)
      .registerSystem(GaussianSplatLoaderSystem);

    // ------------------------------------------------------------------
    // Gaussian Splat entity (host world + swappable generated worlds)
    // ------------------------------------------------------------------
    const splatEntity = world.createTransformEntity();
    splatEntity.addComponent(GaussianSplatLoader);
    const splatSystem = world.getSystem(GaussianSplatLoaderSystem)!;
    const splatColliderUrl =
      (splatEntity.getValue(GaussianSplatLoader, "meshUrl") as string) ?? "";

    world.visibilityState.subscribe((state) => {
      if (state !== VisibilityState.NonImmersive) {
        splatSystem.replayAnimation(splatEntity).catch(console.error);
      }
    });

    // ------------------------------------------------------------------
    // Floor fallback (when no splat collider mesh)
    // ------------------------------------------------------------------
    if (!splatColliderUrl) {
      const floorGeometry = new PlaneGeometry(100, 100);
      floorGeometry.rotateX(-Math.PI / 2);
      const floor = new Mesh(floorGeometry, new MeshBasicMaterial());
      floor.visible = false;
      world
        .createTransformEntity(floor)
        .addComponent(LocomotionEnvironment, { type: EnvironmentType.STATIC })
        .addComponent(PhysicsShape, {
          shape: PhysicsShapeType.Box,
          dimensions: [100, 0.02, 100],
          friction: 0.9,
        })
        .addComponent(PhysicsBody, { state: PhysicsState.Static });
    }


    spawnHologramSphere(world);

    // ------------------------------------------------------------------
    // Helper: load a generated world into the splat entity
    // ------------------------------------------------------------------
    async function loadWorldEntry(entry: WorldListEntry): Promise<void> {
      if (!entry.world_url) {
        console.warn("[Nav] World has no URL yet:", entry.id);
        return;
      }
      releaseCachedObjectUrls();
      // Try to load from IndexedDB cache first, fallback to direct URL
      const cached = await loadCachedWorldById(entry.id).catch(() => null);
      if (cached) {
        await applyCachedWorldToSplatEntity(splatEntity, splatSystem, cached);
      } else {
        // Load directly from world_url as a splat
        splatEntity.setValue(GaussianSplatLoader, "splatUrl", entry.world_url);
        splatEntity.setValue(GaussianSplatLoader, "meshUrl", "");
        await splatSystem.load(splatEntity, { animate: false });
      }
      setActivePanelWorld(entry.id);
    }

    function returnHome(): void {
      releaseCachedObjectUrls();
      splatEntity.setValue(GaussianSplatLoader, "splatUrl", "");
      splatEntity.setValue(GaussianSplatLoader, "meshUrl", "");
      setActivePanelWorld(null);
    }

    // ------------------------------------------------------------------
    // Panel callbacks
    // ------------------------------------------------------------------
    registerPanelCallbacks({
      /** Scout mission: listen → /api/scout-mission → TTS + pins → generate world */
      onScout: async () => {
        setPanelButtonLabel("scout", "🎤 Listening...");
        setPanelStatus("Speak your mission...");
        try {
          const transcript = await listenForMissionPrompt();
          setPanelButtonLabel("scout", "⏳ Scouting...");
          setPanelStatus(`Mission: "${transcript}"`);
          const mission = await executeMission(
            CURRENT_WORLD_DESC,
            transcript,
            world.scene,
            (wps) => console.log("[Scout] Waypoints:", wps),
            (level) => setPanelStatus(`Threat: ${level}`),
          );
          setPanelStatus(`✓ ${mission.summary} — world generating…`);
          setTimeout(() => setPanelStatus(null), 6000);
        } catch (err) {
          if (err instanceof ListenCancelledError || (err as Error).name === "ListenCancelledError") {
            setPanelStatus(null);
          } else {
            console.error("[Scout] Failed:", err);
            setPanelStatus(`Error: ${(err as Error).message}`);
            setTimeout(() => setPanelStatus(null), 5000);
          }
        } finally {
          setPanelButtonLabel("scout", "🎤  Scout Mission");
        }
      },

      /** Direct voice → World Labs → cache → load (standalone generation) */
      onGenerate: async () => {
        setPanelButtonLabel("gen", "🎤 Listening...");
        setPanelStatus("Describe a world to generate...");
        try {
          const prompt = await listenForMissionPrompt();
          setPanelButtonLabel("gen", "⏳ Generating...");
          setPanelStatus(`Generating: "${prompt}"`);
          releaseCachedObjectUrls();
          const cached = await generateAndCacheWorldFromPrompt(prompt);
          setPanelStatus("Loading world...");
          await applyCachedWorldToSplatEntity(splatEntity, splatSystem, cached);
          setActivePanelWorld(cached.worldId);
          setPanelStatus(`✓ ${cached.caption ?? cached.worldId}`);
          setTimeout(() => setPanelStatus(null), 4000);
        } catch (err) {
          const msg = (err as Error).message ?? "";
          if (msg.includes("aborted") || msg.includes("no-speech")) {
            setPanelStatus(null);
          } else {
            console.error("[Gen] Failed:", err);
            setPanelStatus(`Error: ${msg}`);
            setTimeout(() => setPanelStatus(null), 5000);
          }
        } finally {
          setPanelButtonLabel("gen", "🌍  New World");
        }
      },

      onVisitWorld: async (entry) => {
        setPanelStatus(`Loading: ${entry.label}…`);
        try {
          await loadWorldEntry(entry);
          setPanelStatus(`✓ ${entry.label}`);
          setTimeout(() => setPanelStatus(null), 3000);
        } catch (err) {
          console.error("[Nav] Failed:", err);
          setPanelStatus(`Error: ${(err as Error).message}`);
          setTimeout(() => setPanelStatus(null), 5000);
        }
      },

      onHome: () => {
        returnHome();
        setPanelStatus("Host world");
        setTimeout(() => setPanelStatus(null), 2000);
      },

      onToggleXR: () => {
        if (world.visibilityState.value === VisibilityState.NonImmersive) {
          world.launchXR();
        } else {
          world.exitXR();
        }
      },

      getXRLabel: () =>
        world.visibilityState.value === VisibilityState.NonImmersive
          ? "Enter XR"
          : "Exit to Browser",
    });

    // ------------------------------------------------------------------
    // Floating panel entity — follows camera with PivotY behavior
    // ------------------------------------------------------------------
    const panelEntity = world.createTransformEntity();
    panelEntity.addComponent(PanelUI, {
      config: "./ui/sensai.json",
      maxWidth: 0.48,
      maxHeight: 0.85,
    });
    panelEntity.addComponent(Follower, {
      target: world.camera,
      offsetPosition: [0.36, -0.18, -0.65],
      behavior: FollowBehavior.PivotY,
      speed: 4,
      tolerance: 0.35,
    });
    // Register the panel as an XR raycast target so controller/hand
    // laser pointers can hit it and fire click events on its UIKit elements.
    panelEntity.addComponent(Interactable);

  })
  .catch((err) => {
    console.error("[World] Init failed:", err);
  });
