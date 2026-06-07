// ── P2P Network Layer (codenames) ─────────────────────────────────────────────
// 使用共享 createNetworkLayer 工厂，只注册代号猜词特有的业务消息 handler。

import {
  GAME_PHASES,
  addPlayerToRoom,
  removePlayerFromRoom,
  startGame, submitClues, submitTeamGuess, submitOpponentGuess,
  submitOpponentFinalVote, submitTeamFinalVote,
  checkNeedTeamVoting, nextRound, resetGame,
  resumeGame, canResumeGame
} from '../services/gameEngine';
import p2p from '../services/p2p';
import { createLogger } from '../services/logger';
import {
  MSG,
  cleanupOps,
  createJoinRequestSenderForGame,
  createRoomBroadcasterForGame,
  deepClone,
  generateOpKey,
  getRoomStateDedupeDetail,
  isDuplicateOp
} from '../services/online';
import { createDedupeHandler } from '../../../../src/shared/online/dedupeHandler';
import { createNetworkLayer } from '../../../../src/shared/online/createNetworkLayer';
import { showToast } from '../components/ToastNotification.vue';
import { gameState, getRoom, setRoom, updateLocalState, setConnectionStatus } from './roomState';
import { stopJoinRetry } from './timers';

const log = createLogger('GameStore');

// ── Adapters ──────────────────────────────────────────────────────────────────

const sendJoinRequestBase = createJoinRequestSenderForGame({
  p2p,
  getRoomCode: () => gameState.roomCode,
  logger: log
});

const roomBroadcaster = createRoomBroadcasterForGame({
  p2p,
  getRoom: () => getRoom(),
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
  gameId: 'codenames',
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
  deepClone,
  removePlayerFromRoom,
  isLobbyPhase: (room) => room?.status === GAME_PHASES.WAITING || room?.phase === GAME_PHASES.WAITING,

  // codenames 特有：标记离线时保留 team 字段
  markPlayerOfflineExtra: (player, entry) => {
    entry.team = player.team;
  },

  hostMigratorOptions: {
    enableWaitBranch: false
  },

  handleJoinRequest: (payload, peerId) => {
    handleJoinRequest(payload, peerId);
  },

  handleHostBusinessMessage: (type, payload, peerId) => {
    handleHostBusinessMessage(type, payload, peerId);
  },

  onGuestConnected: () => {
    gameState.screen = 'lobby';
  },

  onGuestJoinRejected: () => {
    stopJoinRetry();
    // 默认行为（error/connectionStatus）已由 createNetworkLayer 处理
    // 动态 import 避免 network ↔ connection 循环（cleanup 在 connection.js）
    import('./connection').then(({ cleanup }) => cleanup());
    gameState.screen = 'menu';
  },

  onGuestJoinAccepted: () => {
    stopJoinRetry();
    // 重连场景由 createNetworkLayer 默认行为处理（connected/error/room 设置）
  },

  onRoomStateReceived: (payload) => {
    stopJoinRetry();
    if (payload.error) {
      showToast(payload.error, 'warning');
    }
  },

  cleanupExtra: () => {
    roomBroadcaster.resetBroadcastState();
  }
});

// ── Re-exports from network layer ────────────────────────────────────────────

export const setupHostHandlers = net.setupHostHandlers;
export const setupGuestHandlers = net.setupGuestHandlers;
export const hostMigrator = net.hostMigrator;
export const RECONNECT_METADATA = net.RECONNECT_METADATA;

export function broadcastState(options = {}) {
  return net.broadcastState(options);
}

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

  // Idempotency: skip duplicate join requests
  const joinKey = generateOpKey(MSG.JOIN_REQUEST, { playerId: payload.playerId, roomCode: room?.code, isReconnect: payload.isReconnect });
  if (isDuplicateOp(joinKey)) {
    log.debug('Duplicate JOIN_REQUEST ignored', { key: joinKey });
    p2p.sendTo(peerId, MSG.ROOM_STATE, { room });
    return;
  }

  // 检查是否是断线重连
  const existingPlayer = room?.players.find(p => p.id === payload.playerId);
  if (existingPlayer && !existingPlayer.isOnline) {
    existingPlayer.isOnline = true;
    existingPlayer._peerId = originalPeerId;
    if (room.disconnectedPlayers) {
      room.disconnectedPlayers = room.disconnectedPlayers.filter(p => p.id !== payload.playerId);
    }

    // 检查是否可以恢复游戏
    if (canResumeGame(room)) {
      resumeGame(room);
    }

    broadcastState();
    p2p.sendTo(peerId, MSG.JOIN_RESPONSE, { success: true, reconnected: true });
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

  // 通知其他访客连接到新玩家
  const otherPeers = p2p.getConnectedPeers().filter(id => id !== peerId);
  otherPeers.forEach(otherPeerId => {
    p2p.sendTo(otherPeerId, MSG.CONNECT_TO_PEER, { peerId: originalPeerId });
  });
}

// ── Game-specific: Host Business Message Handler ─────────────────────────────

function handleHostBusinessMessage(type, payload, peerId) {
  const room = getRoom();

  switch (type) {
    case MSG.START_GAME: {
      try {
        if (payload.playerId !== room.hostId) return;
        const startKey = generateOpKey(MSG.START_GAME, { playerId: payload.playerId, roomCode: room?.code });
        if (isDuplicateOp(startKey)) {
          log.debug('Duplicate START_GAME ignored', { key: startKey });
          broadcastState();
          return;
        }
        startGame(room);
        broadcastState();
      } catch (err) {
        log.error('handleHostBusinessMessage:START_GAME error', { type, peerId, error: err });
      }
      break;
    }

    case MSG.SUBMIT_CLUES: {
      try {
        withDedupe(MSG.SUBMIT_CLUES, payload, peerId,
          (room) => submitClues(room, payload.playerId, payload.clues),
          { dupeMessage: '请勿重复提交线索' }
        );
      } catch (err) {
        log.error('handleHostBusinessMessage:SUBMIT_CLUES error', { type, peerId, error: err });
      }
      break;
    }

    case MSG.SUBMIT_TEAM_GUESS: {
      try {
        withDedupe(MSG.SUBMIT_TEAM_GUESS, payload, peerId,
          (room) => {
            const result = submitTeamGuess(room, payload.playerId, payload.guess);
            if (!result.error && checkNeedTeamVoting(room)) {
              room.phase = GAME_PHASES.TEAM_VOTING;
            }
            return result;
          },
          { dupeMessage: '请勿重复提交猜测' }
        );
      } catch (err) {
        log.error('handleHostBusinessMessage:SUBMIT_TEAM_GUESS error', { type, peerId, error: err });
      }
      break;
    }

    case MSG.SUBMIT_OPPONENT_GUESS: {
      try {
        withDedupe(MSG.SUBMIT_OPPONENT_GUESS, payload, peerId,
          (room) => {
            const result = submitOpponentGuess(room, payload.playerId, payload.guess);
            if (!result.error && checkNeedTeamVoting(room)) {
              room.phase = GAME_PHASES.TEAM_VOTING;
            }
            return result;
          },
          { dupeMessage: '请勿重复提交拦截' }
        );
      } catch (err) {
        log.error('handleHostBusinessMessage:SUBMIT_OPPONENT_GUESS error', { type, peerId, error: err });
      }
      break;
    }

    case MSG.SUBMIT_OPPONENT_VOTE: {
      try {
        withDedupe(MSG.SUBMIT_OPPONENT_VOTE, payload, peerId,
          (room) => submitOpponentFinalVote(room, payload.playerId, payload.guess),
          { dupeMessage: '请勿重复提交投票' }
        );
      } catch (err) {
        log.error('handleHostBusinessMessage:SUBMIT_OPPONENT_VOTE error', { type, peerId, error: err });
      }
      break;
    }

    case MSG.SUBMIT_TEAM_VOTE: {
      try {
        withDedupe(MSG.SUBMIT_TEAM_VOTE, payload, peerId,
          (room) => submitTeamFinalVote(room, payload.playerId, payload.guess),
          { dupeMessage: '请勿重复提交投票' }
        );
      } catch (err) {
        log.error('handleHostBusinessMessage:SUBMIT_TEAM_VOTE error', { type, peerId, error: err });
      }
      break;
    }

    case MSG.NEXT_ROUND: {
      try {
        if (payload.playerId !== room?.hostId) break;
        const nextRoundKey = generateOpKey(MSG.NEXT_ROUND, { playerId: payload.playerId, roomCode: room?.code });
        if (isDuplicateOp(nextRoundKey)) {
          log.debug('Duplicate NEXT_ROUND ignored', { key: nextRoundKey });
          broadcastState();
          return;
        }
        if (room.status === GAME_PHASES.ENDED) {
          resetGame(room);
        } else {
          nextRound(room);
        }
        broadcastState();
      } catch (err) {
        log.error('handleHostBusinessMessage:NEXT_ROUND error', { type, peerId, error: err });
      }
      break;
    }
  }
}
