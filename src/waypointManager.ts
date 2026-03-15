import * as THREE from "three";

export interface Waypoint {
  x: number;
  z: number;
  y?: number;
  label?: string;
  priority?: "high" | "medium" | "low";
}

const WORLD_SCALE = 5;
const PIN_HEIGHT = 1.6; // eye height in metres

const PRIORITY_COLOR: Record<string, number> = {
  high:   0xff2222,
  medium: 0xff8800,
  low:    0x00ff88,
};
const PRIORITY_EMISSIVE: Record<string, number> = {
  high:   0x660000,
  medium: 0x442200,
  low:    0x004422,
};

interface PinData {
  group: THREE.Group;
  sphereMat: THREE.MeshStandardMaterial;
  light: THREE.PointLight;
  pulseSpeed: number;
  pulsePhase: number;
}

const activePins: PinData[] = [];

function buildPin(wp: Waypoint): PinData {
  const p   = wp.priority ?? "low";
  const col = PRIORITY_COLOR[p]   ?? 0xffffff;
  const emi = PRIORITY_EMISSIVE[p] ?? 0x222222;
  const group = new THREE.Group();

  // Glowing sphere
  const sphereMat = new THREE.MeshStandardMaterial({
    color: col,
    emissive: emi,
    emissiveIntensity: 1.5,
    roughness: 0.1,
    metalness: 0.8,
  });
  const sphere = new THREE.Mesh(
    new THREE.SphereGeometry(0.18, 32, 32),
    sphereMat,
  );
  sphere.castShadow = true;
  group.add(sphere);

  // Vertical pole
  const poleMat = new THREE.MeshStandardMaterial({
    color: col,
    emissive: emi,
    emissiveIntensity: 0.5,
    transparent: true,
    opacity: 0.7,
  });
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.025, 0.025, 1.5, 8),
    poleMat,
  );
  pole.position.y = -0.75;
  group.add(pole);

  // Point light halo
  const light = new THREE.PointLight(col, 1.5, 3.0);
  group.add(light);

  return {
    group,
    sphereMat,
    light,
    pulseSpeed: 2.0 + Math.random() * 0.5,
    pulsePhase: Math.random() * Math.PI * 2,
  };
}

function animatePinIn(group: THREE.Group): void {
  const duration = 400;
  const start = Date.now();

  function tick() {
    const t = Math.min((Date.now() - start) / duration, 1);
    // Elastic ease-out
    const s =
      t === 1
        ? 1
        : 1 - Math.pow(2, -10 * t) * Math.cos(t * Math.PI * 4);
    group.scale.setScalar(s);
    if (t < 1) requestAnimationFrame(tick);
  }
  tick();
}

export function placePins(waypoints: Waypoint[], scene: THREE.Scene): void {
  clearPins(scene);

  waypoints.forEach((wp, i) => {
    const pin = buildPin(wp);
    pin.group.position.set(
      wp.x * WORLD_SCALE,
      PIN_HEIGHT,
      wp.z * WORLD_SCALE,
    );
    pin.group.scale.setScalar(0);
    scene.add(pin.group);
    activePins.push(pin);

    setTimeout(() => animatePinIn(pin.group), i * 300);

    console.log(
      `[Pin] ${wp.label ?? "waypoint"} at (${wp.x.toFixed(2)}, ${wp.z.toFixed(2)})` +
        ` priority: ${wp.priority ?? "low"}`,
    );
  });

  console.log(`[Pins] ${waypoints.length} waypoints placed`);
}

/** Call every frame with `Date.now() / 1000` to pulse and float pins. */
export function updatePins(time: number): void {
  for (const pin of activePins) {
    const pulse = (Math.sin(time * pin.pulseSpeed + pin.pulsePhase) + 1) / 2;
    pin.sphereMat.emissiveIntensity = 1.0 + pulse * 1.5;
    pin.light.intensity = 1.0 + pulse * 1.5;
    pin.group.position.y = PIN_HEIGHT + Math.sin(time * 1.5 + pin.pulsePhase) * 0.08;
  }
}

export function clearPins(scene: THREE.Scene): void {
  for (const pin of activePins) {
    scene.remove(pin.group);
    pin.group.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const m = child as THREE.Mesh;
        m.geometry.dispose();
        const mats = Array.isArray(m.material) ? m.material : [m.material];
        mats.forEach((mat) => mat.dispose());
      }
    });
  }
  activePins.length = 0;
}
