// Traces the scene on a pool of web workers and paints it in passes:
// big blocks first so moving the camera feels quick, then full detail,
// then extra samples per pixel that average out the jagged edges.

const BLOCK_SCALES = [8, 4, 2];
export const MAX_SAMPLES = 16;
// small chunks so a camera move doesn't wait long for old work to finish
const CHUNK_PIXELS = 4096;
const JOBS_PER_WORKER = 2;

// spreads sample positions evenly around the pixel
function halton(index, base) {
  let fraction = 1;
  let result = 0;
  while (index > 0) {
    fraction /= base;
    result += fraction * (index % base);
    index = Math.floor(index / base);
  }
  return result;
}

const PASSES = [
  ...BLOCK_SCALES.map((scale) => ({ scale, jitter: [0, 0], sample: false })),
  ...Array.from({ length: MAX_SAMPLES }, (_, i) => ({
    scale: 1,
    jitter: i === 0 ? [0, 0] : [halton(i, 2) - 0.5, halton(i, 3) - 0.5],
    sample: true
  }))
];

export function createRenderer(canvas, { onProgress }) {
  const context = canvas.getContext('2d');
  const threads = Math.max(1, Math.min(navigator.hardwareConcurrency || 4, 16));
  const workers = Array.from({ length: threads }, () => {
    const worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
    worker.inFlight = 0;
    worker.onmessage = ({ data }) => {
      worker.inFlight--;
      finishJob(data);
      pump();
    };
    return worker;
  });

  // jobs carry the render they belong to, so results from an old camera are thrown away
  let render = null;
  let nextJobId = 0;
  const jobs = new Map();
  let queuedSpec = null;
  let frameRequested = false;

  let width = 0;
  let height = 0;
  let sums = null;
  let counts = null;
  let image = null;
  const blockCanvas = document.createElement('canvas');
  const blockContext = blockCanvas.getContext('2d');

  function passPixels(pass) {
    return Math.ceil(width / pass.scale) * Math.ceil(height / pass.scale);
  }

  function setSize() {
    if (width === canvas.width && height === canvas.height) return;
    width = canvas.width;
    height = canvas.height;
    sums = new Float32Array(width * height * 3);
    counts = new Uint16Array(height);
    image = context.createImageData(width, height);
    image.data.fill(255);
  }

  function start(spec) {
    setSize();
    counts.fill(0);
    workers.forEach((worker) => worker.postMessage({ type: 'scene', spec }));
    render = {
      queue: [],
      pending: 0,
      passIndex: -1,
      donePixels: 0,
      totalPixels: PASSES.reduce((total, pass) => total + passPixels(pass), 0),
      startTime: performance.now()
    };
    nextPass();
  }

  function nextPass() {
    render.passIndex++;
    const pass = PASSES[render.passIndex];
    if (!pass) {
      render.done = true;
      report();
      return;
    }
    const columns = Math.ceil(width / pass.scale);
    const rows = Math.ceil(height / pass.scale);
    const rowsPerChunk = Math.max(1, Math.floor(CHUNK_PIXELS / columns));
    if (!pass.sample) {
      blockCanvas.width = columns;
      blockCanvas.height = rows;
    }
    for (let y0 = 0; y0 < rows; y0 += rowsPerChunk) {
      render.queue.push({ width, height, scale: pass.scale, jitter: pass.jitter, y0, y1: Math.min(rows, y0 + rowsPerChunk) });
    }
    render.pending = render.queue.length;
    pump();
  }

  function pump() {
    for (const worker of workers) {
      while (render && worker.inFlight < JOBS_PER_WORKER && render.queue.length) {
        const job = render.queue.shift();
        const id = nextJobId++;
        jobs.set(id, { job, render, pass: PASSES[render.passIndex] });
        worker.inFlight++;
        worker.postMessage({ type: 'job', id, job });
      }
    }
  }

  function finishJob({ id, data }) {
    const { job, render: jobRender, pass } = jobs.get(id);
    jobs.delete(id);
    if (jobRender !== render) return;

    if (pass.sample) {
      addSamples(job, data);
    } else {
      drawBlocks(job, data);
    }

    render.donePixels += data.length / 3;
    render.pending--;
    if (render.pending === 0) {
      nextPass();
    } else {
      report();
    }
  }

  function drawBlocks({ scale, y0, y1 }, data) {
    const columns = blockCanvas.width;
    const strip = blockContext.createImageData(columns, y1 - y0);
    for (let i = 0, j = 0; i < data.length; i += 3, j += 4) {
      strip.data[j] = data[i];
      strip.data[j + 1] = data[i + 1];
      strip.data[j + 2] = data[i + 2];
      strip.data[j + 3] = 255;
    }
    blockContext.putImageData(strip, 0, y0);
    context.imageSmoothingEnabled = false;
    context.drawImage(blockCanvas, 0, y0, columns, y1 - y0, 0, y0 * scale, columns * scale, (y1 - y0) * scale);
  }

  // keeps a running total per pixel and shows the average
  function addSamples({ y0, y1 }, data) {
    const pixels = image.data;
    for (let y = y0, i = 0; y < y1; y++) {
      const count = ++counts[y];
      for (let x = 0; x < width; x++, i += 3) {
        const s = (y * width + x) * 3;
        const p = (y * width + x) * 4;
        for (let c = 0; c < 3; c++) {
          sums[s + c] = count === 1 ? data[i + c] : sums[s + c] + data[i + c];
          pixels[p + c] = sums[s + c] / count;
        }
      }
    }
    context.putImageData(image, 0, 0, 0, y0, width, y1 - y0);
  }

  function report() {
    const pass = PASSES[render.passIndex];
    onProgress({
      progress: render.donePixels / render.totalPixels,
      done: Boolean(render.done),
      samples: render.done ? MAX_SAMPLES : pass.sample ? render.passIndex - BLOCK_SCALES.length : 0,
      seconds: (performance.now() - render.startTime) / 1000,
      threads
    });
  }

  return {
    threads,
    // starts over with a new scene or camera, at most once per frame
    render(spec) {
      queuedSpec = spec;
      if (frameRequested) return;
      frameRequested = true;
      requestAnimationFrame(() => {
        frameRequested = false;
        start(queuedSpec);
      });
    }
  };
}
