import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const proxy = { '/api': { target: process.env.ROVERLAB_BACKEND_URL ?? 'http://127.0.0.1:3001', changeOrigin: false } };
export default defineConfig({
  plugins: [react()],
  server: { proxy },
  preview: { proxy },
});
