/// <reference types="vitest/config" />
import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

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
        codenames: resolve(__dirname, 'games/codenames/index.html'),
        catguess: resolve(__dirname, 'games/catguess/index.html'),
        bombDefuse: resolve(__dirname, 'games/bomb-defuse/index.html'),
        territoryControl: resolve(__dirname, 'games/territory-control/index.html'),
        agentGuide: resolve(__dirname, 'agent-guide/index.html')
      }
    }
  },
  // 自定义域名下为根路径，chenxiyinyun.github.io/cloudgames/ 已 301 跳转到自定义域名
  base: '/',
  test: {
    environment: 'node',
    include: [
        'games/codenames/src/**/*.test.js',
        'games/catguess/src/**/*.test.js',
        'games/bomb-defuse/src/**/*.test.js',
        'games/territory-control/src/**/*.test.js',
        'src/shared/**/*.test.js',
        'server/**/*.test.js'
    ]
  }
  }
})
