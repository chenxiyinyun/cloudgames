# 截码战 (Codenames) - 技术规格文档

## 1. 项目概述

截码战是一款四人桌游的网页版实现。**纯静态网站**，通过 WebRTC P2P 技术实现多设备联机，无需服务器，可直接部署到 GitHub Pages、Vercel、Netlify 等平台。

## 2. 技术架构

### 2.1 P2P 架构
```
浏览器 A (房主 - 运行完整游戏逻辑)
    │  PeerJS (WebRTC)
    │  PeerServer (0.peerjs.com - 仅用于信令)
    │
浏览器 B/C/D (访客 - 接收状态同步)
```

- **房主浏览器**：运行所有游戏逻辑（权威节点），处理加入/离开/线索/猜测等操作，广播状态给所有访客
- **访客浏览器**：接收房主的状态广播，同步 UI，提交操作请求给房主
- **PeerServer**：仅用于 P2P 连接建立（信令），不存储任何数据

### 2.2 技术栈
- **Vue.js 3** (Composition API)
- **Vite** 构建工具
- **PeerJS** (WebRTC P2P)
- **原生 CSS** (赛博朋克风格)
- **零后端 / 零数据库**

## 3. 目录结构
```
/workspace/
├── src/
│   ├── components/
│   │   ├── MenuScreen.vue      # 主菜单
│   │   ├── LobbyScreen.vue     # 等待室
│   │   ├── GameScreen.vue      # 游戏界面
│   │   └── ResultScreen.vue    # 结果界面
│   ├── services/
│   │   ├── p2p.js              # P2P 通信层 (WebRTC)
│   │   └── gameEngine.js       # 游戏引擎 (纯逻辑)
│   ├── data/
│   │   └── keywords.js         # 关键词库 (962个词)
│   ├── stores/
│   │   └── gameStore.js        # 状态管理
│   ├── App.vue
│   ├── main.js
│   └── style.css
├── index.html
├── package.json
├── vite.config.js
└── SPEC.md
```

## 4. P2P 通信协议

### 4.1 消息类型
| 消息类型 | 方向 | 说明 |
|---------|------|------|
| JOIN_REQUEST | 访客→房主 | 请求加入房间 |
| JOIN_RESPONSE | 房主→访客 | 加入结果 |
| ROOM_STATE | 房主→所有访客 | 完整房间状态同步 |
| START_GAME | 房主→所有访客 | 开始游戏 |
| SUBMIT_CLUES | 双向→房主 | 提交线索 |
| SUBMIT_GUESS | 双向→房主 | 提交猜测 |
| NEXT_ROUND | 房主→所有访客 | 下一回合 |

### 4.2 连接流程
1. 房主创建 Peer (`codenames-{roomCode}`)
2. 访客创建 Peer → 连接房主的 Peer ID
3. 连接建立后，访客发送 JOIN_REQUEST
4. 房主处理请求，广播 ROOM_STATE
5. 所有操作由房主集中处理，结果广播给所有人

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

### 6.1 纯静态托管
```bash
# 构建
npm install
npm run build

# dist/ 目录即为完整网站，可部署到任意静态托管服务
```

### 6.2 支持的平台
- **GitHub Pages**: 推送 dist/ 到 gh-pages 分支
- **Vercel**: `vercel --prod`
- **Netlify**: 拖拽 dist/ 文件夹
- **Cloudflare Pages**: 连接仓库自动部署
- **任何静态文件服务器**: nginx, Apache, etc.

### 6.3 P2P 端口要求
- 无需服务器端口，通信走浏览器 WebRTC
- PeerServer 使用 0.peerjs.com:443 (HTTPS)
- 需要 STUN/TURN 服务器（PeerJS 自带配置）

## 7. 关键词库

- **总词数**: 962 个
- **分类**: 动物、植物、水果、食物、城市、职业、物品、自然、运动、娱乐、科技、情感、时间、颜色、节日、科学、工具