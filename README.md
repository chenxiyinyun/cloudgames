# 云游戏合集 (Cloud Games)

A collection of browser-based party games built with Vue 3 + Vite, using a server-authoritative WebSocket architecture for online multiplayer.

## Games

| Game | Description |
|------|-------------|
| [截码战 (Codenames)](./games/codenames/) | 四人猜词对战游戏 - 截码战 / Decrypto word-guessing game |
| [双人拆弹 (Bomb Defuse)](./games/bomb-defuse/) | 双人在线协作拆弹解谜游戏 |
| [区域争夺 (Territory Control)](./games/territory-control/) | 2-4 人联机拖拽派兵占领地图 |
| [喵喵猜词 (Cat Guess)](./games/catguess/) | 多人看图猜词派对游戏 |

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

## Architecture: Server-Authoritative WebSocket

All games use a server-authoritative model: the server runs the game logic and clients are thin — they only send intents and receive authoritative state.

```
┌─────────────────────────────────────────────────┐
│  Client (Vue 3 SPA per game)                    │
│  ┌─────────────────────────────────────────────┐ │
│  │  src/shared/ws/                             │ │
│  │  ├── protocol.js          协议常量唯一真源    │ │
│  │  ├── createWebSocketService.js  传输层       │ │
│  │  ├── createGameNetwork.js  传输→响应式胶水    │ │
│  │  └── roomCode.js          房间号生成          │ │
│  └──────────────────┬──────────────────────────┘ │
└─────────────────────┼────────────────────────────┘
                      │ WebSocket (JSON)
┌─────────────────────┼────────────────────────────┐
│  Server (Node.js)   │                            │
│  ├── index.js       │  ws 传输层 + ping/pong      │
│  ├── roomManager.js │  房间管理（与游戏/传输解耦）  │
│  ├── protocol.js    │  重新导出客户端协议常量       │
│  └── games/         │  游戏适配器                  │
│      ├── index.js   │  注册表                      │
│      ├── bombdefuse.js                            │
│      ├── catguess.js                              │
│      ├── codenames.js                             │
│      └── territory.js                             │
└──────────────────────────────────────────────────┘
```

### Protocol

| Direction | Type | Purpose |
|-----------|------|---------|
| C→S | `CREATE` | Create a room |
| C→S | `JOIN` | Join / reconnect (same playerId = reconnect) |
| C→S | `INTENT` | Game action (START_GAME, SUBMIT_*, etc.) |
| C→S | `LEAVE` | Leave room |
| S→C | `JOINED` | Room created/joined (includes full room state) |
| S→C | `STATE` | Authoritative room state (full snapshot) |
| S→C | `ERROR` | Rejected intent / room not found (fatal=true stops reconnect) |

### Key Design Decisions

- **No host/guest distinction** — the server is the single authority
- **No host migration** — not needed when the server holds all state
- **No ICE/NAT traversal** — pure WebSocket, works reliably on mainland China networks
- **Engine reuse** — server adapters import the same pure-function `gameEngine.js` from each game, zero code duplication
- **Server tick** — `roomManager.tickAll()` runs every 1s; games with time-driven logic (territory production, bomb countdown) implement `adapter.tick()`
- **Host-only actions** — declared per adapter (`hostOnlyActions`), enforced by `roomManager`
- **Auto-reconnect** — client uses exponential backoff (1s→2s→4s→8s, max 6 attempts) and re-JOINs on reconnect; server identifies players by `playerId`
- **Room state in memory** — rooms are ephemeral (party games are temporary); server restart clears all rooms. Redis persistence can be added to `roomManager` if needed.

### Client Configuration

```bash
VITE_WS_SERVER_URL=wss://<host>/ws
```

### Running the Server

```bash
# Build server (esbuild bundles engines, keeps ws external)
npm run server:build

# Start (default 0.0.0.0:8080, override with PORT / HOST / TICK_MS / PING_MS)
npm run server:start

# Dev: watch and rebuild
npm run server:dev
```

**Deployment:**
- Reverse-proxy to `127.0.0.1:8080` with nginx/Caddy (handles TLS + WebSocket upgrade)
- Caddy minimal: `reverse_proxy 127.0.0.1:8080` (auto WebSocket support)
- Use pm2/systemd to daemonize `node server/dist/server.mjs`
- Windows deployment: see `server/deploy/DEPLOY-WINDOWS.md`

## Adding a New Game

1. Create `games/<game-name>/` with `index.html` and `src/` directory
2. Implement `games/<game-name>/src/services/gameEngine.js` as pure functions (no Vue/browser deps)
3. Create a server adapter `server/games/<game>.js` that imports and wraps the engine
4. Register the adapter in `server/games/index.js`
5. Add the game entry in `src/portal/App.vue`
6. Add the HTML entry to `build.rollupOptions.input` in `vite.config.js`

## Deployment

Client is automatically deployed to GitHub Pages via GitHub Actions on push to `main`.
