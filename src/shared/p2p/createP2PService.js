import Peer from 'peerjs';
import {
  createPeerConfig,
  HAS_PRIVATE_SIGNALING_SERVER,
  HAS_TURN_RELAY,
  PEER_SERVER,
  SIGNALING_INFO,
  TURN_RELAY_INFO
} from './peerConfig';
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
    this.onConnectionStateChange = null;
    this.onModeChange = null;
    this.isHost = false;
    this.roomCode = null;
    this.playerName = null;

    // 静态诊断信息（启动后不变），供 UI 渲染
    this.signalingInfo = SIGNALING_INFO;
    this.turnRelayInfo = TURN_RELAY_INFO;

    this._heartbeatInterval = null;
    this._peerLastSeen = new Map();
    this._missedHeartbeats = new Map();
    this._disconnectedPeers = new Set();
    this._retryQueue = [];
    this._retryTimer = null;
    this._lastConnectionMode = 'direct-or-relay';
    this._connectionStates = new Map();
    this._recoveryAttempts = new Map();
    this._iceGuardTimers = new Map();
  }

  /**
   * 模式/状态变更通知：让上层（gameStore / UI）能感知直连→中继切换
   * @param {{ phase: 'trying-direct' | 'switching-to-relay' | 'using-relay' | 'failed', reason?: string }} payload
   */
  _emitModeChange(payload) {
    this._lastModeChange = { ...payload, at: Date.now() };
    if (typeof this.onModeChange === 'function') {
      try {
        this.onModeChange(payload);
      } catch (e) {
        this.log.error('onModeChange callback threw', { error: e });
      }
    }
  }

  getLastModeChange() {
    return this._lastModeChange;
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
    this._assertPrivateSignalingConfigured();
    return {
      ...PEER_SERVER,
      config: createPeerConfig({ forceRelay }),
      debug: 0
    };
  }

  _assertPrivateSignalingConfigured() {
    if (!HAS_PRIVATE_SIGNALING_SERVER || !PEER_SERVER?.host) {
      throw new Error('未配置国内/自建 PeerJS 信令，请设置 VITE_PEER_SERVER_HOST。');
    }
  }

  async createHost(roomCode, playerName) {
    this._assertPrivateSignalingConfigured();
    this.isHost = true;
    this.roomCode = roomCode;
    this.playerName = playerName;
    const peerId = this.getHostPeerId(roomCode);

    return new Promise((resolve, reject) => {
      let opened = false;
      const timeout = setTimeout(() => {
        reject(new Error('创建房间超时，请重试'));
      }, 20000);

      this._lastConnectionMode = this._getModeLabel();
      this.peer = new Peer(peerId, this._getPeerOptions());

      this.peer.on('open', (id) => {
        clearTimeout(timeout);
        opened = true;
        this.log.info('Host peer created:', { id });
        resolve(id);
      });

      // 信号层掉线：指数退避 + 最大尝试次数。
      // 历史 bug：直接 this.peer.reconnect() 无任何节流，信令一抖动就紧密重连循环
      // 现在：1s → 2s → 4s → 8s → 16s（第 5 次），再掉就放弃，把控制权交给
      //       gameStore.startAutoReconnect（再退避 1→32s、最多 8 次、整 peer 重建）
      let _disconnectAttempts = 0;
      const MAX_DISCONNECT_ATTEMPTS = 5;
      this.peer.on('disconnected', () => {
        if (_disconnectAttempts >= MAX_DISCONNECT_ATTEMPTS) {
          this.log.warn(
            `Host peer signaling reconnect aborted after ${MAX_DISCONNECT_ATTEMPTS} attempts; deferring to game-layer auto-reconnect`
          );
          return;
        }
        const delay = Math.min(1000 * 2 ** _disconnectAttempts, 30000);
        _disconnectAttempts++;
        this.log.warn(
          `Host peer disconnected from signaling server, reconnect attempt ${_disconnectAttempts}/${MAX_DISCONNECT_ATTEMPTS} in ${delay}ms`
        );
        setTimeout(() => {
          if (this.peer && !this.peer.destroyed) {
            this.peer.reconnect();
          }
        }, delay);
      });
      this.peer.on('open', () => {
        if (_disconnectAttempts > 0) {
          this.log.info(`Host peer signaling reconnected after ${_disconnectAttempts} attempt(s)`);
          _disconnectAttempts = 0;
        }
      });

      this.peer.on('error', (err) => {
        // peer-unavailable 是非致命的信令层噪音：访客在协商完成前离开了信令服务器
        // （常见于访客直连超时后销毁旧 peer 改走中继、或访客刷新/离开）。
        // 房主 peer 不受影响，忽略即可，否则会污染日志甚至连接状态。
        if (err?.type === 'peer-unavailable') {
          this.log.warn('Ignoring peer-unavailable on host (guest left signaling before negotiation finished)', { message: err?.message });
          return;
        }
        this.log.error('Host peer error:', { error: err });
        // peer 已建立后才出现的其它错误，promise 早已 settle，仅记录不再 reject
        if (!opened) {
          clearTimeout(timeout);
          reject(new Error('创建房间失败：' + translatePeerError(err)));
        }
      });

      this.peer.on('connection', (conn) => {
        this.log.info('New connection from:', { peer: conn.peer });
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
    const canRelay = HAS_TURN_RELAY && this._getModeLabel() !== 'relay';

    // 进入尝试阶段，通知 UI
    this._emitModeChange({ phase: 'trying-direct', mode: 'direct-or-relay' });

    try {
      return await this._joinRoom(roomCode, {
        forceRelay: false,
        timeout: canRelay ? 4000 : 20000
      });
    } catch (err) {
      const isIceFailed = err && err.code === 'ICE_FAILED';
      const isTimeout = err && err.code === 'JOIN_TIMEOUT';
      const isNoCandidates = err && err.code === 'NO_SRFLX_CANDIDATES';
      if (!canRelay) {
        throw err;
      }
      const reason = isNoCandidates
        ? 'STUN 未返回候选地址，直连不可用，切到 TURN 中继'
        : isIceFailed
          ? '直连 ICE 失败，切到 TURN 中继'
          : '直连超时，切到 TURN 中继';
      this.log.warn(
        'Room join failed, switching to relay-only TURN',
        { roomCode, reason, error: err }
      );
      this._emitModeChange({ phase: 'switching-to-relay', mode: 'relay', reason });
      this._destroyPeerOnly();
      return this._joinRoom(roomCode, { forceRelay: true, timeout: 15000 });
    }
  }

  async _joinRoom(roomCode, { forceRelay = false, timeout: timeoutMs = 15000 } = {}) {
    this._assertPrivateSignalingConfigured();
    const hostPeerId = this.getHostPeerId(roomCode);
    const guestPeerId = this.getGuestPeerId();

    return new Promise((resolve, reject) => {
      let settled = false;
      const settle = (fn, value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        fn(value);
      };

      const timeout = setTimeout(() => {
        const err = new Error('连接房间超时，请确认房间号正确');
        err.code = 'JOIN_TIMEOUT';
        settle(reject, err);
      }, timeoutMs);

      this._lastConnectionMode = this._getModeLabel({ forceRelay });
      this.peer = new Peer(guestPeerId, this._getPeerOptions({ forceRelay }));

      this.peer.on('open', (id) => {
        this.log.info('Guest peer created:', { id });

        const conn = this.peer.connect(hostPeerId, {
          reliable: true
        });

        conn.on('open', () => {
          settle(resolve, id);
          this.log.info('Connected to host:', { hostPeerId });
          this._setupConnection(conn);
        });

        conn.on('error', (err) => {
          this.log.error('Connection error:', { error: err });
          settle(reject, new Error('无法连接到房间'));
        });

        const onIceStateChange = () => {
          const pc = conn.peerConnection;
          if (!pc) return;
          const state = pc.iceConnectionState;
          this.log.debug('Join ICE state', { state, forceRelay, hostPeerId });
          if (state === 'failed' && !forceRelay) {
            this.log.warn('ICE failed during direct connect, signaling fallback to relay', { hostPeerId });
            const err = new Error('ICE connection failed');
            err.code = 'ICE_FAILED';
            settle(reject, err);
          } else if (state === 'connected' || state === 'completed') {
            this._emitModeChange({
              phase: forceRelay ? 'using-relay' : 'trying-direct',
              mode: this._lastConnectionMode,
              iceState: state
            });
          }
        };

        // srflx 候选早期检测：直连模式下，2s 内没收到 server-reflexive 候选
        // 说明 STUN 不通（防火墙/对称 NAT），立即放弃直连切中继
        const setupCandidateWatch = (pc) => {
          if (forceRelay) return;
          let hasSrflx = false;
          const candidateTimer = setTimeout(() => {
            if (!hasSrflx && !settled) {
              this.log.warn('No srflx candidates within 2s, bailing to relay', { hostPeerId });
              const err = new Error('No server-reflexive candidates');
              err.code = 'NO_SRFLX_CANDIDATES';
              settle(reject, err);
            }
          }, 2000);
          conn.on('open', () => clearTimeout(candidateTimer));
          pc.addEventListener?.('icecandidate', (e) => {
            if (e.candidate && e.candidate.type === 'srflx') {
              hasSrflx = true;
            }
          });
        };

        const attachWhenReady = () => {
          if (conn.peerConnection) {
            conn.peerConnection.addEventListener?.('iceconnectionstatechange', onIceStateChange);
            setupCandidateWatch(conn.peerConnection);
          } else {
            setTimeout(attachWhenReady, 50);
          }
        };
        attachWhenReady();
      });

      this.peer.on('error', (err) => {
        this.log.error('Guest peer error:', { error: err });
        settle(reject, new Error('加入房间失败：' + translatePeerError(err)));
      });

      this.peer.on('connection', (conn) => {
        this.log.info('Direct connection from peer:', { peer: conn.peer });
        this._setupConnection(conn);
        if (this.onPlayerConnected) {
          this.onPlayerConnected(conn);
        }
      });
    });
  }

  async connectToPeer(peerId, { timeout = 15000, retries = 1 } = {}) {
    this._assertPrivateSignalingConfigured();
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
        this.log.info('Connected to peer:', { peerId });
        this._setupConnection(conn);
        resolve(conn);
      });

      conn.on('error', (err) => {
        clearTimeout(timeout);
        this.log.error('Peer connection error:', { error: err });
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
      this.log.debug('Received message:', { type: data.type, from: conn.peer });
      if (this.onMessage) {
        this.onMessage(data, conn.peer);
      }
    });

    conn.on('close', () => {
      this.log.info('Connection closed:', { peer: conn.peer });
      this._disconnectedPeers.add(conn.peer);
      this._missedHeartbeats.delete(conn.peer);
      this._peerLastSeen.delete(conn.peer);
      this._connectionStates.delete(conn.peer);
      this._recoveryAttempts.delete(conn.peer);
      this.resetRecoveryState(conn.peer);
      this.connections = this.connections.filter(c => c.peer !== conn.peer);
      if (this.onPlayerDisconnected) {
        this.onPlayerDisconnected(conn.peer);
      }
    });

    conn.on('error', (err) => {
      this.log.error('Connection error:', { peer: conn.peer, error: err });
      if (this._disconnectedPeers.has(conn.peer)) return;
      this._disconnectedPeers.add(conn.peer);
      this._missedHeartbeats.delete(conn.peer);
      this._peerLastSeen.delete(conn.peer);
      this._connectionStates.delete(conn.peer);
      this._recoveryAttempts.delete(conn.peer);
      this.resetRecoveryState(conn.peer);
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
      const iceState = pc.iceConnectionState;
      const state = {
        mode: this._lastConnectionMode,
        iceConnectionState: iceState,
        connectionState: pc.connectionState
      };
      this._connectionStates.set(conn.peer, state);

      // Fire callback for game layer to react
      if (this.onConnectionStateChange) {
        this.onConnectionStateChange({ peerId: conn.peer, ...state });
      }

      // ICE restart logic: auto-recover from transient disconnections
      if (iceState === 'disconnected') {
        // Start 3s guard timer to prevent flicker restart
        if (!this._iceGuardTimers.has(conn.peer)) {
          const timer = setTimeout(() => {
            this._iceGuardTimers.delete(conn.peer);
            const currentState = pc.iceConnectionState;
            if (currentState === 'disconnected') {
              const attempts = (this._recoveryAttempts.get(conn.peer) || 0) + 1;
              this._recoveryAttempts.set(conn.peer, attempts);
              this.log.warn('ICE disconnected, triggering restartIce', { peerId: conn.peer, attempt: attempts });
              try { pc.restartIce(); } catch (e) { this.log.error('restartIce failed', { error: e }); }
            }
          }, 3000);
          this._iceGuardTimers.set(conn.peer, timer);
        }
      } else if (iceState === 'failed') {
        // Browser already waited ~30s consent timeout — restart immediately
        const attempts = (this._recoveryAttempts.get(conn.peer) || 0) + 1;
        this._recoveryAttempts.set(conn.peer, attempts);
        this.log.warn('ICE failed, triggering restartIce immediately', { peerId: conn.peer, attempt: attempts });
        try { pc.restartIce(); } catch (e) { this.log.error('restartIce failed', { error: e }); }
      } else if (iceState === 'connected' || iceState === 'completed') {
        // Recovery succeeded — reset
        this.resetRecoveryState(conn.peer);
      }
    };

    updateState();
    pc.addEventListener?.('iceconnectionstatechange', updateState);
    pc.addEventListener?.('connectionstatechange', updateState);
  }

  getPeerConnectionState(peerId) {
    return this._connectionStates.get(peerId) || { mode: this._lastConnectionMode };
  }

  resetRecoveryState(peerId) {
    this._recoveryAttempts.delete(peerId);
    this._missedHeartbeats.set(peerId, 0);
    const timer = this._iceGuardTimers.get(peerId);
    if (timer) { clearTimeout(timer); this._iceGuardTimers.delete(peerId); }
  }

  disconnectPeer(peerId) {
    const conn = this.connections.find(c => c.peer === peerId);
    if (conn) {
      try { conn.close(); } catch { /* ignore */ }
      this.connections = this.connections.filter(c => c.peer !== peerId);
      this._missedHeartbeats.delete(peerId);
      this._peerLastSeen.delete(peerId);
      this._disconnectedPeers.add(peerId);
      this._connectionStates.delete(peerId);
      this._recoveryAttempts.delete(peerId);
      this.resetRecoveryState(peerId);
    }
  }

  softDisconnect() {
    this.stopHeartbeat();
    this._stopRetryTimer();
    this._retryQueue = [];
    this.connections.forEach(conn => {
      try { conn.close(); } catch { /* ignore close error */ }
    });
    this.connections = [];
    this._missedHeartbeats.clear();
    this._peerLastSeen.clear();
    this._disconnectedPeers.clear();
    this._connectionStates.clear();
    this._recoveryAttempts.clear();
    for (const timer of this._iceGuardTimers.values()) { clearTimeout(timer); }
    this._iceGuardTimers.clear();
    this._destroyPeerOnly();
    this.isHost = false;
    this.roomCode = null;
    this.playerName = null;
  }

  getConnectionDiagnostics() {
    return {
      // 当前连接模式：'direct-or-relay' / 'relay' / 'unknown'
      mode: this._lastConnectionMode,
      // 信令源信息（启动时确定）
      signaling: this.signalingInfo,
      hasTurnRelay: HAS_TURN_RELAY,
      // TURN 中继信息（启动时确定）
      turnRelay: this.turnRelayInfo,
      // 最近的模式变更事件
      lastModeChange: this._lastModeChange || null,
      // 每个对端连接的状态
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
    this._recoveryAttempts.clear();
    for (const timer of this._iceGuardTimers.values()) { clearTimeout(timer); }
    this._iceGuardTimers.clear();
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
