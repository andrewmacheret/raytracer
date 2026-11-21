import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { cameraFromOrbit, clampOrbit, orbitFrom } from '../src/camera.js';
import { parseProperties } from '../src/properties.js';
import { shuffleScene } from '../src/shuffle.js';
import { buildScene, getColor, loadScene, readScene } from '../src/tracer.js';

const text = readFileSync(new URL('../app.properties', import.meta.url), 'utf8');

test('parseProperties reads sections, skips comments, and parses booleans', () => {
  const properties = parseProperties('# comment\n[scene]\ndepth = 8;\nobject.1.inverse = false\n');
  assert.equal(properties.get('scene.depth'), '8;');
  assert.equal(properties.get('scene.object.1.inverse'), false);
  assert.equal(properties.size, 2);
});

test('app.properties has one light and five objects', () => {
  const scene = loadScene(parseProperties(text));
  assert.equal(scene.depth, 8);
  assert.equal(scene.lights.length, 1);
  assert.deepEqual(scene.objects.map((o) => o.type), ['plane', 'sphere', 'sphere', 'sphere', 'sphere']);
});

test('the sky, the spheres and the floor come out as different colors', () => {
  const scene = loadScene(parseProperties(text));
  const size = 400;
  const at = (x, y) => {
    const { r, g, b } = getColor(scene, x, y, size, size);
    return [r, g, b].map(Math.round).join(',');
  };
  const top = at(size / 2, 5);
  const middle = at(size / 2, size / 2);
  const bottom = at(size / 2, size - 5);
  assert.equal(new Set([top, middle, bottom]).size, 3, `top=${top} middle=${middle} bottom=${bottom}`);
  for (const color of [top, middle, bottom]) {
    for (const channel of color.split(',').map(Number)) {
      assert.ok(channel >= 0 && channel <= 255);
    }
  }
});

test('an orbit made from a camera puts the camera back where it was', () => {
  const position = { x: 0, y: 0, z: 15 };
  const direction = { x: 0, y: 2, z: -1 };
  const orbit = orbitFrom(position, direction, { x: 0, y: 20, z: 3.25 });
  const camera = cameraFromOrbit(orbit);
  for (const axis of ['x', 'y', 'z']) {
    assert.ok(Math.abs(camera.position[axis] - position[axis]) < 1e-9, `position.${axis}`);
    assert.ok(Math.abs(camera.direction[axis] - direction[axis] / Math.sqrt(5)) < 1e-9, `direction.${axis}`);
  }
});

test('clampOrbit keeps the camera above the floor and within zoom limits', () => {
  const orbit = clampOrbit({ target: { x: 0, y: 20, z: 3 }, yaw: 0, pitch: -1.5, distance: 500 }, -1);
  assert.ok(cameraFromOrbit(orbit).position.z > -1);
  assert.ok(orbit.distance <= 70);
  assert.ok(clampOrbit({ ...orbit, distance: 0.1 }, -1).distance >= 8);
});

test('shuffleScene puts non-overlapping spheres on the floor and keeps the rest', () => {
  const spec = readScene(parseProperties(text));
  let seed = 1;
  const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let round = 0; round < 20; round++) {
    const shuffled = shuffleScene(spec, { random });
    const spheres = shuffled.objects.filter((o) => o.type === 'sphere');
    assert.ok(spheres.length >= 4 && spheres.length <= 7);
    assert.equal(spheres[0].reflect, 0.9);
    for (const [i, a] of spheres.entries()) {
      assert.ok(Math.abs(a.center.z - a.radius - -1) < 1e-9, 'resting on the floor');
      for (const b of spheres.slice(i + 1)) {
        assert.ok(Math.hypot(a.center.x - b.center.x, a.center.y - b.center.y) > a.radius + b.radius);
      }
    }
    assert.deepEqual(shuffled.objects.filter((o) => o.type !== 'sphere').map((o) => o.type), ['light', 'plane']);
    assert.doesNotThrow(() => buildScene(shuffled));
  }
});

test('the mirror floor reflects the sky', () => {
  const spec = readScene(parseProperties(text));
  // looking down at the floor, facing away from the sun
  const camera = { ...spec.camera, position: { x: 0, y: 0, z: 5 }, direction: { x: 0, y: -1, z: -1 } };
  const objects = spec.objects.filter((o) => o.type !== 'sphere');
  const brightness = (sky) => {
    const scene = buildScene({ ...spec, sky, camera, objects });
    const { r, g, b } = getColor(scene, 200, 200, 400, 400);
    return r + g + b;
  };
  assert.ok(brightness({ color: '#ffffff' }) > brightness({ color: '#000000' }));
});
