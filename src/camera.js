// An orbit camera: it circles a target point, like a drone on a leash.
// yaw spins around the vertical (z) axis, pitch tilts up and down, both in radians.

const MIN_DISTANCE = 8;
const MAX_DISTANCE = 70;
const MAX_PITCH = (80 * Math.PI) / 180;
const LOWEST_PITCH = (-10 * Math.PI) / 180;

const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;

function normalize(v) {
  const length = Math.sqrt(dot(v, v));
  return { x: v.x / length, y: v.y / length, z: v.z / length };
}

// Finds the orbit that matches a camera at position looking along direction,
// circling the point on its line of sight that's closest to focus.
export function orbitFrom(position, direction, focus) {
  const d = normalize(direction);
  const distance = dot({ x: focus.x - position.x, y: focus.y - position.y, z: focus.z - position.z }, d);
  return {
    target: { x: position.x + d.x * distance, y: position.y + d.y * distance, z: position.z + d.z * distance },
    yaw: Math.atan2(-d.y, -d.x),
    pitch: Math.asin(-d.z),
    distance
  };
}

// Keeps the camera a sensible distance away and above the floor at floorZ.
export function clampOrbit(orbit, floorZ) {
  const distance = Math.min(MAX_DISTANCE, Math.max(MIN_DISTANCE, orbit.distance));
  const floorPitch = Math.asin(Math.max(-1, Math.min(1, (floorZ + 0.5 - orbit.target.z) / distance)));
  const pitch = Math.min(MAX_PITCH, Math.max(LOWEST_PITCH, floorPitch, orbit.pitch));
  return { ...orbit, distance, pitch };
}

export function cameraFromOrbit({ target, yaw, pitch, distance }) {
  const back = {
    x: Math.cos(pitch) * Math.cos(yaw),
    y: Math.cos(pitch) * Math.sin(yaw),
    z: Math.sin(pitch)
  };
  return {
    position: { x: target.x + back.x * distance, y: target.y + back.y * distance, z: target.z + back.z * distance },
    direction: { x: -back.x, y: -back.y, z: -back.z }
  };
}
