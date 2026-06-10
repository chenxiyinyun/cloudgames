import { C2S, S2C } from './protocol.js';

/**
 * 瘦客户端 WebSocket 传输层（服务器权威模型）。
 *
 * 取代 createP2PService：不再有 host/guest 之分、不再有主机迁移和三步重连握手。
 * 客户端只做三件事：连上服务器 → 发 CREATE/JOIN/INTENT/LEAVE → 收 JOINED/STATE/ERROR。
 * 断线后自动重连并重新 JOIN（服务器按 playerId 识别为重连，保留座位与房主身份）。
 *
 * 与具体游戏、与 Vue 都解耦：只暴露回调，由各游戏的 store 把回调接到响应式状态上。
 *
 * 选项：
 *   url            wss 服务器地址（默认读 VITE_WS_SERVER_URL）
 *   gameId         游戏标识，CREATE 时带给服务器
 *   logger         { debug/info/warn/error }，默认 console
 *   maxReconnects  断线自动重连的最大次数（默认 6），超过则上报 error 状态
 *   reconnectBaseMs/reconnectCapMs  指数退避的基数与上限
 *   WebSocketImpl  注入 WebSocket 实现（测试用），默认全局 WebSocket
 */
export function createWebSocketService({
  url = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_WS_SERVER_URL) || '',
  gameId,
  logger = console,
  maxReconnects = 6,
  reconnectBaseMs = 1000,
  reconnectCapMs = 8000,
  WebSocketImpl = (typeof WebSocket !== 'undefined' ? WebSocket : null)
} = {}) {
  let ws = null;
  let reconnectTimer = null;
  let reconnectAttempts = 0;
  let manualClose = false;

  // 身份与重连凭据：JOINED 之后填满，重连时据此重新 JOIN
  let playerId = null;
  let playerName = null;
  let roomCode = null;
  // 首次连接要发的帧（CREATE 或 JOIN）。JOINED 之后，重连一律改用 JOIN。
  let initialFrame = null;

  // 回调（由 store 注入）
  const cb = {
    onJoined: () => {},
    onState: () => {},
    onError: () => {},
    onStatus: () => {}
  };

  function on(handlers) {
    Object.assign(cb, handlers);
  }

  function setStatus(status, message = '') {
    cb.onStatus(status, message);
  }

  function clearReconnectTimer() {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  }

  /** 重连时要发的帧：一旦拿到 roomCode，就永远用 JOIN（CREATE 只在首次建房用一次）。 */
  function reconnectFrame() {
    if (roomCode && playerId && playerName) {
      return { type: C2S.JOIN, roomCode, playerId, playerName };
    }
    return initialFrame;
  }

  function rawSend(obj) {
    if (ws && ws.readyState === 1 /* OPEN */) {
      try {
        ws.send(JSON.stringify(obj));
        return true;
      } catch (err) {
        logger.warn?.('ws send failed', err?.message);
      }
    }
    return false;
  }

  function openSocket(frameToSend) {
    if (!WebSocketImpl) {
      setStatus('error', '当前环境不支持 WebSocket');
      return;
    }
    if (!url) {
      setStatus('error', '未配置 WebSocket 服务器地址');
      return;
    }
    clearReconnectTimer();
    manualClose = false;

    let socket;
    try {
      socket = new WebSocketImpl(url);
    } catch (err) {
      logger.error?.('ws construct failed', err?.message);
      scheduleReconnect();
      return;
    }
    ws = socket;

    socket.onopen = () => {
      reconnectAttempts = 0;
      const frame = frameToSend || reconnectFrame();
      if (frame) rawSend(frame);
    };

    socket.onmessage = (event) => {
      let msg;
      try {
        msg = JSON.parse(event.data);
      } catch {
        logger.warn?.('ws bad message', event.data);
        return;
      }
      handleMessage(msg);
    };

    socket.onerror = () => {
      // onclose 紧随其后处理重连，这里只记录
      logger.warn?.('ws error');
    };

    socket.onclose = () => {
      if (socket !== ws) return; // 已被新连接取代
      ws = null;
      if (manualClose) return;
      scheduleReconnect();
    };
  }

  function handleMessage(msg) {
    switch (msg.type) {
      case S2C.JOINED:
        playerId = msg.playerId ?? playerId;
        roomCode = msg.roomCode ?? roomCode;
        // initialFrame 里带着 playerName（CREATE/JOIN 都有）
        if (initialFrame?.playerName) playerName = initialFrame.playerName;
        reconnectAttempts = 0;
        setStatus('connected', '');
        cb.onJoined({ playerId, roomCode, room: msg.room });
        break;
      case S2C.STATE:
        cb.onState(msg.room);
        break;
      case S2C.ERROR:
        if (msg.fatal) {
          // 致命错误（房间不存在 / 已结束）：不再自动重连
          manualClose = true;
          clearReconnectTimer();
        }
        cb.onError({ message: msg.message, fatal: !!msg.fatal });
        break;
      default:
        logger.warn?.('ws unknown message type', msg.type);
    }
  }

  function scheduleReconnect() {
    if (manualClose) return;
    if (reconnectAttempts >= maxReconnects) {
      setStatus('error', '与服务器断开，重连失败');
      return;
    }
    reconnectAttempts += 1;
    const delay = Math.min(reconnectCapMs, reconnectBaseMs * 2 ** (reconnectAttempts - 1));
    setStatus('reconnecting', `连接断开，正在重连（第 ${reconnectAttempts} 次）`);
    clearReconnectTimer();
    reconnectTimer = setTimeout(() => openSocket(null), delay);
  }

  // ── 公开 API ────────────────────────────────────────────────────────────────

  /** 建房：作为房主连接并发 CREATE，房间号由服务器分配（在 JOINED 中返回）。 */
  function create(myPlayerId, myPlayerName) {
    playerId = myPlayerId;
    playerName = myPlayerName;
    roomCode = null;
    initialFrame = { type: C2S.CREATE, gameId, playerId, playerName };
    setStatus('connecting', '正在建房…');
    openSocket(initialFrame);
  }

  /** 加入指定房间（或断线重连：同 playerId 服务器视为重连）。 */
  function join(code, myPlayerId, myPlayerName) {
    playerId = myPlayerId;
    playerName = myPlayerName;
    roomCode = code;
    initialFrame = { type: C2S.JOIN, roomCode, playerId, playerName };
    setStatus('connecting', '正在加入…');
    openSocket(initialFrame);
  }

  /** 手动重连当前房间（用户点重试 / 从缓存恢复后）。 */
  function reconnect() {
    if (!reconnectFrame()) return false;
    reconnectAttempts = 0;
    setStatus('reconnecting', '正在重连…');
    openSocket(reconnectFrame());
    return true;
  }

  /** 发送游戏意图，由服务器权威处理后广播 STATE。 */
  function sendIntent(action, payload) {
    return rawSend({ type: C2S.INTENT, action, payload });
  }

  /** 主动离开并断开（不再自动重连）。 */
  function leave() {
    manualClose = true;
    clearReconnectTimer();
    rawSend({ type: C2S.LEAVE });
    if (ws) {
      try { ws.close(); } catch { /* */ }
      ws = null;
    }
    playerId = null;
    playerName = null;
    roomCode = null;
    initialFrame = null;
  }

  function getRoomCode() { return roomCode; }
  function getPlayerId() { return playerId; }
  function isConnected() { return !!ws && ws.readyState === 1; }

  return {
    on,
    create,
    join,
    reconnect,
    sendIntent,
    leave,
    getRoomCode,
    getPlayerId,
    isConnected
  };
}
