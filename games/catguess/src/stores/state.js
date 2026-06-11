// ── Reactive Game State（服务器权威 / WebSocket）────────────────────────────
// catguess 全局 reactive 状态 + 服务器权威房间镜像访问器。
// 权威状态全部来自服务器 STATE 下发；客户端不再本地推进游戏逻辑。

import { reactive } from 'vue';
import { GAME_PHASES } from '../services/gameEngine';

export const gameState = reactive({
  screen: 'menu',
  playerId: null,
  playerName: '',
  isHost: false,
  roomCode: null,
  connected: false,
  connecting: false,
  error: null,
  connectionStatus: 'disconnected',
  connectionMessage: '',
  toast: null,
  diagnostics: {
    mode: 'websocket',
    hasTurnRelay: false,
    peers: {}
  },

  room: {
    players: [],
    phase: GAME_PHASES.WAITING,
    status: GAME_PHASES.WAITING,
    gameState: {
      round: 0,
      storytellerId: null,
      clue: '',
      submittedCards: [],
      shuffledCards: [],
      votes: [],
      roundScores: {},
      scores: {},
      roundHistory: [],
      winner: null,
      secretCardId: null
    },
    disconnectedPlayers: [],
    savedPhase: null,
    savedStorytellerId: null
  }
});

// 服务器下发的权威房间镜像（缓存/恢复用）。
let _cachedRoom = null;
export function getRoom() {
  return _cachedRoom;
}
export function setRoom(room) {
  _cachedRoom = room;
}

export function setConnectionStatus(status, message = '') {
  gameState.connectionStatus = status;
  gameState.connectionMessage = message;
}

export function getDiagnostics() {
  return gameState.diagnostics;
}

// 离开房间 / 清理时把本地状态恢复到默认（保留 error 供展示）。
export function resetLocalStateToDefaults() {
  setRoom(null);
  gameState.connected = false;
  gameState.connecting = false;
  gameState.playerId = null;
  gameState.playerName = '';
  gameState.roomCode = null;
  gameState.isHost = false;
  gameState.room = {
    players: [],
    phase: GAME_PHASES.WAITING,
    status: GAME_PHASES.WAITING,
    gameState: {
      round: 0,
      storytellerId: null,
      clue: '',
      submittedCards: [],
      shuffledCards: [],
      votes: [],
      roundScores: {},
      scores: {},
      roundHistory: [],
      winner: null,
      secretCardId: null
    },
    disconnectedPlayers: [],
    savedPhase: null,
    savedStorytellerId: null
  };
}

// ── Local mirror update（收到服务器 STATE 时调用）────────────────────────────
// 非 SCORING/ENDED 阶段隐藏 secret 标记（与原 P2P 客户端的展示行为一致）。
export function updateLocalState(room) {
  if (!room) return;

  gameState.roomCode = room.code;
  gameState.isHost = room.hostId === gameState.playerId;

  gameState.room = {
    players: (room.players || []).map(p => ({ ...p })),
    phase: room.phase || GAME_PHASES.WAITING,
    status: room.status || GAME_PHASES.WAITING,
    gameState: room.gameState ? {
      round: room.gameState.round || 0,
      storytellerId: room.gameState.storytellerId || null,
      clue: room.gameState.clue || '',
      submittedCards: room.gameState.submittedCards ? [...room.gameState.submittedCards] : [],
      shuffledCards: sanitizeShuffledCardsForClient(room.gameState, room.phase),
      votes: room.gameState.votes ? [...room.gameState.votes] : [],
      roundScores: room.gameState.roundScores ? { ...room.gameState.roundScores } : {},
      scores: room.gameState.scores ? { ...room.gameState.scores } : {},
      roundHistory: room.gameState.roundHistory ? [...room.gameState.roundHistory] : [],
      winner: room.gameState.winner || null,
      secretCardId: room.gameState.secretCardId != null ? room.gameState.secretCardId : null
    } : {
      round: 0,
      storytellerId: null,
      clue: '',
      submittedCards: [],
      shuffledCards: [],
      votes: [],
      roundScores: {},
      scores: {},
      roundHistory: [],
      winner: null,
      secretCardId: null
    },
    hostId: room.hostId || null,
    disconnectedPlayers: room.disconnectedPlayers ? [...room.disconnectedPlayers] : [],
    savedPhase: room.savedPhase || null,
    savedStorytellerId: room.savedStorytellerId || null
  };

  syncScreenToPhase(room);
}

function sanitizeShuffledCardsForClient(gameStateObj, phase) {
  if (!gameStateObj.shuffledCards) return [];

  if (phase === GAME_PHASES.SCORING || phase === GAME_PHASES.ENDED) {
    return [...gameStateObj.shuffledCards];
  }

  return gameStateObj.shuffledCards.map(card => ({
    id: card.id,
    word: card.word,
    submitterId: card.submitterId
  }));
}

function syncScreenToPhase(room) {
  if (room.status === GAME_PHASES.PLAYING && gameState.screen === 'lobby') {
    gameState.screen = 'game';
  }
  if (room.status === GAME_PHASES.ENDED && gameState.screen !== 'result') {
    gameState.screen = 'result';
  }
}
