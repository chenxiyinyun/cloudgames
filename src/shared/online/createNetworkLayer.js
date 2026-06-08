/**
 * 通用联机网络层工厂 — 统一三个云游戏的联机流程编排。
 *
 * 把 setupHostHandlers / setupGuestHandlers / auto-reconnect /
 * markPlayerOffline / 通用 guest 消息处理（ROOM_STATE, JOIN_RESPONSE,
 * HOST_MIGRATION, PEER_LIST, CONNECT_TO_PEER）全部内置，
 * 各游戏只需提供差异化配置。
 *
 * Usage:
 *   const net = createNetworkLayer({
 *     gameId: 'catguess',
 *     p2p,
 *     log,
 *     getRoom, setRoom, updateLocalState, setConnectionStatus,
 *     gameState,
 *     roomBroadcaster,
 *     sendJoinRequestBase,
 *     generateOpKey, isDuplicateOp, cleanupOps, resetOps,
 *     getRoomStateDedupeDetail,
 *     MSG,
 *     deepClone,
 *     hostMigratorOptions: { enableWaitBranch: true, onBecomeHost: fn },
 *     markPlayerOfflineExtra: (player) => { player.team = ... },
 *     isLobbyPhase: (room) => room.status === 'WAITING',
 *     handleJoinRequest: (payload, peerId, ctx) => { ... },
 *     handleHostBusinessMessage: (type, payload, peerId, ctx) => { ... },
 *     handleGuestBusinessMessage: (type, payload, peerId, ctx) => { ... },
 *     onGuestConnected: () => { ... },
 *     onGuestJoinRejected: (error) => { ... },
 *     onGuestJoinAccepted: (payload) => { ... },
 *     onRoomStateReceived: (payload) => { ... },
 *     onHostPlayerOffline: (peerId) => { ... },
 *     cleanupExtra: () => { ... }
 *   })
 */

import { createHostMigrationHandler } from './useHostMigration';

// ── Auto-Reconnect Engine ────────────────────────────────────────────────────
const MAX_RECONNECT_ATTEMPTS = 8;
const RECONNECT_POLL_INTERVAL_MS = 3000;

function createAutoReconnect({ p2p, gameState, setConnectionStatus, setupGuestHandlers, sendJoinRequest, log, getHostPeerId, iceCheckingTimeoutMs = 0, onAfterReconnectJoin }) {
  let attempts = 0;
  let timer = null;
  let pollInterval = null;
  let iceCheckingTimer = null;

  function register() {
    p2p.onConnectionStateChange = ({ peerId, iceConnectionState: iceState }) => {
      const hostPeerId = getHostPeerId();

      if (iceState === 'disconnected' || iceState === 'failed') {
        if ((peerId === hostPeerId || gameState.isHost) && !timer) {
          setConnectionStatus('reconnecting', '检测到连接断开，正在自动重连...');
          start();
        }
      } else if (iceState === 'connected' || iceState === 'completed') {
        cancel();
        if (iceCheckingTimer) { clearTimeout(iceCheckingTimer); iceCheckingTimer = null; }
        if (gameState.connectionStatus === 'reconnecting') {
          setConnectionStatus('connected', '已连接');
        }
        attempts = 0;
      } else if (iceState === 'checking' && iceCheckingTimeoutMs > 0) {
        if (iceCheckingTimer) clearTimeout(iceCheckingTimer);
        iceCheckingTimer = setTimeout(() => {
          const state = p2p.getPeerConnectionState(hostPeerId);
          if (state?.iceConnectionState === 'checking' && !timer) {
            setConnectionStatus('reconnecting', '连接建立超时，正在重试...');
            start();
          }
        }, iceCheckingTimeoutMs);
      }
    };

    if (pollInterval) return;
    pollInterval = setInterval(() => {
      if (!gameState.roomCode) return;
      const hostPeerId = getHostPeerId();
      const state = p2p.getPeerConnectionState(hostPeerId);
      if (state?.iceConnectionState === 'failed' && !timer) {
        start();
      }
    }, RECONNECT_POLL_INTERVAL_MS);
  }

  async function start() {
    if (attempts >= MAX_RECONNECT_ATTEMPTS) {
      setConnectionStatus('error', '连接失败，请检查网络后手动重连');
      cancel();
      return;
    }

    attempts++;

    const baseDelay = Math.min(1000 * Math.pow(2, attempts - 1), 32000);
    const jitter = baseDelay * (0.75 + Math.random() * 0.5);

    timer = setTimeout(async () => {
      timer = null;
      try {
        if (gameState.isHost) {
          const connectedPeers = p2p.getConnectedPeers();
          if (connectedPeers.length > 0) {
            cancel();
            setConnectionStatus('connected', '已连接');
            attempts = 0;
            return;
          }
          start();
        } else {
          const ok = await reconnectInternal();
          if (!ok) {
            log.warn('Auto-reconnect attempt timed out', { attempt: attempts });
            start();
          }
        }
      } catch (err) {
        log.warn('Auto-reconnect attempt failed', { attempt: attempts, error: err?.message });
        start();
      }
    }, jitter);
  }

  function cancel() {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  }

  async function reconnectInternal() {
    if (!gameState.roomCode || !gameState.playerName) return false;

    p2p.softDisconnect();
    gameState.connected = false;

    await p2p.joinRoom(gameState.roomCode, gameState.playerName);
    setupGuestHandlers();

    sendJoinRequest(gameState.playerId, gameState.playerName, true);

    if (onAfterReconnectJoin) onAfterReconnectJoin();

    return new Promise((resolve) => {
      let settled = false;
      let timeout = null;
      let checkInterval = null;
      const finish = (ok) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        clearInterval(checkInterval);
        resolve(ok);
      };
      timeout = setTimeout(() => finish(false), 10000);
      checkInterval = setInterval(() => {
        if (gameState.connected) {
          finish(true);
        }
      }, 500);
    });
  }

  function cleanup() {
    cancel();
    if (iceCheckingTimer) {
      clearTimeout(iceCheckingTimer);
      iceCheckingTimer = null;
    }
    if (pollInterval) {
      clearInterval(pollInterval);
      pollInterval = null;
    }
    attempts = 0;
  }

  return { register, cleanup, get attempts() { return attempts; }, MAX_ATTEMPTS: MAX_RECONNECT_ATTEMPTS };
}

// ── Disconnected Player Cleanup ──────────────────────────────────────────────
const LOBBY_DISCONNECT_TIMEOUT_MS = 30 * 1000;
const LOBBY_CLEANUP_INTERVAL_MS = 10 * 1000;

function createOfflinePlayerManager({ getRoom, removePlayerFromRoom, broadcastState, isLobbyPhase, log, markPlayerOfflineExtra }) {
  let cleanupTimer = null;

  function markOffline(peerId) {
    const room = getRoom();
    const player = room?.players?.find(p => p._peerId === peerId);
    if (!player || !room) return;

    player.isOnline = false;
    if (!room.disconnectedPlayers) {
      room.disconnectedPlayers = [];
    }
    const alreadyTracked = room.disconnectedPlayers.find(p => p.id === player.id);
    if (!alreadyTracked) {
      const entry = { id: player.id, name: player.name, disconnectedAt: Date.now() };
      if (markPlayerOfflineExtra) {
        markPlayerOfflineExtra(player, entry);
      }
      room.disconnectedPlayers.push(entry);
    }

    if (isLobbyPhase(room)) {
      scheduleCleanup();
    }
  }

  function doCleanup() {
    const room = getRoom();
    if (!room?.disconnectedPlayers?.length) return;

    if (!isLobbyPhase(room)) {
      clearCleanupTimer();
      return;
    }

    const now = Date.now();
    const stale = room.disconnectedPlayers.filter(
      p => now - p.disconnectedAt > LOBBY_DISCONNECT_TIMEOUT_MS
    );

    if (stale.length === 0) return;

    log.info('Removing stale disconnected players from lobby', { count: stale.length });

    stale.forEach(sp => {
      removePlayerFromRoom(room, sp.id);
    });

    if (room.disconnectedPlayers.length === 0) {
      clearCleanupTimer();
    }

    broadcastState();
  }

  function scheduleCleanup() {
    if (cleanupTimer) return;
    cleanupTimer = setTimeout(() => {
      cleanupTimer = null;
      doCleanup();
      if (getRoom()?.disconnectedPlayers?.length > 0) {
        scheduleCleanup();
      }
    }, LOBBY_CLEANUP_INTERVAL_MS);
  }

  function clearCleanupTimer() {
    if (cleanupTimer) {
      clearTimeout(cleanupTimer);
      cleanupTimer = null;
    }
  }

  return { markOffline, clearCleanupTimer };
}

// ── Main Factory ─────────────────────────────────────────────────────────────

export function createNetworkLayer({
  gameId,
  p2p,
  log,
  getRoom,
  setRoom,
  updateLocalState,
  setConnectionStatus,
  gameState,
  roomBroadcaster,
  sendJoinRequestBase,
  generateOpKey,
  isDuplicateOp,
  cleanupOps,
  resetOps,
  getRoomStateDedupeDetail,
  MSG,
  deepClone,
  hostMigratorOptions = {},
  isLobbyPhase = (room) => room?.status === 'waiting' || room?.phase === 'waiting',
  markPlayerOfflineExtra,
  removePlayerFromRoom,
  handleJoinRequest,
  handleHostBusinessMessage,
  handleGuestBusinessMessage,
  onGuestConnected,
  onGuestJoinRejected,
  onGuestJoinAccepted,
  onRoomStateReceived,
  onHostPlayerOffline,
  cleanupExtra
}) {
  const getHostPeerId = () => `${gameId}-${gameState.roomCode}`;

  // 共享房主迁移处理器
  const hostMigrator = createHostMigrationHandler({
    gameId,
    p2p,
    log,
    ...hostMigratorOptions
  });

  // Auto-reconnect engine
  const autoReconnect = createAutoReconnect({
    p2p,
    gameState,
    setConnectionStatus,
    setupGuestHandlers: () => setupGuestHandlers(),
    sendJoinRequest: sendJoinRequestBase,
    log,
    getHostPeerId,
    iceCheckingTimeoutMs: hostMigratorOptions.iceCheckingTimeoutMs || 0,
    onAfterReconnectJoin: hostMigratorOptions.onAfterReconnectJoin
  });

  // Offline player manager
  const offlineManager = createOfflinePlayerManager({
    getRoom,
    removePlayerFromRoom,
    broadcastState: () => broadcastState(),
    isLobbyPhase,
    log,
    markPlayerOfflineExtra
  });

  // ── broadcastState ───────────────────────────────────────────────────────
  function broadcastState(options = {}) {
    const room = getRoom();
    if (!room) return null;
    if (cleanupOps) cleanupOps();
    return roomBroadcaster.broadcastState({
      forceFull: options.forceFull ?? false,
      error: options.error || null
    });
  }

  function resetBroadcastState() {
    roomBroadcaster.resetBroadcastState();
  }

  // ── setupHostHandlers ────────────────────────────────────────────────────
  function setupHostHandlers() {
    p2p.onPlayerConnected = (conn) => {
      log.info('Player connected:', { peer: conn.peer });
      if (getRoom()) {
        setTimeout(() => {
          const otherPeers = p2p.getConnectedPeers().filter(id => id !== conn.peer);
          if (otherPeers.length > 0) {
            p2p.sendTo(conn.peer, MSG.PEER_LIST, { peers: otherPeers });
          }
        }, 500);
      }
    };

    p2p.onPlayerDisconnected = (peerId) => {
      log.info('Player disconnected:', { peerId });
      offlineManager.markOffline(peerId);
      if (onHostPlayerOffline) onHostPlayerOffline(peerId);
      broadcastState();
    };

    p2p.onMessage = (data, peerId) => {
      dispatchHostMessage(data, peerId);
    };

    p2p.onError = (err) => {
      log.error('Host error:', { error: err });
      gameState.error = err.message;
      setConnectionStatus('error', err.message);
    };

    p2p.startHeartbeat(10000);
    p2p.onDeadPeer = (peerId) => {
      log.warn('Host detected dead peer', { peerId });
      offlineManager.markOffline(peerId);
      if (onHostPlayerOffline) onHostPlayerOffline(peerId);
      broadcastState();
    };

    autoReconnect.register();
  }

  // ── setupGuestHandlers ───────────────────────────────────────────────────
  function setupGuestHandlers() {
    p2p.onPlayerDisconnected = (peerId) => {
      log.info('Guest disconnected from peer:', { peerId });
      const hostPeerId = getHostPeerId();
      if (peerId === hostPeerId) {
        if (hostMigrator.isMigrationInProgress()) {
          log.info('onPlayerDisconnected: migration already in progress, skipping');
          return;
        }
        log.info('Host disconnected! Attempting migration...');
        doHostMigrate();
      }
    };

    p2p.onMessage = (data, peerId) => {
      dispatchGuestMessage(data, peerId);
    };

    p2p.onError = (err) => {
      log.error('Guest error:', { error: err });
      gameState.error = err.message;
      setConnectionStatus('error', err.message);
    };

    p2p.startHeartbeat(10000);
    p2p.onDeadPeer = (peerId) => {
      log.warn('Guest detected dead peer', { peerId });
      const hostPeerId = getHostPeerId();
      if (peerId === hostPeerId) {
        if (hostMigrator.isMigrationInProgress()) {
          log.info('onDeadPeer: migration already in progress, skipping');
          return;
        }
        log.warn('Host is dead, triggering migration');
        doHostMigrate();
      }
    };

    autoReconnect.register();
  }

  // ── Host Migration ───────────────────────────────────────────────────────
  async function doHostMigrate() {
    await hostMigrator.handleHostDisconnect(getRoom(), gameState, {
      broadcastState,
      setupHostHandlers,
      setConnectionStatus,
      enableWaitBranch: !!hostMigratorOptions.enableWaitBranch,
      onBecomeHost: hostMigratorOptions.onBecomeHost,
      rebuildHostPeer: hostMigratorOptions.rebuildHostPeer
    });
  }

  // ── Host Message Dispatch ────────────────────────────────────────────────
  function dispatchHostMessage(data, peerId) {
    const type = data?.type;
    const payload = data?.payload || {};
    const room = getRoom();

    if (!room) return;

    switch (type) {
      case MSG.JOIN_REQUEST:
        if (handleJoinRequest) {
          handleJoinRequest(payload, peerId, { room, p2p, MSG, deepClone, broadcastState, generateOpKey, isDuplicateOp, getRoom, log });
        }
        break;
      case MSG.REQUEST_STATE:
        if (isDuplicateOp(type, payload, room.code)) return;
        p2p.sendTo(peerId, MSG.ROOM_STATE, { room: deepClone(room), detail: getRoomStateDedupeDetail(room) });
        break;
      default:
        if (handleHostBusinessMessage) {
          handleHostBusinessMessage(type, payload, peerId, { room, p2p, MSG, deepClone, broadcastState, generateOpKey, isDuplicateOp, getRoom, log });
        }
    }
  }

  // ── Guest Message Dispatch ───────────────────────────────────────────────
  function dispatchGuestMessage(data, peerId) {
    const type = data?.type;
    const payload = data?.payload || {};

    switch (type) {
      case MSG.ROOM_STATE:
        applyRoomStatePayload(payload);
        break;

      case MSG.JOIN_RESPONSE:
        if (payload.success === false) {
          const errMsg = payload.error || '加入房间失败';
          gameState.connected = false;
          gameState.connecting = false;
          gameState.error = errMsg;
          setConnectionStatus('error', errMsg);
          if (onGuestJoinRejected) onGuestJoinRejected(errMsg);
        } else {
          gameState.connected = true;
          gameState.connecting = false;
          gameState.error = null;
          setConnectionStatus('connected', 'Mission joined.');
          if (payload.room) {
            setRoom(payload.room);
            updateLocalState(payload.room);
          }
          if (onGuestJoinAccepted) onGuestJoinAccepted(payload);
        }
        break;

      case MSG.HOST_MIGRATION: {
        try {
          const { newHostId, newHostPeerId, room } = payload;
          log.info('Host migration to:', { newHostId });

          if (newHostId === gameState.playerId) {
            break;
          }

          hostMigrator.resetMigrationMutex();
          log.info('Host migration resolved by peer', { newHostId });

          setRoom(room);
          updateLocalState(getRoom());

          p2p.connectToPeer(newHostPeerId).then(() => {
            setConnectionStatus('connected', '已连接到新房主');
            gameState.connected = true;
          }).catch((err) => {
            log.error('Failed to connect to new host:', { error: err });
          });
        } catch (err) {
          log.error('handleGuestMessage:HOST_MIGRATION error', { error: err });
        }
        break;
      }

      case MSG.PEER_LIST: {
        try {
          const { peers } = payload;
          if (peers && peers.length > 0) {
            peers.forEach(async (targetPeerId) => {
              try {
                await p2p.connectToPeer(targetPeerId);
              } catch (err) {
                log.error('Failed to connect to peer:', { peerId: targetPeerId, error: err });
              }
            });
          }
        } catch (err) {
          log.error('handleGuestMessage:PEER_LIST error', { error: err });
        }
        break;
      }

      case MSG.CONNECT_TO_PEER: {
        try {
          const { peerId: targetPeerId } = payload;
          p2p.connectToPeer(targetPeerId).catch((err) => {
            log.error('Failed to connect to peer:', { peerId: targetPeerId, error: err });
          });
        } catch (err) {
          log.error('handleGuestMessage:CONNECT_TO_PEER error', { error: err });
        }
        break;
      }

      default:
        if (handleGuestBusinessMessage) {
          handleGuestBusinessMessage(type, payload, peerId, { p2p, MSG, getRoom, setRoom, updateLocalState, gameState, setConnectionStatus, log });
        }
    }
  }

  // ── Room State Application ───────────────────────────────────────────────
  function applyRoomStatePayload(payload) {
    if (payload.room) {
      const room = payload.room;
      const roomStateKey = generateOpKey(MSG.ROOM_STATE, { roomCode: room.code, detail: getRoomStateDedupeDetail(room) });
      if (isDuplicateOp(roomStateKey)) {
        log.debug('Duplicate ROOM_STATE ignored', { key: roomStateKey });
        return;
      }

      setRoom(room);
      updateLocalState(getRoom());

      if (payload.error) {
        gameState.error = payload.error;
      }

      if (onRoomStateReceived) onRoomStateReceived(payload);

      if (!gameState.connected) {
        gameState.connected = true;
        if (gameState.connectionStatus === 'reconnecting') {
          setConnectionStatus('connected', '重连成功，状态已恢复');
        } else {
          setConnectionStatus('connected', '已连接');
        }
        if (onGuestConnected) onGuestConnected();
      }
    } else if (payload.delta) {
      const delta = payload.delta;
      const currentRoom = getRoom();
      if (!currentRoom) {
        log.warn('Delta received but no cachedRoom');
        return;
      }
      Object.keys(delta).forEach(key => {
        currentRoom[key] = delta[key];
      });
      updateLocalState(currentRoom);
      if (onRoomStateReceived) onRoomStateReceived(payload);
    }
  }

  // ── Cleanup ──────────────────────────────────────────────────────────────
  function cleanupNetwork() {
    autoReconnect.cleanup();
    hostMigrator.resetMigrationMutex();
    if (resetOps) resetOps();
    offlineManager.clearCleanupTimer();
    if (cleanupExtra) cleanupExtra();
  }

  const RECONNECT_METADATA = {
    get attempt() { return autoReconnect.attempts; },
    MAX_ATTEMPTS: MAX_RECONNECT_ATTEMPTS
  };

  return {
    setupHostHandlers,
    setupGuestHandlers,
    broadcastState,
    resetBroadcastState,
    cleanupNetwork,
    hostMigrator,
    RECONNECT_METADATA,
    getHostPeerId,
    dispatchHostMessage,
    dispatchGuestMessage
  };
}
