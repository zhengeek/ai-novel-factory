import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  resolve: {
    alias: [
      {
        find: 'splitpanes/dist/splitpanes.css',
        replacement: fileURLToPath(new URL('./src/vendor/splitpanes.css', import.meta.url)),
      },
      {
        find: 'splitpanes',
        replacement: fileURLToPath(new URL('./src/vendor/splitpanes.ts', import.meta.url)),
      },
    ],
  },
})
