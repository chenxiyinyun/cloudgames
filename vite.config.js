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
        codenames: resolve(__dirname, 'games/codenames/index.html'),
        catguess: resolve(__dirname, 'games/catguess/index.html')
      }
    }
  },
  // 自定义域名下为根路径，chenxiyinyun.github.io/cloudgames/ 已 301 跳转到自定义域名
  base: '/',
  test: {
    environment: 'node',
    include: ['games/codenames/src/**/*.test.js', 'games/catguess/src/**/*.test.js']
  }
})
