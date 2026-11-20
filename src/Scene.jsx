import { useEffect, useRef, useState } from 'react';
import sceneText from '../app.properties?raw';
import ProgressBar from './ProgressBar.jsx';
import { parseProperties } from './properties.js';
import { getColor, loadScene } from './tracer.js';

const scene = loadScene(parseProperties(sceneText));

// how many rows to trace before letting the page redraw the progress bar
const ROWS_PER_STEP = 5;

export default function Scene({ width, height, antiAliasing }) {
  const canvasRef = useRef(null);
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    // trace at twice the size, then shrink it down for smoother edges
    const traceWidth = width * 2;
    const traceHeight = height * 2;
    const image = context.createImageData(traceWidth, traceHeight);
    let timer;

    function traceRows(yStart) {
      const yEnd = Math.min(yStart + ROWS_PER_STEP, traceHeight);
      for (let y = yStart; y < yEnd; y++) {
        for (let x = 0; x < traceWidth; x++) {
          const index = (y * traceWidth + x) * 4;
          const color = getColor(scene, x, y, traceWidth, traceHeight);
          image.data[index + 0] = color.r;
          image.data[index + 1] = color.g;
          image.data[index + 2] = color.b;
          image.data[index + 3] = color.a;
        }
      }
      setProgress(yEnd / traceHeight);

      if (yEnd < traceHeight) {
        timer = setTimeout(() => traceRows(yEnd), 0);
      } else {
        draw();
        setDone(true);
      }
    }

    function draw() {
      const canvasCopy = document.createElement('canvas');
      const contextCopy = canvasCopy.getContext('2d');
      canvasCopy.width = traceWidth;
      canvasCopy.height = traceHeight;
      contextCopy.putImageData(image, 0, 0);
      context.drawImage(canvasCopy, 0, 0, traceWidth, traceHeight, 0, 0, width, height);

      // stupid basic antialiasing
      for (let i = 0; i < antiAliasing; i++) {
        contextCopy.drawImage(canvas, 0, 0, width, height, 0, 0, traceWidth, traceHeight);
        context.drawImage(canvasCopy, 0, 0, traceWidth, traceHeight, 0, 0, width, height);
      }
    }

    timer = setTimeout(() => traceRows(0), 0);
    return () => clearTimeout(timer);
  }, [width, height, antiAliasing]);

  return (
    <div className="scene">
      {!done && <ProgressBar text="Loading..." progress={progress} />}
      <canvas ref={canvasRef} width={width} height={height} hidden={!done} />
    </div>
  );
}
