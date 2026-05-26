/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173
  },
  build: {
    outDir: 'dist',
    sourcemap: false
  },
  // GitHub Pages 子路径配置
  base: '/cloudgames/',
  test: {
    environment: 'node',
    include: ['src/**/*.test.js']
  }
})
