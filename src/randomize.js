// Makes a new scene with random spheres, keeping the sky, sun, camera and floor of the old one.

const COLORS = ['#f87171', '#fb923c', '#facc15', '#4ade80', '#2dd4bf', '#38bdf8', '#818cf8', '#c084fc', '#f472b6'];
const FLOORS = ['#77ff77', '#94a3b8', '#fde68a', '#5eead4', '#c4b5fd', '#fda4af'];
const SUN = '#fff3dc';

// mirror spheres are mostly reflection, matte ones mostly color
const MATERIALS = [
  { name: 'mirror', diffuse: 0.1, reflect: 0.9 },
  { name: 'glossy', diffuse: 0.75, reflect: 0.25 },
  { name: 'glossy', diffuse: 0.75, reflect: 0.25 },
  { name: 'matte', diffuse: 0.95, reflect: 0.05 }
];

const pick = (list, random) => list[Math.floor(random() * list.length)];

export function randomizeScene(spec, { center = { x: 0, y: 20 }, random = Math.random } = {}) {
  const floor = spec.objects.find((object) => object.type === 'plane');
  const floorZ = floor ? floor.point.z : 0;
  const count = 4 + Math.floor(random() * 4);

  const spheres = [];
  for (let tries = 0; spheres.length < count && tries < 500; tries++) {
    const radius = 1.2 + random() * 2.8;
    const x = center.x + (random() * 2 - 1) * 11;
    const y = center.y + (random() * 2 - 1) * 9;
    const overlaps = spheres.some((other) => Math.hypot(other.center.x - x, other.center.y - y) < other.radius + radius + 0.3);
    if (overlaps) continue;

    // the first one is always a mirror so there's something fun to look at
    const material = spheres.length === 0 ? MATERIALS[0] : pick(MATERIALS, random);
    spheres.push({
      type: 'sphere',
      diffuse: material.diffuse,
      reflect: material.reflect,
      color: material.name === 'mirror' ? '#e2e8f0' : pick(COLORS, random),
      // resting on the floor
      center: { x, y, z: floorZ + radius },
      radius
    });
  }

  // a whiter sun than the classic yellow one, so blue and purple spheres don't come out muddy
  const objects = spec.objects
    .filter((object) => object.type !== 'sphere')
    .map((object) => {
      if (object === floor) return { ...floor, color: pick(FLOORS, random) };
      if (object.type === 'light') return { ...object, color: SUN };
      return object;
    });

  return { ...spec, objects: [...objects, ...spheres] };
}
