import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const devProxyTarget = env.MC_DEV_PROXY_TARGET || 'http://127.0.0.1:3080';
  const devWsProxyTarget = env.MC_DEV_WS_PROXY_TARGET || devProxyTarget.replace(/^http/, 'ws');

  return {
    plugins: [react()],
    server: {
      host: env.VITE_DEV_HOST || '127.0.0.1',
      port: Number(env.VITE_DEV_PORT || 5173),
      proxy: {
        '/api': devProxyTarget,
        '/ws': { target: devWsProxyTarget, ws: true },
        '/avatars': devProxyTarget,
        '/uploads': devProxyTarget,
      },
    },
    build: {
      outDir: 'dist',
      sourcemap: false,
    },
  };
});
