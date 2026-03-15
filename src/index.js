// Scout — AI Spatial Intelligence Agent on IWSDK
// Entry point: creates the VR world, registers Scout systems, loads splat worlds

import {
  AssetManager,
  Mesh,
  MeshBasicMaterial,
  BoxGeometry,
  SphereGeometry,
  PlaneGeometry,
  SessionMode,
  World,
  Group,
  AmbientLight,
  DirectionalLight,
  Interactable,
  PanelUI,
  VisibilityState,
  EnvironmentType,
  LocomotionEnvironment,
  Follower,
  FollowBehavior,
} from '@iwsdk/core';
import { SplatMesh } from '@sparkjsdev/spark';

import { PanelSystem } from './panel.js';
import { ScoutSystem } from './scout.js';
import { WaypointSystem } from './waypoint.js';

// -- Single world: Cyberpunk Rooftop --
const WORLD_SPLAT = '/worlds/cyberpunk_rooftop.spz';
const WORLD_COLLIDER = '/worlds/cyberpunk_rooftop_collider.glb';

// Shared state
let currentSplat = null;
let currentColliderEntity = null;
let iwsdkWorld = null;
let splatEntity = null;
export let placeholderGroup = null;

async function loadWorld() {
  // Load splat
  console.log('Loading splat:', WORLD_SPLAT);
  try {
    const splat = new SplatMesh({ url: WORLD_SPLAT });
    splat.name = 'splat_cyberpunk';
    currentSplat = splat;
    splatEntity = iwsdkWorld.createTransformEntity(splat);
    console.log('Splat loaded: cyberpunk_rooftop');
  } catch (err) {
    console.warn('Splat load failed, using placeholder:', err);
    buildCyberpunkPlaceholder(placeholderGroup);
  }

  // Load collider GLB
  console.log('Loading collider:', WORLD_COLLIDER);
  try {
    const gltf = await AssetManager.loadGLTF(WORLD_COLLIDER);
    const colliderGroup = gltf.scene;
    colliderGroup.name = 'collider_world';
    colliderGroup.visible = false;
    currentColliderEntity = iwsdkWorld
      .createTransformEntity(colliderGroup)
      .addComponent(LocomotionEnvironment, { type: EnvironmentType.STATIC });
    console.log('Collider loaded: cyberpunk_rooftop');
  } catch (err) {
    console.warn('Collider load failed:', err);
  }
}

// Minimal placeholder fallback (cyberpunk only)
function buildCyberpunkPlaceholder(group) {
  const concrete = new MeshBasicMaterial({ color: 0x1a1a1a });
  group.add(makeMesh(new BoxGeometry(25, 0.3, 25), concrete, 0, -0.15, 0));
  [[-5,-5],[5,-5],[-5,5],[5,5],[0,-8]].forEach(([x,z]) => {
    group.add(makeMesh(new BoxGeometry(2.5, 1.8, 2.5), concrete, x, 0.9, z));
  });
}

function makeMesh(geo, mat, x, y, z) {
  const m = new Mesh(geo, mat);
  m.position.set(x, y, z);
  return m;
}

// -- IWSDK World Setup --
World.create(document.getElementById('scene-container'), {
  assets: {},
  xr: {
    sessionMode: SessionMode.ImmersiveVR,
    offer: 'always',
    features: { handTracking: true, layers: true },
  },
  features: {
    locomotion: { useWorker: true },
    grabbing: false,
    physics: false,
    sceneUnderstanding: false,
    environmentRaycast: false,
  },
}).then((world) => {
  iwsdkWorld = world;
  const { camera } = world;

  // Camera position
  camera.position.set(0, 1.6, 3);

  // Lighting
  const ambient = new AmbientLight(0x334466, 2.0);
  world.createTransformEntity(ambient);

  const sun = new DirectionalLight(0xffffff, 1.5);
  sun.position.set(10, 20, 10);
  world.createTransformEntity(sun);

  // Environment sphere (dark background)
  const envSphere = new Mesh(
    new SphereGeometry(50, 8, 6),
    new MeshBasicMaterial({ color: 0x000814, side: 2 }),
  );
  world.createTransformEntity(envSphere);

  // Floor - invisible but needed for locomotion
  const floor = new Mesh(
    new PlaneGeometry(200, 200),
    new MeshBasicMaterial({ visible: false }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0;
  world
    .createTransformEntity(floor)
    .addComponent(LocomotionEnvironment, { type: EnvironmentType.STATIC });

  // Placeholder group (fallback container)
  placeholderGroup = new Group();
  placeholderGroup.name = 'placeholder_world';
  world.createTransformEntity(placeholderGroup);

  // Load cyberpunk world
  loadWorld();

  // Welcome panel with Enter XR button
  const welcomeEntity = world
    .createTransformEntity()
    .addComponent(PanelUI, {
      config: './ui/welcome.json',
      maxHeight: 0.6,
      maxWidth: 1.2,
    })
    .addComponent(Interactable);
  welcomeEntity.object3D.position.set(0, 1.4, -1.5);

  // Scout HUD panel - follows user's head in VR via Follower component
  const hudEntity = world
    .createTransformEntity()
    .addComponent(PanelUI, {
      config: './ui/scout-hud.json',
      maxHeight: 0.8,
      maxWidth: 1.6,
    })
    .addComponent(Interactable)
    .addComponent(Follower, {
      target: world.player.head,
      offsetPosition: [-0.4, -0.15, -1.2],
      behavior: FollowBehavior.PivotY,
      speed: 3,
      tolerance: 0.15,
      maxAngle: 25,
    });

  // HTML Enter VR button fallback
  const enterVrBtn = document.getElementById('btn-enter-vr');
  if (enterVrBtn) {
    if (navigator.xr) {
      navigator.xr.isSessionSupported('immersive-vr').then((supported) => {
        if (supported) {
          enterVrBtn.style.display = 'block';
          enterVrBtn.addEventListener('click', () => {
            world.launchXR();
            enterVrBtn.style.display = 'none';
          });
        }
      });
    }
    world.visibilityState.subscribe((state) => {
      if (state !== VisibilityState.NonImmersive) {
        enterVrBtn.style.display = 'none';
      } else {
        enterVrBtn.style.display = 'block';
      }
    });
  }

  // Register systems
  world
    .registerSystem(PanelSystem)
    .registerSystem(WaypointSystem)
    .registerSystem(ScoutSystem);

  console.log('Scout IWSDK world initialized - Cyberpunk Rooftop');
});
