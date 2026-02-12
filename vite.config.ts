import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3080',
      '/ws': { target: 'ws://localhost:3080', ws: true },
      '/avatars': 'http://localhost:3080',
      '/uploads': 'http://localhost:3080',
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
