/**
 * WebSocket 服务器入口（传输层）。
 *
 * 把每个 socket 包装成 roomManager 认识的 conn（带 send()），解析 JSON 消息，
 * 用 ws 内置 ping/pong 检测死连接（替代旧的应用层心跳）。
 *
 * 运行：先 `npm run server:build`（esbuild 打包，解析引擎的无扩展名 import），
 * 再 `npm run server:start`。生产建议挂在 nginx 后做 wss/TLS，用 pm2/systemd 守护。
 */
import { WebSocketServer } from 'ws';
import { createRoomManager } from './roomManager.js';
import { getGameAdapter, listGameIds } from './games/index.js';
import { generateRoomCode } from '../src/shared/ws/roomCode.js';

const PORT = Number(process.env.PORT) || 8080;
const HOST = process.env.HOST || '0.0.0.0';
const TICK_MS = Number(process.env.TICK_MS) || 1000;
const PING_MS = Number(process.env.PING_MS) || 30000;

const log = {
  debug: () => {},
  info: (msg, meta) => console.log(`[ws] ${msg}`, meta ?? ''),
  warn: (msg, meta) => console.warn(`[ws] ${msg}`, meta ?? ''),
  error: (msg, meta) => console.error(`[ws] ${msg}`, meta ?? '')
};

const manager = createRoomManager({ getGameAdapter, generateRoomCode, log });

const wss = new WebSocketServer({ host: HOST, port: PORT });

wss.on('listening', () => {
  log.info(`listening on ws://${HOST}:${PORT}`, { games: listGameIds() });
});

wss.on('connection', (socket) => {
  // roomManager 认识的连接句柄：只需要 send()，roomCode/playerId 由它绑定
  const conn = {
    roomCode: null,
    playerId: null,
    send: (obj) => {
      if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(obj));
    }
  };

  socket.isAlive = true;
  socket.on('pong', () => { socket.isAlive = true; });

  socket.on('message', (data) => {
    let msg;
    try {
      msg = JSON.parse(data.toString());
    } catch {
      conn.send({ type: 'ERROR', message: '消息不是合法 JSON' });
      return;
    }
    manager.handleMessage(conn, msg);
  });

  socket.on('close', () => manager.handleDisconnect(conn));
  socket.on('error', () => manager.handleDisconnect(conn));
});

// 权威计时：推进各房间倒计时/胜负
const tickTimer = setInterval(() => manager.tickAll(), TICK_MS);

// 死连接检测：一个周期内没回 pong 的 socket 直接终结，触发 disconnect
const pingTimer = setInterval(() => {
  for (const socket of wss.clients) {
    if (socket.isAlive === false) {
      socket.terminate();
      continue;
    }
    socket.isAlive = false;
    try { socket.ping(); } catch { /* ignore */ }
  }
}, PING_MS);

function shutdown() {
  clearInterval(tickTimer);
  clearInterval(pingTimer);
  wss.close(() => process.exit(0));
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
