import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import Scene from './Scene.jsx';
import './index.css';

createRoot(document.getElementById('content')).render(
  <StrictMode>
    <Scene width={200} height={200} antiAliasing={1} />
  </StrictMode>
);
