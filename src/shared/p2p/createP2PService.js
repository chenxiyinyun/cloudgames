import Peer from 'peerjs';
import { createPeerConfig, HAS_METERED_TURN, PEER_SERVER } from './peerConfig';
import { translatePeerError } from './peerErrors';
import { generateRoomCode } from './roomCode';

const noopLogger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {}
};

export class P2PService {
  constructor({ gameId, logger = noopLogger }) {
    if (!gameId) {
      throw new Error('createP2PService requires a gameId');
    }

    this.gameId = gameId;
    this.log = logger;
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

    this._heartbeatInterval = null;
    this._peerLastSeen = new Map();
    this._missedHeartbeats = new Map();
    this._disconnectedPeers = new Set();
    this._retryQueue = [];
    this._retryTimer = null;
    this._lastConnectionMode = 'direct-or-relay';
    this._connectionStates = new Map();
  }

  generateRoomCode() {
    return generateRoomCode();
  }

  getHostPeerId(roomCode) {
    return `${this.gameId}-${roomCode}`;
  }

  getGuestPeerId() {
    return `${this.gameId}-guest-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  getConnectionMode() {
    return this._lastConnectionMode;
  }

  _getPeerOptions({ forceRelay = false } = {}) {
    return {
      ...PEER_SERVER,
      config: createPeerConfig({ forceRelay }),
      debug: 0
    };
  }

  async createHost(roomCode, playerName) {
    this.isHost = true;
    this.roomCode = roomCode;
    this.playerName = playerName;
    const peerId = this.getHostPeerId(roomCode);

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('创建房间超时，请重试'));
      }, 20000);

      this._lastConnectionMode = this._getModeLabel();
      this.peer = new Peer(peerId, this._getPeerOptions());

      this.peer.on('open', (id) => {
        clearTimeout(timeout);
        console.log('Host peer created:', id);
        resolve(id);
      });

      this.peer.on('disconnected', () => {
        this.log.warn('Host peer disconnected from signaling server, attempting reconnect...');
        this.peer?.reconnect();
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

    // 是否还有中继兜底可用（已有 TURN，且当前不是纯中继模式）
    const canRelay = HAS_METERED_TURN && this._getModeLabel() !== 'relay';

    try {
      // 有中继兜底时，直连用较短超时以尽快放弃、进入中继；
      // 没有兜底时这是唯一一次机会，给足时间避免高延迟下误超时。
      return await this._joinRoom(roomCode, {
        forceRelay: false,
        timeout: canRelay ? 12000 : 20000
      });
    } catch (err) {
      if (!canRelay) {
        throw err;
      }
      this.log.warn('Room join failed, retrying with relay-only TURN', { roomCode, error: err });
      this._destroyPeerOnly();
      // 中继节点多在境外、RTT 高，relay 路径给足时间。
      return this._joinRoom(roomCode, { forceRelay: true, timeout: 25000 });
    }
  }

  async _joinRoom(roomCode, { forceRelay = false, timeout: timeoutMs = 15000 } = {}) {
    const hostPeerId = this.getHostPeerId(roomCode);
    const guestPeerId = this.getGuestPeerId();

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('连接房间超时，请确认房间号正确'));
      }, timeoutMs);

      this._lastConnectionMode = this._getModeLabel({ forceRelay });
      this.peer = new Peer(guestPeerId, this._getPeerOptions({ forceRelay }));

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

      this.peer.on('connection', (conn) => {
        console.log('Direct connection from peer:', conn.peer);
        this._setupConnection(conn);
        if (this.onPlayerConnected) {
          this.onPlayerConnected(conn);
        }
      });
    });
  }

  async connectToPeer(peerId, { timeout = 15000, retries = 1 } = {}) {
    const existingConn = this.connections.find(c => c.peer === peerId);
    if (existingConn && existingConn.open) {
      return existingConn;
    }

    let lastErr = null;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await this._connectToPeerOnce(peerId, timeout);
      } catch (err) {
        lastErr = err;
        this.log.warn('connectToPeer attempt failed', { peerId, attempt, error: err?.message });
      }
    }
    throw lastErr ?? new Error(`连接 ${peerId} 失败`);
  }

  _connectToPeerOnce(peerId, timeoutMs) {
    return new Promise((resolve, reject) => {
      const conn = this.peer.connect(peerId, {
        reliable: true,
        metadata: { iceMode: this._lastConnectionMode }
      });
      const timeout = setTimeout(() => {
        reject(new Error(`连接 ${peerId} 超时`));
      }, timeoutMs);

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

  _getModeLabel({ forceRelay = false } = {}) {
    if (forceRelay) return 'relay';
    return createPeerConfig().iceTransportPolicy === 'relay' ? 'relay' : 'direct-or-relay';
  }

  _setupConnection(conn) {
    if (this.connections.find(c => c.peer === conn.peer)) return;
    this._watchConnectionState(conn);

    conn.on('data', (data) => {
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
      this._connectionStates.delete(conn.peer);
      this.connections = this.connections.filter(c => c.peer !== conn.peer);
      if (this.onPlayerDisconnected) {
        this.onPlayerDisconnected(conn.peer);
      }
    });

    conn.on('error', (err) => {
      console.error('Connection error:', err);
      if (this._disconnectedPeers.has(conn.peer)) return;
      this._disconnectedPeers.add(conn.peer);
      this._missedHeartbeats.delete(conn.peer);
      this._peerLastSeen.delete(conn.peer);
      this._connectionStates.delete(conn.peer);
      this.connections = this.connections.filter(c => c.peer !== conn.peer);
      if (this.onPlayerDisconnected) {
        this.onPlayerDisconnected(conn.peer);
      }
    });

    this.connections.push(conn);
  }

  _watchConnectionState(conn) {
    const pc = conn.peerConnection;
    if (!pc) {
      this._connectionStates.set(conn.peer, { mode: this._lastConnectionMode });
      return;
    }

    const updateState = () => {
      this._connectionStates.set(conn.peer, {
        mode: this._lastConnectionMode,
        iceConnectionState: pc.iceConnectionState,
        connectionState: pc.connectionState
      });
    };

    updateState();
    pc.addEventListener?.('iceconnectionstatechange', updateState);
    pc.addEventListener?.('connectionstatechange', updateState);
  }

  getConnectionDiagnostics() {
    return {
      mode: this._lastConnectionMode,
      hasMeteredTurn: HAS_METERED_TURN,
      peers: Object.fromEntries(this._connectionStates)
    };
  }

  startHeartbeat(intervalMs = 10000) {
    this.stopHeartbeat();
    this._heartbeatInterval = setInterval(() => {
      this.broadcast('HEARTBEAT', { timestamp: Date.now() });
      this.checkDeadPeers();
    }, intervalMs);
    this.log.info('Heartbeat started', { intervalMs });
  }

  stopHeartbeat() {
    if (this._heartbeatInterval) {
      clearInterval(this._heartbeatInterval);
      this._heartbeatInterval = null;
      this.log.info('Heartbeat stopped');
    }
  }

  handleHeartbeat(data, peerId) {
    if (data.type === 'HEARTBEAT') {
      this.sendTo(peerId, 'HEARTBEAT_ACK', { timestamp: data.payload.timestamp });
    } else if (data.type === 'HEARTBEAT_ACK') {
      this._peerLastSeen.set(peerId, Date.now());
      this._missedHeartbeats.set(peerId, 0);
    }
  }

  checkDeadPeers(maxMissedOrTimeout = 3, maxMissedOverride = null) {
    const maxMissed = maxMissedOverride ?? maxMissedOrTimeout;
    for (const conn of this.connections) {
      if (!conn.open) continue;
      const peerId = conn.peer;
      const missed = (this._missedHeartbeats.get(peerId) || 0) + 1;
      this._missedHeartbeats.set(peerId, missed);
      if (missed > maxMissed) {
        this.log.warn('Dead peer detected', { peerId, missed, maxMissed });
        if (this.onDeadPeer) {
          this.onDeadPeer(peerId);
        }
        this._missedHeartbeats.delete(peerId);
        this._peerLastSeen.delete(peerId);
        try { conn.close(); } catch { /* ignore close error */ }
        this.connections = this.connections.filter(c => c.peer !== peerId);
        this._retryQueue = this._retryQueue.filter(e => e.peerId !== peerId);
        if (this._retryQueue.length === 0) {
          this._stopRetryTimer();
        }
      }
    }
  }

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
          continue;
        } catch {
          this.log.warn('Retry send failed', { peerId: entry.peerId, type: entry.type, attempt: entry.attempts });
        }
      }
      if (entry.attempts >= 3) {
        this.log.warn('Max retries exceeded, dropping message', { peerId: entry.peerId, type: entry.type });
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
          this.log.warn('broadcast send failed, enqueuing for retry', { peerId: conn.peer, type });
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
        this.log.warn('sendTo failed, enqueuing for retry', { peerId, type });
        this._enqueueRetry(peerId, type, payload);
        return false;
      }
    }
    this.log.warn('sendTo skipped: peer is not connected', { peerId, type });
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
    this._connectionStates.clear();
    this._destroyPeerOnly();
    this.isHost = false;
    this.roomCode = null;
    this.playerName = null;
  }

  _destroyPeerOnly() {
    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }
  }
}

export function createP2PService(options) {
  return new P2PService(options);
}
