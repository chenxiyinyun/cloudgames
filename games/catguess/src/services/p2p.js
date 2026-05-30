import Peer from 'peerjs';
import { createLogger } from './logger';

const log = createLogger('P2P');

const PEER_SERVER = {
  host: '0.peerjs.com',
  port: 443,
  secure: true
};

const METERED_TURN_USERNAME = import.meta.env.VITE_METERED_TURN_USERNAME;
const METERED_TURN_CREDENTIAL = import.meta.env.VITE_METERED_TURN_CREDENTIAL;

const METERED_TURN_SERVERS = METERED_TURN_USERNAME && METERED_TURN_CREDENTIAL
  ? [
    {
      urls: 'turn:standard.relay.metered.ca:80',
      username: METERED_TURN_USERNAME,
      credential: METERED_TURN_CREDENTIAL
    },
    {
      urls: 'turn:standard.relay.metered.ca:80?transport=tcp',
      username: METERED_TURN_USERNAME,
      credential: METERED_TURN_CREDENTIAL
    },
    {
      urls: 'turn:standard.relay.metered.ca:443',
      username: METERED_TURN_USERNAME,
      credential: METERED_TURN_CREDENTIAL
    },
    {
      urls: 'turns:standard.relay.metered.ca:443?transport=tcp',
      username: METERED_TURN_USERNAME,
      credential: METERED_TURN_CREDENTIAL
    }
  ]
  : [];

const PEER_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun.relay.metered.ca:80' },
    ...METERED_TURN_SERVERS
  ]
};

// Translate PeerJS error types to user-friendly Chinese messages
function translatePeerError(err) {
  const type = err?.type || '';
  switch (type) {
    case 'unavailable-id':
      return '房间已被占用（上一次连接的残影），请刷新页面重试';
    case 'peer-unavailable':
      return '无法找到房间，请确认房间号正确';
    case 'disconnected':
      return '与信号服务器断开连接，请检查网络';
    case 'network':
      return '网络连接失败，请检查网络设置或尝试切换网络';
    case 'server-error':
      return '信号服务器出错，请稍后重试';
    case 'browser-incompatible':
      return '当前浏览器不支持 WebRTC（请使用 Chrome/Edge/Firefox）';
    case 'webrtc':
      return '浏览器间连接失败（可能被防火墙阻止），请尝试切换网络';
    case 'socket-error':
      return 'WebSocket 连接失败，请检查网络';
    case 'socket-closed':
      return '与服务器连接中断，请刷新页面重试';
    default:
      return err?.message || '连接失败，请重试';
  }
}

class P2PService {
  constructor() {
    this.peer = null;
    this.connections = [];
    this.onMessage = null;
    this.onPlayerConnected = null;
    this.onPlayerDisconnected = null;
    this.onError = null;
    this.onDeadPeer = null;
    this.isHost = false;
    this.roomCode = null;
    this.playerName = null;

    // Heartbeat
    this._heartbeatInterval = null;
    this._peerLastSeen = new Map();
    this._missedHeartbeats = new Map();

    // Prevent duplicate disconnect callbacks from close+error
    this._disconnectedPeers = new Set();

    // Retry queue for transient send failures
    this._retryQueue = [];
    this._retryTimer = null;
  }

  generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  async createHost(roomCode, playerName) {
    this.isHost = true;
    this.roomCode = roomCode;
    this.playerName = playerName;
    const peerId = `catguess-${roomCode}`;

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('创建房间超时，请重试'));
      }, 15000);

      this.peer = new Peer(peerId, {
        ...PEER_SERVER,
        config: PEER_CONFIG,
        debug: 0
      });

      this.peer.on('open', (id) => {
        clearTimeout(timeout);
        console.log('Host peer created:', id);
        resolve(id);
      });

      this.peer.on('disconnected', () => {
        log.warn('Host peer disconnected from signaling server, attempting reconnect...');
        this.peer.reconnect();
      });

      this.peer.on('error', (err) => {
        clearTimeout(timeout);
        console.error('Host peer error:', err);
        reject(new Error('创建房间失败：' + translatePeerError(err)));
      });

      this.peer.on('connection', (conn) => {
        console.log('New connection from:', conn.peer);
        this._setupConnection(conn);
        if (this.onPlayerConnected) {
          this.onPlayerConnected(conn);
        }
      });
    });
  }

  async joinRoom(roomCode, playerName) {
    this.isHost = false;
    this.roomCode = roomCode;
    this.playerName = playerName;
    const hostPeerId = `catguess-${roomCode}`;
    const guestPeerId = `catguess-guest-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('连接房间超时，请确认房间号正确'));
      }, 15000);

      this.peer = new Peer(guestPeerId, {
        ...PEER_SERVER,
        config: PEER_CONFIG,
        debug: 0
      });

      this.peer.on('open', (id) => {
        console.log('Guest peer created:', id);

        const conn = this.peer.connect(hostPeerId, {
          reliable: true
        });

        let resolved = false;

        conn.on('open', () => {
          if (!resolved) {
            resolved = true;
            clearTimeout(timeout);
            console.log('Connected to host:', hostPeerId);
            this._setupConnection(conn);
            resolve(id);
          }
        });

        conn.on('error', (err) => {
          if (!resolved) {
            resolved = true;
            clearTimeout(timeout);
            console.error('Connection error:', err);
            reject(new Error('无法连接到房间'));
          }
        });
      });

      this.peer.on('error', (err) => {
        clearTimeout(timeout);
        console.error('Guest peer error:', err);
        reject(new Error('加入房间失败：' + translatePeerError(err)));
      });

      // 访客也监听其他玩家的直连（用于托管模式）
      this.peer.on('connection', (conn) => {
        console.log('Direct connection from peer:', conn.peer);
        this._setupConnection(conn);
        if (this.onPlayerConnected) {
          this.onPlayerConnected(conn);
        }
      });
    });
  }

  // 连接到指定 peer（用于托管时互相连接）
  async connectToPeer(peerId) {
    return new Promise((resolve, reject) => {
      const existingConn = this.connections.find(c => c.peer === peerId);
      if (existingConn && existingConn.open) {
        resolve(existingConn);
        return;
      }

      const conn = this.peer.connect(peerId, { reliable: true });
      const timeout = setTimeout(() => {
        reject(new Error(`连接 ${peerId} 超时`));
      }, 10000);

      conn.on('open', () => {
        clearTimeout(timeout);
        console.log('Connected to peer:', peerId);
        this._setupConnection(conn);
        resolve(conn);
      });

      conn.on('error', (err) => {
        clearTimeout(timeout);
        console.error('Peer connection error:', err);
        reject(err);
      });
    });
  }

  _setupConnection(conn) {
    if (this.connections.find(c => c.peer === conn.peer)) return;

    conn.on('data', (data) => {
      // Intercept internal P2P protocol messages BEFORE game message handler
      if (data.type === 'HEARTBEAT' || data.type === 'HEARTBEAT_ACK') {
        this.handleHeartbeat(data, conn.peer);
        return;
      }
      console.log('Received message:', data.type, 'from:', conn.peer);
      if (this.onMessage) {
        this.onMessage(data, conn.peer);
      }
    });

    conn.on('close', () => {
      console.log('Connection closed:', conn.peer);
      this._disconnectedPeers.add(conn.peer);
      this._missedHeartbeats.delete(conn.peer);
      this._peerLastSeen.delete(conn.peer);
      this.connections = this.connections.filter(c => c.peer !== conn.peer);
      if (this.onPlayerDisconnected) {
        this.onPlayerDisconnected(conn.peer);
      }
    });

    conn.on('error', (err) => {
      console.error('Connection error:', err);
      // Avoid duplicate callback if close event already fired
      if (this._disconnectedPeers.has(conn.peer)) return;
      this._disconnectedPeers.add(conn.peer);
      this._missedHeartbeats.delete(conn.peer);
      this._peerLastSeen.delete(conn.peer);
      this.connections = this.connections.filter(c => c.peer !== conn.peer);
      if (this.onPlayerDisconnected) {
        this.onPlayerDisconnected(conn.peer);
      }
    });

    this.connections.push(conn);
  }

  startHeartbeat(intervalMs = 10000) {
    this.stopHeartbeat();
    this._heartbeatInterval = setInterval(() => {
      this.broadcast('HEARTBEAT', { timestamp: Date.now() });
      this.checkDeadPeers();
    }, intervalMs);
    log.info('Heartbeat started', { intervalMs });
  }

  stopHeartbeat() {
    if (this._heartbeatInterval) {
      clearInterval(this._heartbeatInterval);
      this._heartbeatInterval = null;
      log.info('Heartbeat stopped');
    }
  }

  handleHeartbeat(data, peerId) {
    if (data.type === 'HEARTBEAT') {
      // Respond with acknowledgment
      this.sendTo(peerId, 'HEARTBEAT_ACK', { timestamp: data.payload.timestamp });
    } else if (data.type === 'HEARTBEAT_ACK') {
      // Peer acknowledged our heartbeat — reset missed count
      this._peerLastSeen.set(peerId, Date.now());
      this._missedHeartbeats.set(peerId, 0);
    }
  }

  checkDeadPeers(maxMissed = 3) {
    for (const conn of this.connections) {
      if (!conn.open) continue;
      const peerId = conn.peer;
      const missed = (this._missedHeartbeats.get(peerId) || 0) + 1;
      this._missedHeartbeats.set(peerId, missed);
      if (missed > maxMissed) {
        log.warn('Dead peer detected', { peerId, missed, maxMissed });
        if (this.onDeadPeer) {
          this.onDeadPeer(peerId);
        }
        // Clean up dead connection tracking
        this._missedHeartbeats.delete(peerId);
        this._peerLastSeen.delete(peerId);
        try { conn.close(); } catch { /* ignore close error */ }
        this.connections = this.connections.filter(c => c.peer !== peerId);
        // Clean up retry queue for the dead peer
        this._retryQueue = this._retryQueue.filter(e => e.peerId !== peerId);
        if (this._retryQueue.length === 0) {
          this._stopRetryTimer();
        }
      }
    }
  }

  // ── Retry queue ──────────────────────────────────────────────────
  _enqueueRetry(peerId, type, payload) {
    this._retryQueue.push({
      peerId,
      type,
      payload,
      attempts: 0,
      nextRetry: Date.now()
    });
    this._ensureRetryTimer();
  }

  _ensureRetryTimer() {
    if (this._retryTimer) return;
    this._retryTimer = setInterval(() => this._processRetryQueue(), 1000);
  }

  _stopRetryTimer() {
    if (this._retryTimer) {
      clearInterval(this._retryTimer);
      this._retryTimer = null;
    }
  }

  _processRetryQueue() {
    const now = Date.now();
    const remaining = [];
    for (const entry of this._retryQueue) {
      if (now < entry.nextRetry) {
        remaining.push(entry);
        continue;
      }
      entry.attempts++;
      const conn = this.connections.find(c => c.peer === entry.peerId);
      if (conn && conn.open) {
        try {
          conn.send({ type: entry.type, payload: entry.payload, timestamp: Date.now() });
          // Success — remove from queue
          continue;
        } catch {
          log.warn('Retry send failed', { peerId: entry.peerId, type: entry.type, attempt: entry.attempts });
        }
      }
      if (entry.attempts >= 3) {
        log.warn('Max retries exceeded, dropping message', { peerId: entry.peerId, type: entry.type });
        continue;
      }
      entry.nextRetry = now + Math.min(1000 * Math.pow(2, entry.attempts - 1), 8000);
      remaining.push(entry);
    }
    this._retryQueue = remaining;
    if (this._retryQueue.length === 0) {
      this._stopRetryTimer();
    }
  }

  broadcast(type, payload) {
    const message = { type, payload, timestamp: Date.now() };
    this.connections.forEach(conn => {
      if (conn.open) {
        try {
          conn.send(message);
        } catch {
          log.warn('broadcast send failed, enqueuing for retry', { peerId: conn.peer, type });
          this._enqueueRetry(conn.peer, type, payload);
        }
      }
    });
  }

  sendTo(peerId, type, payload) {
    const message = { type, payload, timestamp: Date.now() };
    const conn = this.connections.find(c => c.peer === peerId);
    if (conn && conn.open) {
      try {
        conn.send(message);
        return true;
      } catch {
        log.warn('sendTo failed, enqueuing for retry', { peerId, type });
        this._enqueueRetry(peerId, type, payload);
        return false;
      }
    }
    log.warn('sendTo skipped: peer is not connected', { peerId, type });
    return false;
  }

  getConnectedPeers() {
    return this.connections.filter(c => c.open).map(c => c.peer);
  }

  getMyPeerId() {
    return this.peer?.id;
  }

  disconnect() {
    this.stopHeartbeat();
    this._stopRetryTimer();
    this._retryQueue = [];
    this.connections.forEach(conn => conn.close());
    this.connections = [];
    this._missedHeartbeats.clear();
    this._peerLastSeen.clear();
    this._disconnectedPeers.clear();
    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }
    this.isHost = false;
    this.roomCode = null;
    this.playerName = null;
  }
}

export default new P2PService();
