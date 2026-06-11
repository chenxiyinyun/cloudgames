import { reactive, watch } from 'vue';
import { GAME_PHASES } from '../services/gameEngine';
import {
  saveStateToCache, loadStateFromCache, clearStateCache,
  hasCachedState, flushStateCache, cancelPendingSave
} from '../services/stateCache';

// 服务器权威模型下只需克隆纯数据对象（teams/votes/notes），JSON 克隆足够。
function deepClone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

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

export const gameState = reactive({
  screen: 'menu',
  playerId: null,
  playerName: '',
  team: null,
  isHost: false,
  isEncryptor: false,
  isTeammate: false,
  isOpponent: false,
  roomCode: null,
  connected: false,
  connecting: false,
  error: null,
  connectionStatus: 'disconnected', // disconnected, connecting, connected, error, reconnecting
  connectionMessage: '',
  room: createEmptyRoom()
});

// 房主权威房间状态。会被整体重新赋值（创建/恢复/收到全量 ROOM_STATE/迁移），
// 因此对外只暴露 getRoom()/setRoom() 访问器，禁止直接值导入。
let cachedRoom = null;
export function getRoom() {
  return cachedRoom;
}
export function setRoom(room) {
  cachedRoom = room;
}

export function setConnectionStatus(status, message = '') {
  gameState.connectionStatus = status;
  gameState.connectionMessage = message;
}

// 监听状态变化，自动保存到缓存
watch(() => ({
  screen: gameState.screen,
  playerId: gameState.playerId,
  playerName: gameState.playerName,
  roomCode: gameState.roomCode,
  isHost: gameState.isHost,
  team: gameState.team,
  connectionStatus: gameState.connectionStatus,
  room: gameState.room
}), (newState) => {
  // 回到菜单：取消任何待保存的定时器，不缓存菜单状态
  if (newState.screen === 'menu') {
    cancelPendingSave();
    return;
  }
  // 只在非菜单页面且已连接时保存
  if (newState.playerId) {
    saveStateToCache(newState);
  }
}, { deep: true });

// Flush cached state on tab close
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    flushStateCache(gameState);
  });
}

// 从缓存恢复状态
export function restoreFromCache() {
  const cache = loadStateFromCache();
  if (!cache) return false;

  console.log('[GameStore] Restoring state from cache...');

  // 恢复核心状态
  if (cache.state) {
    gameState.playerId = cache.state.playerId || null;
    gameState.playerName = cache.state.playerName || '';
    gameState.roomCode = cache.state.roomCode || null;
    gameState.isHost = cache.state.isHost || false;
    gameState.team = cache.state.team || null;
    gameState.screen = cache.state.screen || 'menu';
    gameState.connectionStatus = cache.state.connectionStatus || 'disconnected';
  }

  // 恢复房间状态
  if (cache.room) {
    Object.assign(gameState.room, cache.room);
  }

  // 重建 cachedRoom
  if (gameState.roomCode && gameState.playerId) {
    setRoom({
      ...gameState.room,
      code: gameState.roomCode,
      hostId: gameState.isHost ? gameState.playerId : null
    });
  }

  // 更新本地派生状态
  if (getRoom()) {
    updateLocalState(getRoom());
  }

  console.log('[GameStore] State restored from cache');
  return true;
}

// 检查是否有缓存的状态可以恢复
export function hasRestoreableState() {
  return hasCachedState();
}

export function updateLocalState(room) {
  if (!room) return;

  gameState.roomCode = room.code;
  gameState.isHost = room.hostId === gameState.playerId;

  const player = room.players.find(p => p.id === gameState.playerId);
  gameState.team = player?.team || null;
  gameState.isEncryptor = player?.isEncryptor || false;
  gameState.isTeammate = player?.team === room.encryptorTeam && !gameState.isEncryptor;
  gameState.isOpponent = player?.team !== room.encryptorTeam;

  gameState.room = {
    players: room.players?.map(p => ({ ...p })) || [],
    teams: deepClone(room.teams) || {
      white: { players: [], interceptionTokens: 0, miscommunicationTokens: 0, encryptorIndex: 0 },
      black: { players: [], interceptionTokens: 0, miscommunicationTokens: 0, encryptorIndex: 0 }
    },
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

  syncScreenToPhase(room);
}

export function syncScreenToPhase(room) {
  if (room.status === GAME_PHASES.PLAYING && gameState.screen === 'lobby') {
    gameState.screen = 'game';
  }
  if (room.status === GAME_PHASES.ENDED && gameState.screen !== 'result') {
    gameState.screen = 'result';
  }
}

// 重置纯本地状态（cleanup 的状态部分；P2P/定时器/缓存的清理由 connection.cleanup 负责）
export function resetGameState() {
  setRoom(null);
  gameState.connected = false;
  gameState.connecting = false;
  gameState.error = null;
  gameState.playerId = null;
  gameState.playerName = '';
  gameState.roomCode = null;
  gameState.isHost = false;
  gameState.team = null;
  gameState.isEncryptor = false;
  gameState.isTeammate = false;
  gameState.isOpponent = false;
  setConnectionStatus('disconnected', '');
  gameState.room = createEmptyRoom();
}

// 清除缓存（供 cleanup 调用，集中缓存依赖在状态模块）
export function clearCache() {
  clearStateCache();
}

// flush 待保存缓存（供 cleanup 调用）
export function flushCache() {
  flushStateCache(gameState);
}
