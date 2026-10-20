import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

// Mirrors the renderer layout observed in the Trello desktop asar
// (.webpack/renderer/<window>/index.html, one entry per window).
const windows = ['main', 'newcard', 'preferences', 'find_in_page', 'welcome'];

export default defineConfig({
  root: resolve(__dirname, 'src/renderer'),
  base: './',
  plugins: [react()],
  server: { port: 5173, strictPort: true },
  build: {
    outDir: resolve(__dirname, 'dist/renderer'),
    emptyOutDir: true,
    rollupOptions: {
      input: Object.fromEntries(
        windows.map((w) => [w, resolve(__dirname, `src/renderer/${w}/index.html`)]),
      ),
    },
  },
});
