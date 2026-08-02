import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
    assetsInlineLimit: 0,
  },
  server: {
    port: 5500,
    strictPort: true,
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