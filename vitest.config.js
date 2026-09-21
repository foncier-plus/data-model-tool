import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config.js'

const base = typeof viteConfig === 'function' ? viteConfig({ mode: 'test', command: 'serve' }) : viteConfig

export default mergeConfig(
  base,
  defineConfig({
    test: {
      environment: 'node',
      include: ['src/**/*.test.{js,jsx}'],
      setupFiles: ['src/test/setup.js'],
    },
  }),
)
