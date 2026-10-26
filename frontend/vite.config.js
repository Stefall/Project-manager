import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

// Le build produit des fichiers statiques : aucun Node.js n'est nécessaire en production.
// Serveur PHP : sortie dans public/app (défaut). Démo GitHub Pages : VITE_BASE=/Project-manager/ et VITE_OUT_DIR=dist.
export default defineConfig({
  plugins: [vue()],
  base: process.env.VITE_BASE || '/app/',
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
    outDir: process.env.VITE_OUT_DIR || '../public/app',
    emptyOutDir: true,
  },
})
