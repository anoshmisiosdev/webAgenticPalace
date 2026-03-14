
import * as THREE from "three";
import {
  EnvironmentType,
  LocomotionEnvironment,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  PhysicsBody,
  PhysicsShape,
  PhysicsShapeType,
  PhysicsState,
  SessionMode,
  VisibilityState,
  World,
} from "@iwsdk/core";
import { PanelSystem } from "./uiPanel.js";
import {
  GaussianSplatLoader,
  GaussianSplatLoaderSystem,
} from "./gaussianSplatLoader.js";
import { spawnHologramSphere } from "./interactableExample.js";


// ------------------------------------------------------------
// World (IWSDK settings)
// ------------------------------------------------------------
World.create(document.getElementById("scene-container") as HTMLDivElement, {
  assets: {},
  xr: {
    sessionMode: SessionMode.ImmersiveVR,
    offer: "always",
    features: { handTracking: true, layers: true },
  },
  render: {
    defaultLighting: false,
  },
  features: {
    locomotion: true,
    grabbing: true,
    physics: true,
    sceneUnderstanding: false,
  },
})
  .then((world) => {
    world.camera.position.set(0, 1.5, 0);
    world.scene.background = new THREE.Color(0x000000);
    world.scene.add(new THREE.AmbientLight(0xffffff, 1.0));

    world
      .registerSystem(PanelSystem)
      .registerSystem(GaussianSplatLoaderSystem);


    // ------------------------------------------------------------
    // Gaussian Splat
    // ------------------------------------------------------------
    const splatEntity = world.createTransformEntity();
    splatEntity.addComponent(GaussianSplatLoader);

    const splatSystem = world.getSystem(GaussianSplatLoaderSystem)!;
    const splatColliderUrl =
      (splatEntity.getValue(GaussianSplatLoader, "meshUrl") as string) ?? "";

    // Play splat animation when entering XR
    world.visibilityState.subscribe((state) => {
      if (state !== VisibilityState.NonImmersive) {
        splatSystem.replayAnimation(splatEntity).catch((err) => {
          console.error("[World] Failed to replay splat animation:", err);
        });
      }
    });

    
    // ------------------------------------------------------------
    // Invisible floor for locomotion fallback.
    // When `meshUrl` is set on the splat loader, the hidden collider mesh is
    // registered as the locomotion environment instead.
    // ------------------------------------------------------------
    if (!splatColliderUrl) {
      const floorGeometry = new PlaneGeometry(100, 100);
      floorGeometry.rotateX(-Math.PI / 2);
      const floor = new Mesh(floorGeometry, new MeshBasicMaterial());
      floor.visible = false;
      world
        .createTransformEntity(floor)
        .addComponent(LocomotionEnvironment, {
          type: EnvironmentType.STATIC,
        })
        .addComponent(PhysicsShape, {
          shape: PhysicsShapeType.Box,
          dimensions: [100, 0.02, 100],
          friction: 0.9,
        })
        .addComponent(PhysicsBody, { state: PhysicsState.Static });
    }

    const grid = new THREE.GridHelper(100, 100, 0x444444, 0x222222);
    grid.material.transparent = true;
    grid.material.opacity = 0.4;
    world.scene.add(grid);


    // ------------------------------------------------------------
    // Hologram Sphere (distance-grabbable, translate in place)
    // ------------------------------------------------------------
    spawnHologramSphere(world);


    // ------------------------------------------------------------
    // Panel UI (centered on screen in desktop, positioned in 3D for XR)
    // ------------------------------------------------------------


  })
  .catch((err) => {
    console.error("[World] Failed to create the IWSDK world:", err);
    const container = document.getElementById("scene-container");
  });

  
