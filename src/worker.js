import { buildScene, getColor } from './tracer.js';

let scene = null;

// Traces rows y0 to y1 of a picture shrunk down by scale (8 means one ray per 8x8 block).
// jitter nudges each ray inside its pixel, so many samples average into smooth edges.
function trace({ width, height, scale, jitter, y0, y1 }) {
  const columns = Math.ceil(width / scale);
  const data = new Float32Array(columns * (y1 - y0) * 3);
  let i = 0;
  for (let row = y0; row < y1; row++) {
    const y = row * scale + scale / 2 + jitter[1];
    for (let column = 0; column < columns; column++) {
      const color = getColor(scene, column * scale + scale / 2 + jitter[0], y, width, height);
      data[i++] = color.r;
      data[i++] = color.g;
      data[i++] = color.b;
    }
  }
  return data;
}

self.onmessage = ({ data: message }) => {
  if (message.type === 'scene') {
    scene = buildScene(message.spec);
    return;
  }
  const data = trace(message.job);
  self.postMessage({ id: message.id, data }, [data.buffer]);
};
