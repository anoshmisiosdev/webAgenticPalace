import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: '0.0.0.0',
    allowedHosts: [
      'webxr.riyanshomelab.com',
    ],
  },
  optimizeDeps: {
    exclude: ['fsevents']
  }
});