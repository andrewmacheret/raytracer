import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // relative paths so the build works under andrewmacheret.com/projects/raytracer/
  base: './'
});
