import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { parseProperties } from '../src/properties.js';
import { getColor, loadScene } from '../src/tracer.js';

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
