import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { objectsApiPlugin } from './plugins/objects-api.js'
import { resolveObjectsDir } from './server/objects.js'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const root = process.cwd()
  const env = loadEnv(mode, root, '')
  const objectsDir = resolveObjectsDir(root, env.OBJECTS_DIR ?? process.env.OBJECTS_DIR)

  return {
    plugins: [react(), tailwindcss(), objectsApiPlugin({ objectsDir })],
    server: {
      watch: {
        ignored: [`${objectsDir}/**`],
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, './src'),
      },
    },
  }
})
