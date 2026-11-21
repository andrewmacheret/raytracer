import sceneText from '../app.properties?raw';
import { cameraFromOrbit, clampOrbit, orbitFrom } from './camera.js';
import { parseProperties } from './properties.js';
import { MAX_SAMPLES, createRenderer } from './renderer.js';
import { randomizeScene } from './randomize.js';
import { readScene } from './tracer.js';
import './index.css';

// past this many pixels the canvas renders at a lower resolution and gets stretched
const MAX_PIXELS = 2_000_000;
const DRAG_SPEED = 0.006; // radians per pixel dragged
const KEY_STEP = (5 * Math.PI) / 180;

const classicScene = readScene(parseProperties(sceneText));
const floorZ = classicScene.objects.find((object) => object.type === 'plane').point.z;
const sphereCenters = classicScene.objects.filter((object) => object.type === 'sphere').map((object) => object.center);
const focus = {
  x: sphereCenters.reduce((sum, c) => sum + c.x, 0) / sphereCenters.length,
  y: sphereCenters.reduce((sum, c) => sum + c.y, 0) / sphereCenters.length,
  z: sphereCenters.reduce((sum, c) => sum + c.z, 0) / sphereCenters.length
};
// start a bit further back and lower than app.properties, so the wide picture shows the horizon
const classicOrbit = (() => {
  const orbit = orbitFrom(classicScene.camera.position, classicScene.camera.direction, focus);
  return { ...orbit, yaw: orbit.yaw - 0.25, pitch: 0.3, distance: orbit.distance * 1.45 };
})();

let scene = classicScene;
let orbit = classicOrbit;
let reflections = classicScene.depth - 1;

const canvas = document.getElementById('canvas');
const hint = document.getElementById('hint');
const status = document.getElementById('status');
const statusValue = document.getElementById('status-value');
const statusLabel = document.getElementById('status-label');
const progress = document.getElementById('progress');
const bounces = document.getElementById('bounces');
const bouncesValue = document.getElementById('bounces-value');

const renderer = createRenderer(canvas, {
  onProgress({ progress: amount, done, samples, seconds, threads }) {
    const percent = Math.floor(amount * 100);
    status.classList.toggle('good', done);
    progress.classList.toggle('done', done);
    progress.setAttribute('aria-valuenow', String(percent));
    progress.firstElementChild.style.width = percent + '%';
    if (done) {
      statusValue.textContent = seconds < 10 ? seconds.toFixed(1) + ' s' : Math.round(seconds) + ' s';
      statusLabel.textContent = `on ${threads} ${threads === 1 ? 'thread' : 'threads'}`;
      status.title = `${MAX_SAMPLES} rays per pixel, traced on ${threads} CPU threads`;
    } else {
      statusValue.textContent = percent + '%';
      statusLabel.textContent = samples ? `sample ${samples + 1} of ${MAX_SAMPLES}` : 'tracing';
      status.title = '';
    }
  }
});

function draw() {
  const camera = { ...scene.camera, ...cameraFromOrbit(orbit) };
  renderer.render({ ...scene, depth: reflections + 1, camera });
}

function moveCamera(change) {
  orbit = clampOrbit({ ...orbit, ...change(orbit) }, floorZ);
  hint.classList.add('hidden');
  draw();
}

// match the canvas resolution to its size on screen
new ResizeObserver(() => {
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  let width = Math.round(canvas.clientWidth * ratio);
  let height = Math.round(canvas.clientHeight * ratio);
  if (width * height > MAX_PIXELS) {
    const shrink = Math.sqrt(MAX_PIXELS / (width * height));
    width = Math.round(width * shrink);
    height = Math.round(height * shrink);
  }
  if (!width || !height || (width === canvas.width && height === canvas.height)) return;
  canvas.width = width;
  canvas.height = height;
  draw();
}).observe(canvas);

// dragging with one finger or the mouse orbits, two fingers pinch to zoom
const pointers = new Map();
let pinchDistance = 0;

const spread = () => {
  const [a, b] = [...pointers.values()];
  return Math.hypot(a.x - b.x, a.y - b.y);
};

canvas.addEventListener('pointerdown', (event) => {
  canvas.setPointerCapture(event.pointerId);
  pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  if (pointers.size === 2) pinchDistance = spread();
  canvas.classList.add('grabbing');
});

canvas.addEventListener('pointermove', (event) => {
  const last = pointers.get(event.pointerId);
  if (!last) return;
  const dx = event.clientX - last.x;
  const dy = event.clientY - last.y;
  pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

  if (pointers.size === 1) {
    moveCamera(({ yaw, pitch }) => ({ yaw: yaw - dx * DRAG_SPEED, pitch: pitch + dy * DRAG_SPEED }));
  } else if (pointers.size === 2) {
    const distance = spread();
    const ratio = pinchDistance / distance;
    pinchDistance = distance;
    moveCamera(({ distance: d }) => ({ distance: d * ratio }));
  }
});

function endPointer(event) {
  pointers.delete(event.pointerId);
  if (pointers.size === 2) pinchDistance = spread();
  if (pointers.size === 0) canvas.classList.remove('grabbing');
}
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);

canvas.addEventListener('wheel', (event) => {
  event.preventDefault();
  moveCamera(({ distance }) => ({ distance: distance * Math.exp(event.deltaY * 0.002) }));
}, { passive: false });

canvas.addEventListener('keydown', (event) => {
  const moves = {
    ArrowLeft: ({ yaw }) => ({ yaw: yaw + KEY_STEP }),
    ArrowRight: ({ yaw }) => ({ yaw: yaw - KEY_STEP }),
    ArrowUp: ({ pitch }) => ({ pitch: pitch + KEY_STEP }),
    ArrowDown: ({ pitch }) => ({ pitch: pitch - KEY_STEP }),
    '+': ({ distance }) => ({ distance: distance / 1.15 }),
    '=': ({ distance }) => ({ distance: distance / 1.15 }),
    '-': ({ distance }) => ({ distance: distance * 1.15 })
  };
  const move = moves[event.key];
  if (!move) return;
  event.preventDefault();
  moveCamera(move);
});

function showReflections() {
  bounces.value = String(reflections);
  bouncesValue.textContent = String(reflections);
  bounces.setAttribute('aria-valuetext', `${reflections} ${reflections === 1 ? 'reflection' : 'reflections'}`);
}

bounces.addEventListener('input', () => {
  reflections = Number(bounces.value);
  showReflections();
  draw();
});

document.getElementById('reset').addEventListener('click', () => {
  scene = classicScene;
  orbit = classicOrbit;
  draw();
});

document.getElementById('randomize').addEventListener('click', () => {
  scene = randomizeScene(classicScene, { center: orbit.target });
  draw();
});

document.getElementById('save').addEventListener('click', () => {
  canvas.toBlob((blob) => {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'raytracer.png';
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  });
});

showReflections();
