# 云游戏合集 (Cloud Games)

A collection of browser-based party games built with Vue 3 + Vite, deployed on GitHub Pages.

## Games

| Game | Description |
|------|-------------|
| [截码战 (Codenames)](./games/codenames/) | 双人猜词对战游戏 - 截码战 / Codenames word-guessing game |
| [双人拆弹 (Bomb Defuse)](./games/bomb-defuse/) | 双人在线协作拆弹解谜游戏 |
| [区域争夺 (Territory Control)](./games/territory-control/) | 2-4 人联机拖拽派兵占领地图 |

## Development

```bash
# Install dependencies
npm install

# Start dev server (portal at /, games at /games/<name>/)
npm run dev

# Run tests
npm test

# Lint
npm run lint

# Build for production
npm run build

# Preview production build
npm run preview
```

## 联机架构：服务器权威 WebSocket

**4 个游戏已全部迁到自建 WebSocket 服务器（服务器权威），不再使用 PeerJS/WebRTC/TURN。**
房间状态和游戏逻辑都跑在服务器上（复用各游戏的 `gameEngine.js`），客户端是瘦客户端：
只发意图（`INTENT`）、收权威状态（`STATE`）。没有 host/guest 之分、没有主机迁移、
没有三步重连握手、没有 ICE/NAT 穿透问题（大陆网络下 P2P 直连几乎不通，这正是迁移动因）。

客户端共享层：
- `src/shared/ws/createWebSocketService.js` —— 传输层（连接、发帧、断线指数退避自动重连并重新 JOIN）
- `src/shared/ws/createGameNetwork.js` —— 把传输层接到各游戏 reactive 状态的样板
- `src/shared/ws/protocol.js` —— 协议常量唯一真源（`server/protocol.js` 重新导出）

服务器端：每个游戏一个适配器（`server/games/<game>.js`），复用客户端纯函数引擎。
房主专属操作由服务器强制校验。需要持续推进的游戏（territory 生产、catguess 阶段超时）
由服务器 1s tick 权威驱动。

客户端通过环境变量指向服务器：

```bash
VITE_WS_SERVER_URL=wss://<host>/ws
```

### 运行服务器

```bash
# 构建服务器（esbuild 把引擎的无扩展名 import 一并打包，ws 保持 external）
npm run server:build

# 启动（默认 0.0.0.0:8080，可用 PORT / HOST / TICK_MS / PING_MS 覆盖）
npm run server:start

# 开发：监听重建
npm run server:dev
```

部署建议：

- 用 nginx / Caddy 反代到 `127.0.0.1:8080` 并升级为 `wss://`（TLS 证书在反代层）。
  Caddy 最简：`reverse_proxy 127.0.0.1:8080` 即可（自动处理 WebSocket Upgrade）。
- 用计划任务 / `pm2` / `systemd` 守护 `node server/dist/server.mjs`，崩溃自动拉起。
  Windows 部署见 `server/deploy/DEPLOY-WINDOWS.md`。
- 房间状态目前在内存中（派对游戏房间是临时的）——服务器重启会清空所有房间。
  若将来需要跨重启存活，可在 `roomManager` 外接 Redis。

### 已退役

PeerJS 信令服务器（如 `signal.chenximeow.icu`）与 TURN 服务可以下线了；
`VITE_PEER_*` / `*_TURN_*` 等仓库 secrets 也不再使用，可一并删除。

## Adding a New Game

1. Create `games/<game-name>/` with `index.html` and `src/` directory
2. Add your game entry in `src/portal/App.vue`
3. Add the HTML entry to `build.rollupOptions.input` in `vite.config.js`

## Deployment

Automatically deployed to GitHub Pages via GitHub Actions on push to `main`.
