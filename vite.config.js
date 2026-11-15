/// <reference types="vitest/config" />
import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'
import { readdirSync, existsSync } from 'node:fs'

// 游戏入口由目录派生：新增 games/<id>/index.html 即自动参与构建，无需改本文件
const gamesDir = resolve(__dirname, 'games')
const gameInputs = Object.fromEntries(
  readdirSync(gamesDir, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && existsSync(resolve(gamesDir, entry.name, 'index.html')))
    .map(entry => [entry.name, resolve(gamesDir, entry.name, 'index.html')])
)

export default defineConfig(({ mode }) => {
  // 显式注入：确保共享 chunk 与各游戏入口都读取同一个服务地址
  const env = loadEnv(mode, process.cwd(), '')
  const wsUrl = process.env.VITE_WS_SERVER_URL || env.VITE_WS_SERVER_URL || ''
  const agentUrl = process.env.VITE_AGENT_SERVER_URL || env.VITE_AGENT_SERVER_URL || wsUrl

  return {
  plugins: [vue()],
  define: {
    __CLOUD_GAMES_WS_URL__: JSON.stringify(wsUrl),
    __CLOUD_GAMES_AGENT_URL__: JSON.stringify(agentUrl)
  },
  server: {
    port: 5173
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        ...gameInputs,
        agentGuide: resolve(__dirname, 'agent-guide/index.html')
      }
    }
  },
  // 自定义域名下为根路径，chenxiyinyun.github.io/cloudgames/ 已 301 跳转到自定义域名
  base: '/',
  test: {
    environment: 'node',
    include: [
        'games/*/src/**/*.test.js',
        'src/shared/**/*.test.js',
        'server/**/*.test.js',
        'static/shanhai-letters/src/**/*.test.js'
    ]
  }
  }
})
