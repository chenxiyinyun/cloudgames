# 云游戏合集 (Cloud Games)

A collection of browser-based party games built with Vue 3 + Vite, using a server-authoritative WebSocket architecture for online multiplayer.

## Games

| Game | Description |
|------|-------------|
| [截码战 (Codenames)](./games/codenames/) | 四人猜词对战游戏 - 截码战 / Decrypto word-guessing game |
| [双人拆弹 (Bomb Defuse)](./games/bomb-defuse/) | 双人在线协作拆弹解谜游戏 |
| [区域争夺 (Territory Control)](./games/territory-control/) | 2-4 人联机拖拽派兵占领地图 |
| [喵喵猜词 (Cat Guess)](./games/catguess/) | 多人看图猜词派对游戏 |
| [五子棋 (Gomoku)](./games/gomoku/) | 双人在线五子棋对弈 |

## Static Games (纯静态，零构建)

`static/` 目录下是**不需要构建、可直接发布**的纯静态小游戏，与上面的 Vue 多入口体系完全独立：

| Game | Description |
|------|-------------|
| [山海来信](./static/shanhai-letters/) | 《山海经》神兽游历现代中国的放置旅行 + 随机叙事游戏 |

把整个游戏文件夹丢到任意静态托管（GitHub Pages / 对象存储 / nginx）即可运行，双击 `index.html` 也能玩。
详见 `static/README.md` 的目录约定。

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

- **Single authority** — the server owns room state; clients only render snapshots and send intents
- **Single transport** — pure WebSocket JSON frames, works reliably on mainland China networks
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

1. 建 `games/<game-name>/`：`index.html` + `src/`（视图）+ `game.manifest.js`（门户元数据，纯数据、不 import 任何模块）
2. 实现 `games/<game-name>/src/services/gameEngine.js`，纯函数、无 Vue/浏览器依赖（客户端与服务端共用同一份规则）
3. 写服务端适配器 `server/games/<game>.js`，声明 `createRoom` / `addPlayer` / `removePlayer` / `applyIntent` / `tick` / `project` / `agentGuide` / `agentActions` / `hostOnlyActions`
4. 在 `server/games/index.js` 注册一行适配器

构建入口（`games/*/index.html`）、测试范围（`games/*/src/**/*.test.js`）与门户游戏列表（各游戏 `game.manifest.js`）都由目录自动派生，不需要再改 `vite.config.js` 或 `src/portal/App.vue`。只有本文件的 Games 表格需要手动补一行。

## Deployment

Client is automatically deployed to GitHub Pages via GitHub Actions on push to `main`.

## Agent 接入（真人 + Agent 同局）

真人房主可在任意游戏大厅生成限时邀请，把接入指令交给自己的 Agent。Agent 通过 HTTP 或 WebSocket 自主加入、读取**自己视角**的状态并合法行动，房间里用「真人 / Agent」标签区分身份。

### 接口

| 方式 | 地址 | 说明 |
|------|------|------|
| 发现 | `GET /api/agent/discovery` | 机器可读的游戏、规则与动作目录 |
| HTTP | `POST /api/agent/rpc` | `join` / `state` / `intent`，凭证放请求体 |
| WebSocket | 同一服务根地址 | `AGENT_JOIN` / `AGENT_STATE` / `AGENT_INTENT` |

### 安全边界

- 仅房主可签发邀请；邀请 30 分钟有效、最多绑定 4 个 Agent
- 服务端只保存邀请与会话 token 的哈希，Agent 身份不能由真人 JOIN 伪造
- 状态按玩家视角投影：他人手牌、拆弹答案、未公开投票、截码战密码不会下发
- 动作仍由原权威引擎裁决，`requestId` 去重、参数校验、消息大小与频率限制

### 房间生命周期与心跳

- 房间是临时的，只存在于服务内存；**最后一个连接离开即销毁**，服务重启也会清空
- Agent 席位靠心跳保活：每次 `state` / `intent` 请求刷新活跃时间，**连续 90 秒无请求判定离线并回收席位**（大厅移出 / 对局中标记离线）
- 主动退出用 `{"operation":"leave"}`（HTTP）或 `AGENT_LEAVE`（WebSocket），返回 `AGENT_LEFT`
- 邀请 30 分钟有效、最多绑定 4 个 Agent；Agent 会话最长 24 小时，失效返回 `AGENT_AUTH_FAILED`
- 房间消失返回 `ROOM_NOT_FOUND`，Agent 应立即停止而非重试

### 给 Agent 的执行要求

接入指令（详见 `src/shared/components/AgentAccessPanel.vue` 生成的文案）明确要求：

1. **必须后台执行**：用后台进程 / 子任务 / 队列 / 定时调度运行对局循环，禁止在主线程 `sleep` 轮询或 `while(true)`，以免阻塞前台、无法响应其他请求，也会错过阶段超时
2. **实现自动退出**：正常结束先 `leave`；`ROOM_NOT_FOUND` / `AGENT_AUTH_FAILED` 立即停止；连续失败退避 5/10/20 秒后汇报
3. **保持心跳**：轮询间隔 2–5 秒，最长不超过 60 秒

### 部署

Agent 接口运行在 Node.js 游戏服务上，与 WebSocket 共用端口（默认 8080）。静态网页由 GitHub Pages 托管，Agent 连接地址来自构建变量：

```bash
VITE_WS_SERVER_URL=wss://你的游戏服务域名 npm run build
```

反向代理需同时转发普通请求（`/api/agent/*`）与 WebSocket Upgrade。服务端没有 `npm run dev` 时可用：

```bash
npm run server:build
PORT=8080 PUBLIC_ORIGIN=https://你的网页域名 node server/dist/server.mjs
```

网页侧入口：首页「Agent 接入」区块、`/agent-guide/` 完整指南、各游戏大厅「让 Agent 加入」面板。
