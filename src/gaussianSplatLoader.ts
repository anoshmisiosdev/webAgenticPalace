
import {
  Entity,
  LocomotionEnvironment,
  PhysicsBody,
  PhysicsShape,
  PhysicsShapeType,
  PhysicsState,
  Types,
  createComponent,
  createSystem,
} from "@iwsdk/core";
import { EnvironmentType } from "@iwsdk/core";
import { SparkRenderer, SplatMesh } from "@sparkjsdev/spark";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { GaussianSplatAnimator } from "./gaussianSplatAnimator.js";
import { updatePins } from "./waypointManager.js";


// ------------------------------------------------------------
// Constants & Types
// ------------------------------------------------------------
const LOAD_TIMEOUT_MS = 30_000;

// Distance-based lodSplatScale tiers (camera → splat center).
// lodSplatScale is a multiplier on the platform's default splat budget.
// Lower = fewer splats = faster; higher = more detail.
const LOD_TIERS: Array<{ maxDist: number; scale: number }> = [
  { maxDist: 3,   scale: 1.2 },  // close — full+ detail
  { maxDist: 8,   scale: 1.0 },  // mid — platform default
  { maxDist: 16,  scale: 0.7 },  // far — 30% reduction
  { maxDist: Infinity, scale: 0.4 }, // very far — 60% reduction
];

// lodRenderScale: minimum screen-pixel size per splat.
// 2.5 eliminates invisible micro-splats with no perceptible quality loss.
const LOD_RENDER_SCALE = 2.5;

// lodSplatScale applied when the XR session is presenting (limited GPU).
const LOD_XR_SCALE_MULTIPLIER = 0.7;

interface SplatInstance {
  splat: SplatMesh;
  collider: THREE.Group | null;
  animator: GaussianSplatAnimator | null;
  ownsLocomotionEnvironment: boolean;
  ownsPhysicsEnvironment: boolean;
}


// ------------------------------------------------------------
// Component – marks an entity as a Gaussian Splat host
// ------------------------------------------------------------
/**
 * Marks an entity as a Gaussian Splat host. Attach to any entity with an
 * `object3D`; the system will load the splat (and optional collider) as
 * children so they inherit the entity's transform.
 */
export const GaussianSplatLoader = createComponent("GaussianSplatLoader", {
  splatUrl: { type: Types.String, default: "./Example/ModernSpace.spz" },
  meshUrl: { type: Types.String, default: "./Example/ModernSpace.glb" },
  autoLoad: { type: Types.Boolean, default: true },
  animate: { type: Types.Boolean, default: false },
  enableLod: { type: Types.Boolean, default: true },
  lodSplatScale: { type: Types.Float32, default: 1.0 },
});


// ------------------------------------------------------------
// System – loads, unloads, and animates Gaussian Splats
// ------------------------------------------------------------
/**
 * Manages loading, unloading, and animation of Gaussian Splats for entities
 * that carry {@link GaussianSplatLoader}. Auto-loads when `autoLoad` is true;
 * call `load()` / `unload()` / `replayAnimation()` for manual control.
 */
export class GaussianSplatLoaderSystem extends createSystem({
  splats: { required: [GaussianSplatLoader] },
}) {

  // ----------------------------------------------------------
  // State
  // ----------------------------------------------------------
  private instances = new Map<number, SplatInstance>();
  private animating = new Set<number>();
  private gltfLoader = new GLTFLoader();
  private sparkRenderer: SparkRenderer | null = null;


  // ----------------------------------------------------------
  // Initialization
  // ----------------------------------------------------------
  // Cached camera world position for distance calculations
  private _camPos = new THREE.Vector3();
  // Whether XR is currently presenting (lower LOD budget in headset)
  private _xrPresenting = false;

  init() {
    const spark = new SparkRenderer({
      renderer: this.world.renderer,
      enableLod: true,
      lodSplatScale: 1.0,
      // Skip splats smaller than 2.5 screen pixels — indistinguishable
      // at normal viewing distances but eliminates a large fraction of
      // micro-splat draw calls.
      lodRenderScale: LOD_RENDER_SCALE,
      // 3 parallel streaming fetchers (leaves one worker free for decoding).
      numLodFetchers: 3,
      // Aggressively cull splats behind the fovea center in XR.
      behindFoveate: 0.05,
    });
    // Reduce quality 75% outside the central foveal region.
    spark.outsideFoveate = 0.25;
    spark.renderOrder = -10;
    this.world.scene.add(spark);
    this.sparkRenderer = spark;

    // SparkJS driveLod() deep-clones the camera every frame. IWSDK's
    // camera has UIKitDocument children that crash during any copy/clone
    // chain (even non-recursive), so we bypass it entirely and construct
    // a plain PerspectiveCamera with only the transform/projection data
    // SparkJS needs for LoD distance calculations.
    const cam = this.world.camera as THREE.PerspectiveCamera;
    cam.clone = function () {
      const c = new THREE.PerspectiveCamera();
      c.projectionMatrix.copy(this.projectionMatrix);
      c.projectionMatrixInverse.copy(this.projectionMatrixInverse);
      c.matrixWorld.copy(this.matrixWorld);
      c.matrixWorldInverse.copy(this.matrixWorldInverse);
      return c;
    };

    // Track XR presenting state to tighten LOD budget inside the headset.
    this.world.renderer.xr.addEventListener("sessionstart", () => {
      this._xrPresenting = true;
    });
    this.world.renderer.xr.addEventListener("sessionend", () => {
      this._xrPresenting = false;
    });

    this.queries.splats.subscribe("qualify", (entity) => {
      const autoLoad = entity.getValue(
        GaussianSplatLoader,
        "autoLoad",
      ) as boolean;
      if (!autoLoad) return;

      this.load(entity).catch((err) => {
        console.error(
          `[GaussianSplatLoader] Auto-load failed for entity ${entity.index}:`,
          err,
        );
      });
    });
  }


  // ----------------------------------------------------------
  // Frame Loop
  // ----------------------------------------------------------
  update() {
    // --- Dynamic LOD scale based on camera distance + XR mode ---
    if (this.sparkRenderer && this.instances.size > 0) {
      this.world.camera.getWorldPosition(this._camPos);

      // Find the closest loaded splat centre.
      let minDist = Infinity;
      for (const instance of this.instances.values()) {
        const d = this._camPos.distanceTo(
          instance.splat.getWorldPosition(new THREE.Vector3()),
        );
        if (d < minDist) minDist = d;
      }

      // Pick the LOD tier for that distance.
      let scale = LOD_TIERS[LOD_TIERS.length - 1].scale;
      for (const tier of LOD_TIERS) {
        if (minDist <= tier.maxDist) {
          scale = tier.scale;
          break;
        }
      }

      // Apply an extra reduction when rendering inside the headset.
      if (this._xrPresenting) scale *= LOD_XR_SCALE_MULTIPLIER;

      this.sparkRenderer.lodSplatScale = scale;
    }

    // --- Waypoint pin pulse + float animation ---
    updatePins(performance.now() / 1000);

    // --- Animator ticks ---
    if (this.animating.size === 0) return;

    for (const entityIndex of this.animating) {
      const instance = this.instances.get(entityIndex);
      if (!instance?.animator?.isAnimating) {
        this.animating.delete(entityIndex);
        continue;
      }
      instance.animator.tick();
      if (!instance.animator.isAnimating) {
        this.animating.delete(entityIndex);
      }
    }
  }


  // ----------------------------------------------------------
  // Load – fetch the .spz splat (and optional collider mesh)
  // ----------------------------------------------------------
  async load(
    entity: Entity,
    options?: { animate?: boolean },
  ): Promise<void> {
    const splatUrl = entity.getValue(GaussianSplatLoader, "splatUrl") as string;
    const meshUrl = entity.getValue(GaussianSplatLoader, "meshUrl") as string;
    const animate =
      options?.animate ??
      (entity.getValue(GaussianSplatLoader, "animate") as boolean);

    if (!splatUrl) {
      throw new Error(
        `[GaussianSplatLoader] Entity ${entity.index} has an empty splatUrl.`,
      );
    }

    const parent = entity.object3D;
    if (!parent) {
      throw new Error(
        `[GaussianSplatLoader] Entity ${entity.index} has no object3D.`,
      );
    }

    if (this.instances.has(entity.index)) {
      await this.unload(entity, { animate: false });
    }

    const enableLod = entity.getValue(
      GaussianSplatLoader,
      "enableLod",
    ) as boolean;
    const lodSplatScale = entity.getValue(
      GaussianSplatLoader,
      "lodSplatScale",
    ) as number;

    if (this.sparkRenderer && lodSplatScale !== 1.0) {
      this.sparkRenderer.lodSplatScale = lodSplatScale;
    }

    const splat = new SplatMesh({
      url: splatUrl,
      lod: enableLod || undefined,
    });
    const timeout = new Promise<never>((_, reject) => {
      setTimeout(
        () =>
          reject(
            new Error(
              `[GaussianSplatLoader] Timed out loading "${splatUrl}" after ${LOAD_TIMEOUT_MS / 1000}s`,
            ),
          ),
        LOAD_TIMEOUT_MS,
      );
    });
    await Promise.race([splat.initialized, timeout]);

    let collider: THREE.Group | null = null;
    if (meshUrl) {
      const gltf = await this.gltfLoader.loadAsync(meshUrl);
      collider = gltf.scene;
      collider.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) child.visible = false;
      });
    }

    const animator = new GaussianSplatAnimator(splat);
    animator.apply();
    if (!animate) animator.setProgress(1);

    // Render splats behind UI panels (which use AlwaysDepth + high renderOrder)
    splat.renderOrder = -10;
    parent.add(splat);
    if (collider) parent.add(collider);

    let ownsLocomotionEnvironment = false;
    let ownsPhysicsEnvironment = false;
    if (collider) {
      this.refreshLocomotionEnvironment(entity, EnvironmentType.STATIC);
      this.refreshPhysicsEnvironment(entity);
      ownsLocomotionEnvironment = true;
      ownsPhysicsEnvironment = true;
    }

    this.instances.set(entity.index, {
      splat,
      collider,
      animator,
      ownsLocomotionEnvironment,
      ownsPhysicsEnvironment,
    });
    console.log(
      `[GaussianSplatLoader] Loaded splat for entity ${entity.index}` +
        `${collider ? " (with collider)" : ""}`,
    );

    if (animate) {
      this.animating.add(entity.index);
      await animator.animateIn();
    }
  }


  // ----------------------------------------------------------
  // Replay – restart the fly-in animation on an existing splat
  // ----------------------------------------------------------
  async replayAnimation(
    entity: Entity,
    options?: { duration?: number },
  ): Promise<void> {
    const instance = this.instances.get(entity.index);
    if (!instance?.animator) return;

    instance.animator.stop();
    instance.animator.setProgress(0);
    this.animating.add(entity.index);
    await instance.animator.animateIn(options?.duration);
  }


  // ----------------------------------------------------------
  // Unload – remove the splat (and collider) from the scene
  // ----------------------------------------------------------
  async unload(
    entity: Entity,
    options?: { animate?: boolean },
  ): Promise<void> {
    const instance = this.instances.get(entity.index);
    if (!instance) return;

    const animate =
      options?.animate ??
      (entity.getValue(GaussianSplatLoader, "animate") as boolean);

    if (animate && instance.animator) {
      this.animating.add(entity.index);
      await instance.animator.animateOut();
    }

    this.removeInstance(entity.index);
  }


  // ----------------------------------------------------------
  // Cleanup – dispose GPU resources and detach from the scene
  // ----------------------------------------------------------
  private removeInstance(entityIndex: number): void {
    const instance = this.instances.get(entityIndex);
    if (!instance) return;

    this.animating.delete(entityIndex);
    instance.animator?.dispose();

    const entity = this.world.entityManager.getEntityByIndex(entityIndex);
    if (instance.ownsLocomotionEnvironment && entity) {
      entity.removeComponent(LocomotionEnvironment);
    }
    if (instance.ownsPhysicsEnvironment && entity) {
      entity.removeComponent(PhysicsBody);
      entity.removeComponent(PhysicsShape);
    }

    instance.splat.parent?.remove(instance.splat);
    instance.splat.dispose();

    if (instance.collider) {
      instance.collider.parent?.remove(instance.collider);
      instance.collider.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          mesh.geometry.dispose();
          const materials = Array.isArray(mesh.material)
            ? mesh.material
            : [mesh.material];
          for (const mat of materials) mat.dispose();
        }
      });
    }

    this.instances.delete(entityIndex);
    console.log(
      `[GaussianSplatLoader] Unloaded splat for entity ${entityIndex}`,
    );
  }

  private refreshLocomotionEnvironment(
    entity: Entity,
    type: string,
  ): void {
    if (entity.hasComponent(LocomotionEnvironment)) {
      entity.removeComponent(LocomotionEnvironment);
    }

    entity.addComponent(LocomotionEnvironment, { type });
  }

  private refreshPhysicsEnvironment(entity: Entity): void {
    if (entity.hasComponent(PhysicsBody)) {
      entity.removeComponent(PhysicsBody);
    }
    if (entity.hasComponent(PhysicsShape)) {
      entity.removeComponent(PhysicsShape);
    }

    entity
      .addComponent(PhysicsShape, {
        shape: PhysicsShapeType.TriMesh,
        friction: 0.9,
        restitution: 0.0,
      })
      .addComponent(PhysicsBody, {
        state: PhysicsState.Static,
      });
  }
}
