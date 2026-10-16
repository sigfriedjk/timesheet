import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './', // Ensures relative assets work cleanly on GitHub Pages
  server: {
    host: '0.0.0.0',
    port: 5173,
    watch: {
      usePolling: true, // Useful inside Docker on Windows
    },
  },
  test: {
    environment: 'node',
    globals: true,
  },
} as any);
