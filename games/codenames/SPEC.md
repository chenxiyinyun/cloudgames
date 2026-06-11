# 截码战 (Decrypto) - 技术规格文档

## 1. 项目概述

截码战是一款四人桌游的网页版实现。采用**服务器权威 WebSocket** 架构实现多设备联机，客户端为瘦客户端（只发意图、收权威状态），游戏逻辑全部跑在服务器上。

## 2. 技术架构

### 2.1 服务器权威模型

```
浏览器 A/B/C/D (瘦客户端)
    │  WebSocket (JSON 帧)
    │  协议：CREATE / JOIN / INTENT / LEAVE → JOINED / STATE / ERROR
    │
WebSocket 服务器 (权威)
    ├── roomManager.js — 房间管理，与游戏/传输解耦
    ├── games/codenames.js — 适配器，复用客户端纯函数引擎
    └── 1s tick — 推进倒计时/胜负
```

- **服务器**：运行所有游戏逻辑（权威），处理意图、广播状态、驱动计时
- **客户端**：只发意图（`INTENT`）、收权威状态（`STATE`），不持有权威房间状态
- **连接模型**：单一 WebSocket JSON 通道，由服务器按 `playerId` 处理断线重连

### 2.2 技术栈
- **Vue.js 3** (Composition API)
- **Vite** 构建工具
- **ws** (Node.js WebSocket 服务器)
- **原生 CSS** (二战电报风格)

## 3. 目录结构
```
games/codenames/
├── src/
│   ├── components/
│   │   ├── MenuScreen.vue      # 主菜单
│   │   ├── LobbyScreen.vue     # 等待室
│   │   ├── GameScreen.vue      # 游戏界面
│   │   ├── ResultScreen.vue    # 结果界面
│   │   └── ToastNotification.vue
│   ├── services/
│   │   ├── gameEngine.js       # 游戏引擎 (纯逻辑，服务器也复用)
│   │   ├── logger.js
│   │   └── sanitize.js
│   ├── data/
│   │   └── keywords.js         # 关键词库 (962个词)
│   ├── stores/
│   │   ├── gameStore.js        # 状态管理 (瘦客户端，只发意图)
│   │   ├── network.js          # 网络层 (createGameNetwork 样板)
│   │   ├── state.js            # 响应式状态定义
│   │   └── cache.js            # localStorage 缓存
│   ├── App.vue
│   ├── main.js
│   └── style.css
└── index.html
```

## 4. 通信协议

### 4.1 消息类型
| 消息类型 | 方向 | 说明 |
|---------|------|------|
| CREATE | C→S | 建房 |
| JOIN | C→S | 加入/重连 |
| INTENT | C→S | 游戏意图（START_GAME / SUBMIT_* 等） |
| LEAVE | C→S | 主动离开 |
| JOINED | S→C | 建房/加入成功（含全量房间状态） |
| STATE | S→C | 权威房间状态（全量） |
| ERROR | S→C | 意图被拒 / 房间不存在等（fatal=true 时不再重连） |

### 4.2 连接流程
1. 玩家输入名字，点击建房/加入
2. 客户端通过 `createWebSocketService` 连接服务器，发送 CREATE 或 JOIN
3. 服务器创建/加入房间，返回 JOINED（含全量状态）
4. 游戏操作通过 `sendIntent(action, payload)` 发送
5. 服务器运行权威逻辑后广播 STATE 给房内所有连接
6. 断线后自动指数退避重连 + 重新 JOIN（服务器按 playerId 识别重连）

## 5. 游戏规则

### 5.1 结果计算
| 加密方队友 | 拦截方 | 结果 |
|----------|--------|------|
| ✅ 猜对 | ✅ 猜对 | 拦截方 +1 拦截 |
| ✅ 猜对 | ❌ 猜错 | 无事发生 |
| ❌ 猜错 | ✅ 猜对 | 拦截方 +1 拦截, 加密方 +1 失误 |
| ❌ 猜错 | ❌ 猜错 | 加密方 +1 失误 |

### 5.2 胜利条件
- 2 个拦截标记 → 获胜
- 2 个失误标记 → 对方获胜

## 6. 部署方式

### 6.1 客户端
构建后部署到任意静态托管服务（GitHub Pages、Vercel、Netlify 等）。

### 6.2 服务器
```bash
npm run server:build   # esbuild 打包
npm run server:start   # 启动（默认 0.0.0.0:8080）
```

用 nginx / Caddy 反代到 `127.0.0.1:8080` 并升级为 `wss://`。客户端通过环境变量指向服务器：

```bash
VITE_WS_SERVER_URL=wss://<host>/ws
```

## 7. 关键词库

- **总词数**: 962 个
- **分类**: 动物、植物、水果、食物、城市、职业、物品、自然、运动、娱乐、科技、情感、时间、颜色、节日、科学、工具
