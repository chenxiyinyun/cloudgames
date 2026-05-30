/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        codenames: resolve(__dirname, 'games/codenames/index.html')
      }
    }
  },
  // GitHub Pages 子路径配置
  base: '/cloudgames/',
  test: {
    environment: 'node',
    include: ['games/codenames/src/**/*.test.js']
  }
})
