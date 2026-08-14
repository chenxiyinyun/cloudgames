// ── Reactive Game State（服务器权威 / WebSocket）────────────────────────────
// codenames store 接线：state + network + cache 由共享工厂 createGameStore 生成，
// 本文件只声明本游戏的房间镜像、玩家身份派生与屏幕推导。
// 断线暂停/恢复、两段投票、回合结算由服务器权威处理。

import { createGameStore } from '../../../../src/shared/store/createGameStore';
import { showToast } from '../../../../src/shared/components/ToastNotification.vue';
import { GAME_PHASES } from '../services/gameEngine';
import { createLogger } from '../services/logger';

// 服务器权威模型下只需克隆纯数据对象（teams/votes/notes），JSON 克隆足够。
function deepClone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

const store = createGameStore({
  gameId: 'codenames',
  logger: createLogger('Codenames:Network'),
  onError: ({ message }) => {
    if (message) showToast(message, 'warning');
  },
  cacheKey: 'codenames_state_cache',
  stateFields: ['playerId', 'playerName', 'roomCode', 'isHost', 'team', 'screen', 'connectionStatus'],
  roomFields: [
    'players',
    'teams',
    'whiteKeywords',
    'blackKeywords',
    'currentCode',
    'currentRound',
    'phase',
    'encryptor',
    'encryptorTeam',
    'clues',
    'teamVotes',
    'opponentVotes',
    'notes',
    'roundResult',
    'winner',
    'status',
    'rotationIndex',
    'disconnectedPlayers',
    'savedPhase'
  ],
  createEmptyRoom,
  applyRoom,
  syncScreenToPhase,
  // codenames 特有的玩家身份扩展字段
  extraState: {
    team: null,
    isEncryptor: false,
    isTeammate: false,
    isOpponent: false
  },
  resetExtra(state) {
    state.team = null;
    state.isEncryptor = false;
    state.isTeammate = false;
    state.isOpponent = false;
  }
});

export const {
  gameState,
  getRoom,
  setRoom,
  setConnectionStatus,
  updateLocalState,
  resetLocalState,
  RECONNECT_METADATA,
  connectCreate,
  connectJoin,
  reconnectNetwork,
  sendIntent,
  leaveNetwork,
  cleanupNetwork,
  restoreFromCache,
  hasRestoreableState,
  clearCache,
  flushCache
} = store;

// ── 本游戏特有部分 ──────────────────────────────────────────────────────────

// 房间本地状态初始值（gameState.room 与 cleanup 复用，避免重复定义漂移）
function createEmptyRoom() {
  return {
    players: [],
    teams: {
      white: { players: [], interceptionTokens: 0, miscommunicationTokens: 0, encryptorIndex: 0 },
      black: { players: [], interceptionTokens: 0, miscommunicationTokens: 0, encryptorIndex: 0 }
    },
    whiteKeywords: [],
    blackKeywords: [],
    currentCode: [],
    currentRound: 0,
    phase: GAME_PHASES.WAITING,
    encryptor: null,
    encryptorTeam: null,
    clues: [],
    teamVotes: {
      white: { player1Guess: null, player2Guess: null, finalGuess: null },
      black: { player1Guess: null, player2Guess: null, finalGuess: null }
    },
    opponentVotes: {
      player1Guess: null,
      player2Guess: null,
      finalGuess: null
    },
    notes: { white: [], black: [] },
    roundResult: null,
    winner: null,
    status: GAME_PHASES.WAITING,
    rotationIndex: 0,
    disconnectedPlayers: [],
    savedPhase: null
  };
}

function applyRoom(state, room) {
  // 玩家身份派生（队伍 / 加密员 / 队友 / 对手）
  const player = room.players.find(p => p.id === state.playerId);
  state.team = player?.team || null;
  state.isEncryptor = player?.isEncryptor || false;
  state.isTeammate = player?.team === room.encryptorTeam && !state.isEncryptor;
  state.isOpponent = player?.team !== room.encryptorTeam;

  state.room = {
    players: room.players?.map(p => ({ ...p })) || [],
    teams: deepClone(room.teams) || {
      white: { players: [], interceptionTokens: 0, miscommunicationTokens: 0, encryptorIndex: 0 },
      black: { players: [], interceptionTokens: 0, miscommunicationTokens: 0, encryptorIndex: 0 }
    },
    // 只镜像本方关键词，避免泄露对方词表
    whiteKeywords: player?.team === 'white' ? (room.whiteKeywords ? [...room.whiteKeywords] : []) : [],
    blackKeywords: player?.team === 'black' ? (room.blackKeywords ? [...room.blackKeywords] : []) : [],
    currentCode: room.currentCode ? [...room.currentCode] : [],
    currentRound: room.currentRound || 0,
    phase: room.phase || GAME_PHASES.WAITING,
    encryptor: room.encryptor,
    encryptorTeam: room.encryptorTeam,
    clues: room.clues ? [...room.clues] : [],
    teamVotes: room.teamVotes ? deepClone(room.teamVotes) : {
      white: { player1Guess: null, player2Guess: null, finalGuess: null },
      black: { player1Guess: null, player2Guess: null, finalGuess: null }
    },
    opponentVotes: room.opponentVotes ? deepClone(room.opponentVotes) : {
      player1Guess: null,
      player2Guess: null,
      finalGuess: null
    },
    notes: deepClone(room.notes) || { white: [], black: [] },
    roundResult: room.roundResult ? { ...room.roundResult } : null,
    winner: room.winner,
    status: room.status || GAME_PHASES.WAITING,
    rotationIndex: room.rotationIndex || 0,
    disconnectedPlayers: room.disconnectedPlayers || [],
    savedPhase: room.savedPhase || null
  };
}

function syncScreenToPhase(state, room) {
  if (room.status === GAME_PHASES.PLAYING && state.screen === 'lobby') {
    state.screen = 'game';
  }
  if (room.status === GAME_PHASES.ENDED && state.screen !== 'result') {
    state.screen = 'result';
  }
}
