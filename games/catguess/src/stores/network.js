// ── P2P Network Layer (catguess) ──────────────────────────────────────────────
// 使用共享 createNetworkLayer 工厂，只注册猫猜特有的业务消息 handler。

import {
  GAME_PHASES,
  addPlayerToRoom,
  removePlayerFromRoom,
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
import { createDedupeHandler } from '../../../../src/shared/online/dedupeHandler';
import { createNetworkLayer } from '../../../../src/shared/online/createNetworkLayer';
import { showToast } from '../components/ToastNotification.vue';
import { gameState, getRoom, setRoom, updateLocalState } from './state';
import {
  scheduleHostTimerForCurrentPhase,
  scheduleOfflineTick,
  setConnectionStatus,
  stopJoinRetry,
  resetAllTimers,
  setBroadcastStateFn
} from './timers';

const log = createLogger('GameStore');

// ── Adapters ──────────────────────────────────────────────────────────────────

const sendJoinRequestBase = createJoinRequestSenderForGame({
  p2p,
  getRoomCode: () => gameState.roomCode,
  logger: log
});

const roomBroadcaster = createRoomBroadcasterForGame({
  p2p,
  getRoom,
  updateLocalState
});

const withDedupe = createDedupeHandler({
  generateOpKey,
  isDuplicateOp,
  p2p,
  broadcastState: () => { broadcastState(); },
  log,
  getRoom,
  getRoomCode: () => getRoom()?.code,
  roomStateType: MSG.ROOM_STATE
});

// ── Create Network Layer (shared) ────────────────────────────────────────────

const net = createNetworkLayer({
  gameId: 'catguess',
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
  resetOps: null,
  getRoomStateDedupeDetail,
  MSG,
  deepClone: null,
  removePlayerFromRoom,
  isLobbyPhase: (room) => room?.status === GAME_PHASES.WAITING || room?.phase === GAME_PHASES.WAITING,

  hostMigratorOptions: {
    enableWaitBranch: true,
    onBecomeHost: scheduleHostTimerForCurrentPhase,
    iceCheckingTimeoutMs: 10000,
    onAfterReconnectJoin: () => {
      try { p2p.broadcast(MSG.REQUEST_STATE, { playerId: gameState.playerId }); } catch { /* ignore */ }
    }
  },

  handleJoinRequest: (payload, peerId, ctx) => {
    handleJoinRequest(payload, peerId);
  },

  handleHostBusinessMessage: (type, payload, peerId, ctx) => {
    handleHostBusinessMessage(type, payload, peerId);
  },

  onGuestConnected: () => {
    gameState.screen = 'lobby';
  },

  onGuestJoinRejected: (errMsg) => {
    showToast(errMsg, 'error');
    stopJoinRetry();
    // 动态 import 避免 network ↔ gameStore 循环（cleanup 在 gameStore.js）
    import('./gameStore').then(({ cleanup }) => cleanup());
    gameState.screen = 'menu';
  },

  onGuestJoinAccepted: (payload) => {
    // 重连场景：恢复原始 playerId
    if (payload.reconnected && payload.originalPlayerId && payload.originalPlayerId !== gameState.playerId) {
      log.info('Restoring original playerId:', { originalPlayerId: payload.originalPlayerId });
      gameState.playerId = payload.originalPlayerId;
    }
    stopJoinRetry();
  },

  onRoomStateReceived: (payload) => {
    stopJoinRetry();
    if (payload.error) {
      showToast(payload.error, 'warning');
    }
  },

  onHostPlayerOffline: () => {
    scheduleOfflineTick();
  },

  cleanupExtra: () => {
    roomBroadcaster.resetBroadcastState();
    resetAllTimers();
  }
});

// ── Re-exports from network layer ────────────────────────────────────────────

export const setupHostHandlers = net.setupHostHandlers;
export const setupGuestHandlers = net.setupGuestHandlers;
export const hostMigrator = net.hostMigrator;
export const RECONNECT_METADATA = net.RECONNECT_METADATA;

// 消息分发 — 委托给共享层
export const handleHostMessage = net.dispatchHostMessage;
export const handleGuestMessage = net.dispatchGuestMessage;

export function broadcastState(options = {}) {
  return net.broadcastState(options);
}

// 注入 broadcastState 到 timers.js，消除循环依赖
setBroadcastStateFn(broadcastState);

export function resetBroadcastState() {
  net.resetBroadcastState();
}

export function cleanupNetwork() {
  net.cleanupNetwork();
}

export function sendJoinRequest(playerId, playerName, isReconnect = false) {
  return sendJoinRequestBase(playerId, playerName, isReconnect);
}

// ── Game-specific: Join Request Handler ──────────────────────────────────────

function handleJoinRequest(payload, peerId) {
  const room = getRoom();
  const originalPeerId = payload.originalPeerId || peerId;

  // 1. 先按 playerId 查找已有玩家
  const existingByPlayerId = room?.players.find(p => p.id === payload.playerId);

  if (existingByPlayerId && !existingByPlayerId.isOnline) {
    existingByPlayerId.isOnline = true;
    existingByPlayerId._peerId = originalPeerId;
    if (room.disconnectedPlayers) {
      room.disconnectedPlayers = room.disconnectedPlayers.filter(p => p.id !== payload.playerId);
    }
    broadcastState();
    p2p.sendTo(peerId, MSG.JOIN_RESPONSE, { success: true, reconnected: true, originalPlayerId: payload.playerId });
    return;
  }

  if (existingByPlayerId && existingByPlayerId.isOnline) {
    p2p.sendTo(peerId, MSG.ROOM_STATE, { room });
    return;
  }

  // 2. playerId 未匹配，按 playerName 查找已有离线玩家
  const existingByName = room?.players.find(
    p => p.name === payload.playerName && !p.isOnline
  );

  if (existingByName) {
    existingByName.isOnline = true;
    existingByName._peerId = originalPeerId;
    if (room.disconnectedPlayers) {
      room.disconnectedPlayers = room.disconnectedPlayers.filter(p => p.id !== existingByName.id);
    }
    broadcastState();
    p2p.sendTo(peerId, MSG.JOIN_RESPONSE, { success: true, reconnected: true, originalPlayerId: existingByName.id });
    return;
  }

  const existingOnlineByName = room?.players.find(
    p => p.name === payload.playerName && p.isOnline
  );
  if (existingOnlineByName) {
    p2p.sendTo(peerId, MSG.JOIN_RESPONSE, { success: false, error: '该名字的玩家已在线' });
    return;
  }

  // 3. 完全没有匹配 → 新玩家
  if (room && room.status !== GAME_PHASES.WAITING && room.phase !== GAME_PHASES.WAITING) {
    const errMsg = '游戏已经开始，无法加入房间';
    log.warn('Rejecting join: game already started');
    p2p.sendTo(peerId, MSG.JOIN_RESPONSE, { success: false, error: errMsg });
    return;
  }

  const joinKey = generateOpKey(MSG.JOIN_REQUEST, { playerId: payload.playerId, roomCode: room?.code, isReconnect: payload.isReconnect });
  if (isDuplicateOp(joinKey)) {
    log.debug('Duplicate JOIN_REQUEST ignored', { key: joinKey });
    p2p.sendTo(peerId, MSG.ROOM_STATE, { room });
    return;
  }

  const result = addPlayerToRoom(room, payload.playerName, payload.playerId);
  if (result.error) {
    p2p.sendTo(peerId, MSG.JOIN_RESPONSE, { success: false, error: result.error });
    return;
  }
  const player = room.players.find(p => p.id === payload.playerId);
  if (player) {
    player._peerId = originalPeerId;
  }
  broadcastState();

  const otherPeers = p2p.getConnectedPeers().filter(id => id !== peerId);
  otherPeers.forEach(otherPeerId => {
    p2p.sendTo(otherPeerId, MSG.CONNECT_TO_PEER, { peerId: originalPeerId });
  });
}

// ── Game-specific: Host Business Message Handler ─────────────────────────────

function handleHostBusinessMessage(type, payload, peerId) {
  switch (type) {
    case MSG.SUBMIT_STORY: {
      try {
        withDedupe(MSG.SUBMIT_STORY, payload, peerId,
          (room) => submitStorySelection(room, payload.playerId, payload.cardIndex, payload.clue),
          { dupeMessage: '请勿重复提交', afterBroadcast: () => scheduleOfflineTick() }
        );
      } catch (err) {
        log.error('handleHostBusinessMessage:SUBMIT_STORY error', { type, peerId, error: err });
      }
      break;
    }

    case MSG.SUBMIT_CARD: {
      try {
        withDedupe(MSG.SUBMIT_CARD, payload, peerId,
          (room) => submitCard(room, payload.playerId, payload.cardIndex),
          {
            dupeMessage: '请勿重复提交',
            afterBroadcast: (room) => {
              if (room?.phase === GAME_PHASES.REVEALING) scheduleOfflineTick();
            }
          }
        );
      } catch (err) {
        log.error('handleHostBusinessMessage:SUBMIT_CARD error', { type, peerId, error: err });
      }
      break;
    }

    case MSG.SUBMIT_VOTE: {
      try {
        withDedupe(MSG.SUBMIT_VOTE, payload, peerId,
          (room) => submitVote(room, payload.playerId, payload.votedCardId),
          {
            dupeMessage: '请勿重复投票',
            afterBroadcast: (room) => {
              if (room?.phase === GAME_PHASES.SCORING) scheduleHostTimerForCurrentPhase();
            }
          }
        );
      } catch (err) {
        log.error('handleHostBusinessMessage:SUBMIT_VOTE error', { type, peerId, error: err });
      }
      break;
    }

    case MSG.NEXT_ROUND: {
      try {
        const cachedRoom = getRoom();
        if (payload.playerId !== cachedRoom?.hostId) break;
        withDedupe(MSG.NEXT_ROUND, payload, peerId,
          (room) => {
            if (room.status === GAME_PHASES.ENDED) {
              restartGame(room);
              return {};
            }
            return nextRound(room);
          },
          {
            afterBroadcast: (room) => {
              if (room?.phase === GAME_PHASES.STORYTELLER_PICKING) scheduleHostTimerForCurrentPhase();
            }
          }
        );
      } catch (err) {
        log.error('handleHostBusinessMessage:NEXT_ROUND error', { type, peerId, error: err });
      }
      break;
    }
  }
}
