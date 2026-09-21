import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { objectsApiPlugin } from './plugins/objects-api.js'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), objectsApiPlugin()],
  server: {
    watch: {
      ignored: ['**/objects/**'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
})
