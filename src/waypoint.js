import {
  createComponent,
  createSystem,
  Types,
  Vector3,
  Mesh,
  SphereGeometry,
  CylinderGeometry,
  MeshBasicMaterial,
  Group,
} from '@iwsdk/core';

// -- Waypoint Component --
export const Waypoint = createComponent('Waypoint', {
  priority: { type: Types.String, default: 'medium' }, // high | medium | low
  label: { type: Types.String, default: '' },
  note: { type: Types.String, default: '' },
  pulsePhase: { type: Types.Float32, default: 0 },
  baseY: { type: Types.Float32, default: 1.6 },
  animProgress: { type: Types.Float32, default: 0 }, // 0-1 for spawn-in animation
  spawning: { type: Types.Boolean, default: true },
});

// Priority colors
const COLORS = {
  high: 0xff2222,
  medium: 0xff8800,
  low: 0x00ff88,
};

/**
 * Creates a waypoint pin mesh group.
 * @param {string} priority - high | medium | low
 * @returns {Group}
 */
export function createWaypointMesh(priority) {
  const color = COLORS[priority] || 0xffffff;
  const group = new Group();

  // Glowing sphere
  const sphere = new Mesh(
    new SphereGeometry(0.18, 8, 8),
    new MeshBasicMaterial({ color }),
  );
  group.add(sphere);

  // Vertical pole
  const pole = new Mesh(
    new CylinderGeometry(0.02, 0.02, 2, 4),
    new MeshBasicMaterial({ color, transparent: true, opacity: 0.7 }),
  );
  pole.position.set(0, -1, 0);
  group.add(pole);

  return group;
}

// -- Waypoint System: handles bob animation and spawn-in --
export class WaypointSystem extends createSystem({
  waypoints: { required: [Waypoint] },
}) {
  init() {
    this._vec = new Vector3();
  }

  update(delta, time) {
    for (const entity of this.queries.waypoints.entities) {
      const phase = entity.getValue(Waypoint, 'pulsePhase');
      const baseY = entity.getValue(Waypoint, 'baseY');
      const spawning = entity.getValue(Waypoint, 'spawning');

      if (spawning) {
        // Spawn-in elastic animation
        let t = entity.getValue(Waypoint, 'animProgress');
        t = Math.min(t + delta * 2.0, 1.0); // ~0.5s duration
        entity.setValue(Waypoint, 'animProgress', t);

        const s =
          t < 1
            ? 1 - Math.pow(2, -10 * t) * Math.cos(t * Math.PI * 3.5)
            : 1;
        entity.object3D.scale.setScalar(s);

        if (t >= 1) {
          entity.setValue(Waypoint, 'spawning', false);
        }
      }

      // Bob animation
      const bobY = baseY + Math.sin(time * 1.5 + phase) * 0.08;
      entity.object3D.position.y = bobY;
    }
  }
}
