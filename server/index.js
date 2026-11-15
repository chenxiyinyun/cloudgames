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
import { createServer } from 'node:http';
import { createRoomManager } from './roomManager.js';
import { getGameAdapter, listGameIds } from './games/index.js';
import { generateRoomCode } from '../src/shared/ws/roomCode.js';
import { createAgentHttp } from './agentHttp.js';
import { createLogger } from './logger.js';

process.on('uncaughtException', (err) => console.error('[ws] uncaught exception', err?.message));
process.on('unhandledRejection', (err) => console.error('[ws] unhandled rejection', err?.message));

const PORT = Number(process.env.PORT) || 8080;
const HOST = process.env.HOST || '0.0.0.0';
const TICK_MS = Number(process.env.TICK_MS) || 1000;
const PING_MS = Number(process.env.PING_MS) || 30000;
const STARTED_AT = Date.now();

const log = createLogger({ name: 'ws' });

const manager = createRoomManager({ getGameAdapter, generateRoomCode, log });

const agentHttp = createAgentHttp({
  manager,
  publicOrigin: process.env.PUBLIC_ORIGIN || 'https://cloudgames.chenximeow.icu'
});

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    'Cache-Control': 'no-store'
  });
  res.end(payload);
}

function uptimeSec() {
  return Math.round((Date.now() - STARTED_AT) / 1000);
}

const httpServer = createServer((req, res) => {
  let pathname = '';
  try {
    pathname = new URL(req.url, 'http://localhost').pathname;
  } catch { /* 非法 URL 走默认分支 */ }

  if (pathname === '/healthz') {
    sendJson(res, 200, { status: 'ok', uptimeSec: uptimeSec(), ...manager.stats() });
    return;
  }
  if (pathname === '/metrics') {
    sendJson(res, 200, {
      uptimeSec: uptimeSec(),
      tickMs: TICK_MS,
      sockets: wss.clients.size,
      ...manager.stats()
    });
    return;
  }

  if (req.url?.startsWith('/api/agent/')) agentHttp.handle(req, res);
  else {
    res.writeHead(426, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('请使用 WebSocket 连接，Agent 文档位于 /api/agent/discovery，健康检查位于 /healthz');
  }
});

const wss = new WebSocketServer({ server: httpServer, maxPayload: 32 * 1024 });
httpServer.listen(PORT, HOST, () => {
  log.info(`listening on ws://${HOST}:${PORT}`, { games: listGameIds(), agentApi: '/api/agent/rpc' });
});

wss.on('connection', (socket) => {
  if (wss.clients.size > 2000) {
    socket.close(1013, '服务器繁忙');
    return;
  }
  let windowStarted = Date.now();
  let messageCount = 0;
  let rateLimitedUntil = 0;
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
    const current = Date.now();
    if (current - windowStarted >= 1000) {
      windowStarted = current;
      messageCount = 0;
    }
    messageCount += 1;
    if (messageCount > 30) {
      if (current >= rateLimitedUntil) conn.send({ type: 'ERROR', code: 'RATE_LIMITED', message: '消息过于频繁，请稍后重试' });
      rateLimitedUntil = current + 1000;
      return;
    }
    if (!msg || typeof msg !== 'object' || Array.isArray(msg)) {
      conn.send({ type: 'ERROR', message: '消息必须是 JSON 对象' });
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
  wss.close(() => httpServer.close(() => process.exit(0)));
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
