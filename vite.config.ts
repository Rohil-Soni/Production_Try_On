import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
    assetsInlineLimit: 0,
  },
  server: {
    host: '0.0.0.0',
    port: 5500,
    strictPort: true,
    allowedHosts: ['magnifier-resigned-halves.ngrok-free.dev'],
    proxy: {
      // Intercept 8th Wall's font requests and redirect to a local copy
      '/8thwall-fonts': {
        target: 'https://cdn.8thwall.com',
        changeOrigin: true,
        rewrite: (path) => path.replace('/8thwall-fonts', '/web/fonts'),
      },
    },
  },
});