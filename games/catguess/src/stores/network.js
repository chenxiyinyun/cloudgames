// ── P2P Network Layer ─────────────────────────────────────────────────────────
// 负责 p2p handler 装卸、消息分发、广播、房主迁移、auto-reconnect 注册。
// 与 codenames/src/stores/connection.js + messageHandlers.js 等价。

import {
  GAME_PHASES,
  addPlayerToRoom,
  submitStorySelection, submitCard, submitVote,
  nextRound, restartGame
} from '../services/gameEngine';
import p2p from '../services/p2p';
import { createLogger } from '../services/logger';
import {
  MSG,
  cleanupOps,
  createJoinRequestSenderForGame,
  createRoomBroadcasterForGame,
  generateOpKey,
  getRoomStateDedupeDetail,
  isDuplicateOp
} from '../services/online';
import { createHostMigrationHandler } from '../../../../src/shared/online/useHostMigration';
import { showToast } from '../components/ToastNotification.vue';
import { gameState, getRoom, setRoom, updateLocalState } from './state';
// 循环 import（见 timers.js 同款），仅函数体内引用，ES module live binding 可容忍
import {
  scheduleHostTimerForCurrentPhase,
  scheduleOfflinePlayerCleanup,
  registerAutoReconnectHandlers,
  scheduleDisconnectedSkipCheck,
  setConnectionStatus,
  stopJoinRetry
} from './timers';

const log = createLogger('GameStore');

// ── Adapters ──────────────────────────────────────────────────────────────────

export const sendJoinRequest = createJoinRequestSenderForGame({
  p2p,
  getRoomCode: () => gameState.roomCode,
  logger: log
});

const roomBroadcaster = createRoomBroadcasterForGame({
  p2p,
  getRoom: getRoom,
  updateLocalState
});

// 共享房主迁移处理器
export const hostMigrator = createHostMigrationHandler({
  gameId: 'catguess',
  p2p,
  log
});

export function broadcastState() {
  if (!getRoom()) return;
  cleanupOps();
  roomBroadcaster.broadcastState();
}

// ── Host Handlers ─────────────────────────────────────────────────────────────

export function setupHostHandlers() {
  p2p.onPlayerConnected = (conn) => {
    console.log('Player connected:', conn.peer);
    // DO NOT send ROOM_STATE here — the JOIN_REQUEST handler broadcasts it after processing.
    // Sending ROOM_STATE before JOIN_REQUEST is processed includes stale state (without the new player),
    // and the subsequent broadcastState() ROOM_STATE gets wrongly rejected by idempotency (same round/phase key).
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
    console.log('Player disconnected:', peerId);
    const cachedRoom = getRoom();
    const playerToMark = cachedRoom?.players.find(p => p._peerId === peerId);
    if (playerToMark && cachedRoom) {
      // 标记为离线而非永久移除，允许重连恢复
      playerToMark.isOnline = false;
      if (!cachedRoom.disconnectedPlayers) {
        cachedRoom.disconnectedPlayers = [];
      }
      if (!cachedRoom.disconnectedPlayers.find(p => p.id === playerToMark.id)) {
        cachedRoom.disconnectedPlayers.push({
          id: playerToMark.id,
          name: playerToMark.name,
          disconnectedAt: Date.now()
        });
      }
      scheduleOfflinePlayerCleanup();
      broadcastState();
    }
  };

  p2p.onMessage = (data, peerId) => {
    handleHostMessage(data, peerId);
  };

  p2p.onError = (err) => {
    console.error('Host error:', err);
    gameState.error = err.message;
    setConnectionStatus('error', err.message);
  };

  p2p.startHeartbeat(10000);
  p2p.onDeadPeer = (peerId) => {
    log.warn('Host detected dead peer', { peerId });
    const cachedRoom = getRoom();
    const playerToMark = cachedRoom?.players.find(p => p._peerId === peerId);
    if (playerToMark && cachedRoom) {
      playerToMark.isOnline = false;
      if (!cachedRoom.disconnectedPlayers) {
        cachedRoom.disconnectedPlayers = [];
      }
      if (!cachedRoom.disconnectedPlayers.find(p => p.id === playerToMark.id)) {
        cachedRoom.disconnectedPlayers.push({
          id: playerToMark.id,
          name: playerToMark.name,
          disconnectedAt: Date.now()
        });
      }
      scheduleOfflinePlayerCleanup();
      broadcastState();
    }
  };

  registerAutoReconnectHandlers();
}

// ── Guest Handlers ────────────────────────────────────────────────────────────

export function setupGuestHandlers() {
  p2p.onPlayerDisconnected = (peerId) => {
    console.log('Guest disconnected from peer:', peerId);

    const hostPeerId = `catguess-${gameState.roomCode}`;
    if (peerId === hostPeerId) {
      if (hostMigrator.isMigrationInProgress()) {
        log.info('onPlayerDisconnected: migration already in progress, skipping');
        return;
      }
      console.log('Host disconnected! Attempting migration...');
      _doHostMigrate();
    }
  };

  p2p.onMessage = (data, peerId) => {
    handleGuestMessage(data, peerId);
  };

  p2p.onError = (err) => {
    console.error('Guest error:', err);
    gameState.error = err.message;
    setConnectionStatus('error', err.message);
  };

  p2p.startHeartbeat(10000);
  p2p.onDeadPeer = (peerId) => {
    log.warn('Guest detected dead peer', { peerId });
    const hostPeerId = `catguess-${gameState.roomCode}`;
    if (peerId === hostPeerId) {
      if (hostMigrator.isMigrationInProgress()) {
        log.info('onDeadPeer: migration already in progress, skipping');
        return;
      }
      log.warn('Host is dead, triggering migration');
      _doHostMigrate();
    }
  };

  registerAutoReconnectHandlers();
}

/**
 * 房主迁移 — 委托给共享迁移处理器。
 * 猫猜启用 enableWaitBranch：高 order 的访客等待新房主自动接管。
 */
async function _doHostMigrate() {
  await hostMigrator.handleHostDisconnect(getRoom(), gameState, {
    broadcastState,
    setupHostHandlers,
    setConnectionStatus,
    enableWaitBranch: true,
    onBecomeHost: scheduleHostTimerForCurrentPhase
  });
}

// ── Message Handlers ──────────────────────────────────────────────────────────

export function handleHostMessage(data, peerId) {
  try {
    switch (data.type) {
    case MSG.JOIN_REQUEST: {
      try {
        const { playerId, playerName, originalPeerId, isReconnect } = data.payload;
        console.log('Join request from:', playerName, isReconnect ? '(reconnect)' : '');

        const cachedRoom = getRoom();

        // 1. 先按 playerId 查找已有玩家
        const existingByPlayerId = cachedRoom?.players.find(p => p.id === playerId);

        if (existingByPlayerId && !existingByPlayerId.isOnline) {
          existingByPlayerId.isOnline = true;
          existingByPlayerId._peerId = originalPeerId || peerId;
          if (cachedRoom.disconnectedPlayers) {
            cachedRoom.disconnectedPlayers = cachedRoom.disconnectedPlayers.filter(p => p.id !== playerId);
          }
          broadcastState();
          p2p.sendTo(peerId, MSG.JOIN_RESPONSE, { success: true, reconnected: true, originalPlayerId: playerId });
          return;
        }

        if (existingByPlayerId && existingByPlayerId.isOnline) {
          p2p.sendTo(peerId, MSG.ROOM_STATE, { room: cachedRoom });
          return;
        }

        // 2. playerId 未匹配，按 playerName 查找已有玩家
        const existingByName = cachedRoom?.players.find(
          p => p.name === playerName && !p.isOnline
        );

        if (existingByName) {
          existingByName.isOnline = true;
          existingByName._peerId = originalPeerId || peerId;
          if (cachedRoom.disconnectedPlayers) {
            cachedRoom.disconnectedPlayers = cachedRoom.disconnectedPlayers.filter(p => p.id !== existingByName.id);
          }
          broadcastState();
          p2p.sendTo(peerId, MSG.JOIN_RESPONSE, { success: true, reconnected: true, originalPlayerId: existingByName.id });
          return;
        }

        const existingOnlineByName = cachedRoom?.players.find(
          p => p.name === playerName && p.isOnline
        );
        if (existingOnlineByName) {
          p2p.sendTo(peerId, MSG.JOIN_RESPONSE, { success: false, error: '该名字的玩家已在线' });
          return;
        }

        // 3. 完全没有匹配 → 这是新玩家
        if (cachedRoom && cachedRoom.status !== GAME_PHASES.WAITING && cachedRoom.phase !== GAME_PHASES.WAITING) {
          const errMsg = '游戏已经开始，无法加入房间';
          console.warn('[GameStore] Rejecting join: game already started');
          p2p.sendTo(peerId, MSG.JOIN_RESPONSE, { success: false, error: errMsg });
          return;
        }

        const joinKey = generateOpKey(MSG.JOIN_REQUEST, { playerId, roomCode: cachedRoom?.code, isReconnect });
        if (isDuplicateOp(joinKey)) {
          log.debug('Duplicate JOIN_REQUEST ignored', { key: joinKey });
          p2p.sendTo(peerId, MSG.ROOM_STATE, { room: cachedRoom });
          return;
        }

        const result = addPlayerToRoom(cachedRoom, playerName, playerId);
        if (result.error) {
          p2p.sendTo(peerId, MSG.JOIN_RESPONSE, { success: false, error: result.error });
          return;
        }
        const player = cachedRoom.players.find(p => p.id === playerId);
        if (player) {
          player._peerId = originalPeerId || peerId;
        }
        broadcastState();

        const otherPeers = p2p.getConnectedPeers().filter(id => id !== peerId);
        otherPeers.forEach(otherPeerId => {
          p2p.sendTo(otherPeerId, MSG.CONNECT_TO_PEER, { peerId: originalPeerId || peerId });
        });

        break;
      } catch (err) {
        log.error('handleHostMessage:JOIN_REQUEST error', { type: data?.type, peerId, error: err });
        break;
      }
    }

    case MSG.SUBMIT_STORY: {
      try {
        const submitStoryKey = generateOpKey(MSG.SUBMIT_STORY, {
          playerId: data.payload.playerId,
          roomCode: getRoom()?.code,
          cardIndex: data.payload.cardIndex,
          clue: data.payload.clue
        });
        if (isDuplicateOp(submitStoryKey)) {
          log.debug('Duplicate SUBMIT_STORY ignored', { key: submitStoryKey });
          p2p.sendTo(peerId, MSG.ROOM_STATE, { room: getRoom(), error: '请勿重复提交' });
          return;
        }
        const result = submitStorySelection(getRoom(), data.payload.playerId, data.payload.cardIndex, data.payload.clue);
        if (result.error) {
          p2p.sendTo(peerId, MSG.ROOM_STATE, { room: getRoom(), error: result.error });
          return;
        }
        broadcastState();
        scheduleDisconnectedSkipCheck();
        break;
      } catch (err) {
        log.error('handleHostMessage:SUBMIT_STORY error', { type: data?.type, peerId, error: err });
        break;
      }
    }

    case MSG.SUBMIT_CARD: {
      try {
        const submitCardKey = generateOpKey(MSG.SUBMIT_CARD, {
          playerId: data.payload.playerId,
          roomCode: getRoom()?.code,
          cardIndex: data.payload.cardIndex
        });
        if (isDuplicateOp(submitCardKey)) {
          log.debug('Duplicate SUBMIT_CARD ignored', { key: submitCardKey });
          p2p.sendTo(peerId, MSG.ROOM_STATE, { room: getRoom(), error: '请勿重复提交' });
          return;
        }
        const result = submitCard(getRoom(), data.payload.playerId, data.payload.cardIndex);
        if (result.error) {
          p2p.sendTo(peerId, MSG.ROOM_STATE, { room: getRoom(), error: result.error });
          return;
        }
        broadcastState();
        if (getRoom().phase === GAME_PHASES.REVEALING) {
          scheduleDisconnectedSkipCheck();
        }
        break;
      } catch (err) {
        log.error('handleHostMessage:SUBMIT_CARD error', { type: data?.type, peerId, error: err });
        break;
      }
    }

    case MSG.SUBMIT_VOTE: {
      try {
        const submitVoteKey = generateOpKey(MSG.SUBMIT_VOTE, {
          playerId: data.payload.playerId,
          roomCode: getRoom()?.code,
          votedCardId: data.payload.votedCardId
        });
        if (isDuplicateOp(submitVoteKey)) {
          log.debug('Duplicate SUBMIT_VOTE ignored', { key: submitVoteKey });
          p2p.sendTo(peerId, MSG.ROOM_STATE, { room: getRoom(), error: '请勿重复投票' });
          return;
        }
        const result = submitVote(getRoom(), data.payload.playerId, data.payload.votedCardId);
        if (result.error) {
          p2p.sendTo(peerId, MSG.ROOM_STATE, { room: getRoom(), error: result.error });
          return;
        }
        broadcastState();
        if (getRoom().phase === GAME_PHASES.SCORING) {
          scheduleHostTimerForCurrentPhase();
        }
        break;
      } catch (err) {
        log.error('handleHostMessage:SUBMIT_VOTE error', { type: data?.type, peerId, error: err });
        break;
      }
    }

    case MSG.NEXT_ROUND: {
      try {
        const cachedRoom = getRoom();
        if (data.payload.playerId !== cachedRoom?.hostId) return;
        const nextRoundKey = generateOpKey(MSG.NEXT_ROUND, { playerId: data.payload.playerId, roomCode: cachedRoom?.code });
        if (isDuplicateOp(nextRoundKey)) {
          log.debug('Duplicate NEXT_ROUND ignored', { key: nextRoundKey });
          broadcastState();
          return;
        }
        if (cachedRoom.status === GAME_PHASES.ENDED) {
          restartGame(cachedRoom);
        } else {
          const result = nextRound(cachedRoom);
          if (result.error) {
            log.warn('Host received NEXT_ROUND but nextRound failed', { error: result.error });
            break;
          }
        }
        broadcastState();
        if (cachedRoom.phase === GAME_PHASES.STORYTELLER_PICKING) {
          scheduleHostTimerForCurrentPhase();
        }
        break;
      } catch (err) {
        log.error('handleHostMessage:NEXT_ROUND error', { type: data?.type, peerId, error: err });
        break;
      }
    }

    case MSG.REQUEST_STATE: {
      try {
        const cachedRoom = getRoom();
        if (!cachedRoom) break;
        const requestKey = generateOpKey(MSG.REQUEST_STATE, {
          playerId: data.payload.playerId,
          roomCode: cachedRoom?.code
        });
        if (isDuplicateOp(requestKey)) break;
        p2p.sendTo(peerId, MSG.ROOM_STATE, { room: cachedRoom });
        break;
      } catch (err) {
        log.error('handleHostMessage:REQUEST_STATE error', { type: data?.type, peerId, error: err });
        break;
      }
    }
    }
  } catch (err) {
    log.error('handleHostMessage error', { type: data?.type, peerId, error: err });
  }
}

export function handleGuestMessage(data, peerId) {
  try {
    switch (data.type) {
    case MSG.ROOM_STATE: {
      try {
        if (data.payload.room) {
          const room = data.payload.room;
          const roomStateKey = generateOpKey(MSG.ROOM_STATE, { roomCode: room.code, detail: getRoomStateDedupeDetail(room) });
          if (isDuplicateOp(roomStateKey)) {
            log.debug('Duplicate ROOM_STATE ignored', { key: roomStateKey });
            break;
          }

          setRoom(data.payload.room);
          updateLocalState(getRoom());
          stopJoinRetry();
          if (data.payload.error) {
            showToast(data.payload.error, 'warning');
          }
          if (!gameState.connected) {
            gameState.connected = true;
            if (gameState.connectionStatus === 'reconnecting') {
              setConnectionStatus('connected', '重连成功，状态已恢复');
            } else {
              setConnectionStatus('connected', '已连接');
            }
            gameState.screen = 'lobby';
          }
        } else if (data.payload.delta) {
          const delta = data.payload.delta;
          const cachedRoom = getRoom();
          if (!cachedRoom) {
            log.warn('Delta received but no cachedRoom', { peerId });
            break;
          }

          // The host is authoritative for the entire room, including
          // gameState.shuffledCards. The cards are created once in submitCard()
          // when entering REVEALING and kept in a stable order. We simply apply
          // every delta field as-is — including gameState — and never second-guess
          // the host's shuffledCards.
          Object.keys(delta).forEach(key => {
            cachedRoom[key] = delta[key];
          });

          updateLocalState(cachedRoom);
        }
        break;
      } catch (err) {
        log.error('handleGuestMessage:ROOM_STATE error', { type: data?.type, peerId, error: err });
        break;
      }
    }

    case MSG.JOIN_RESPONSE: {
      try {
        if (data.payload.success === false) {
          const errMsg = data.payload.error || '加入房间失败';
          gameState.error = errMsg;
          setConnectionStatus('error', errMsg);
          showToast(errMsg, 'error');
          stopJoinRetry();
          // 动态 import 避免 network ↔ gameStore 循环（cleanup 在 gameStore.js）
          import('./gameStore').then(({ cleanup }) => cleanup());
          gameState.screen = 'menu';
        } else if (data.payload.reconnected) {
          if (data.payload.originalPlayerId && data.payload.originalPlayerId !== gameState.playerId) {
            console.log('[GameStore] Restoring original playerId:', data.payload.originalPlayerId);
            gameState.playerId = data.payload.originalPlayerId;
          }
          stopJoinRetry();
          gameState.connected = true;
          setConnectionStatus('connected', '重连成功');
        }
        break;
      } catch (err) {
        log.error('handleGuestMessage:JOIN_RESPONSE error', { type: data?.type, peerId, error: err });
        break;
      }
    }

    case MSG.RECONNECTED:
      break;

    case MSG.PEER_LIST: {
      try {
        const { peers } = data.payload;
        console.log('Received peer list:', peers);
        if (peers && peers.length > 0) {
          peers.forEach(async (peerId) => {
            try {
              await p2p.connectToPeer(peerId);
              console.log('Connected to peer:', peerId);
            } catch (err) {
              console.error('Failed to connect to peer:', peerId, err);
            }
          });
        }
        break;
      } catch (err) {
        log.error('handleGuestMessage:PEER_LIST error', { type: data?.type, peerId, error: err });
        break;
      }
    }

    case MSG.HOST_MIGRATION: {
      try {
        const { newHostId, newHostPeerId, room } = data.payload;
        console.log('Host migration to:', newHostId);

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
          console.error('Failed to connect to new host:', err);
        });
        break;
      } catch (err) {
        log.error('handleGuestMessage:HOST_MIGRATION error', { type: data?.type, peerId, error: err });
        break;
      }
    }

    case MSG.CONNECT_TO_PEER: {
      try {
        const { peerId: targetPeerId } = data.payload;
        p2p.connectToPeer(targetPeerId).catch((err) => {
          console.error('Failed to connect to peer:', targetPeerId, err);
        });
        break;
      } catch (err) {
        log.error('handleGuestMessage:CONNECT_TO_PEER error', { type: data?.type, peerId, error: err });
        break;
      }
    }
    }
  } catch (err) {
    log.error('handleGuestMessage error', { type: data?.type, peerId, error: err });
  }
}
