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

## P2P Reliability

The games use PeerJS/WebRTC for multiplayer. The shared P2P layer now only uses explicitly configured domestic/self-hosted signaling and TURN services. It does not fall back to public PeerJS or overseas relay services.

Configure a domestic/self-hosted PeerJS signaling server:

```bash
VITE_PEER_SERVER_HOST=<peer-server-host>
VITE_PEER_SERVER_PORT=9000
VITE_PEER_SERVER_PATH=/peerjs
VITE_PEER_SERVER_KEY=<peer-server-key>
VITE_PEER_SERVER_SECURE=true
```

For reliable relay fallback, configure domestic/self-hosted TURN. Multiple URLs can be comma-separated:

```bash
VITE_SELF_HOSTED_TURN_URLS=turn:your-turn-host:3478,turn:your-turn-host:3478?transport=tcp
VITE_SELF_HOSTED_TURN_USERNAME=<turn-username>
VITE_SELF_HOSTED_TURN_CREDENTIAL=<turn-credential>
```

If a network is especially strict and direct ICE candidates keep failing, force all WebRTC traffic through TURN:

```bash
VITE_P2P_ICE_TRANSPORT_POLICY=relay
```

Use relay-only as an operational fallback, not the default, because it is more reliable across difficult NAT/firewall environments but adds latency and consumes TURN bandwidth.

## WebSocket 服务器（服务器权威，迁移中）

正在从 PeerJS/WebRTC 迁移到自建 WebSocket 服务器：房间状态和游戏逻辑都跑在
服务器上（复用各游戏的 `gameEngine.js`），客户端只发意图、收权威状态。不再需要
主机迁移、`recreateAsHost`、三步重连握手。当前已接入 **bomb-defuse**（试点）。

```bash
# 构建服务器（esbuild 把引擎的无扩展名 import 一并打包，ws 保持 external）
npm run server:build

# 启动（默认 0.0.0.0:8080，可用 PORT / HOST / TICK_MS / PING_MS 覆盖）
npm run server:start

# 开发：监听重建
npm run server:dev
```

部署到自建机器（与 PeerServer/TURN 同一台即可）的建议：

- 用 nginx 反代到 `127.0.0.1:8080` 并升级为 `wss://`（TLS 证书在 nginx 层），
  `location` 需带 `proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection "upgrade";`。
- 用 `pm2` 或 `systemd` 守护 `node server/dist/server.mjs`，崩溃自动拉起。
- 房间状态目前在内存中（派对游戏房间是临时的）——服务器重启会清空所有房间。
  若将来需要跨重启存活，可在 `roomManager` 外接 Redis。
- 客户端通过 `VITE_WS_SERVER_URL=wss://<host>/...` 指向该服务器（迁移完成后接入）。

## Adding a New Game

1. Create `games/<game-name>/` with `index.html` and `src/` directory
2. Add your game entry in `src/portal/App.vue`
3. Add the HTML entry to `build.rollupOptions.input` in `vite.config.js`

## Deployment

Automatically deployed to GitHub Pages via GitHub Actions on push to `main`.
