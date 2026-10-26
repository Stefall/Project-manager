import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

// Le build produit des fichiers statiques dans public/app : aucun Node.js n'est nécessaire en production.
export default defineConfig({
  plugins: [vue()],
  base: '/app/',
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  css: {
    preprocessorOptions: {
      scss: { additionalData: '@use "@/design-system/mixins" as *;\n' },
    },
  },
  server: {
    // En développement : php -S localhost:8000 -t public
    proxy: { '/api': 'http://localhost:8000' },
  },
  build: {
    outDir: '../public/app',
    emptyOutDir: true,
  },
})
