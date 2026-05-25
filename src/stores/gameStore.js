import { reactive, watch } from 'vue';
import p2p from '../services/p2p';
import {
  GAME_PHASES, GUESS_TYPE,
  generatePlayerId, createInitialRoom,
  addPlayerToRoom, removePlayerFromRoom,
  startGame, submitClues, submitTeamGuess, submitOpponentGuess, submitTeamFinalVote,
  checkNeedTeamVoting, processRound,
  nextRound, resetGame, getCurrentEncryptorInfo,
  resumeGame, canResumeGame, getOnlinePlayerCount, getDisconnectedPlayers
} from '../services/gameEngine';
import { saveStateToCache, loadStateFromCache, clearStateCache, hasCachedState } from '../services/stateCache';

const MSG = {
  ROOM_STATE: 'ROOM_STATE',
  JOIN_REQUEST: 'JOIN_REQUEST',
  JOIN_RESPONSE: 'JOIN_RESPONSE',
  START_GAME: 'START_GAME',
  SUBMIT_CLUES: 'SUBMIT_CLUES',
  SUBMIT_TEAM_GUESS: 'SUBMIT_TEAM_GUESS',
  SUBMIT_OPPONENT_GUESS: 'SUBMIT_OPPONENT_GUESS',
  SUBMIT_TEAM_VOTE: 'SUBMIT_TEAM_VOTE',
  NEXT_ROUND: 'NEXT_ROUND',
  PLAYER_LEFT: 'PLAYER_LEFT',
  PLAYER_RECONNECTED: 'PLAYER_RECONNECTED',
  RESUME_GAME: 'RESUME_GAME'
};

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

  room: {
    players: [],
    teams: {
      white: { players: [], interceptTokens: 0, missTokens: 0, encryptorIndex: 0 },
      black: { players: [], interceptTokens: 0, missTokens: 0, encryptorIndex: 0 }
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
    opponentGuess: null,
    notes: { white: [], black: [] },
    roundResult: null,
    winner: null,
    status: GAME_PHASES.WAITING,
    rotationIndex: 0,
    disconnectedPlayers: [],
    savedPhase: null
  }
});

let cachedRoom = null;

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
  // 只在非菜单页面且已连接时保存
  if (newState.screen !== 'menu' && newState.playerId) {
    saveStateToCache(newState);
  }
}, { deep: true });

function getEncryptorTeamName() {
  return gameState.room.encryptorTeam === 'white' ? '白队' : '黑队';
}

function getInterceptTeamName() {
  return gameState.room.encryptorTeam === 'white' ? '黑队' : '白队';
}

function setConnectionStatus(status, message = '') {
  gameState.connectionStatus = status;
  gameState.connectionMessage = message;
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
    cachedRoom = {
      ...gameState.room,
      code: gameState.roomCode,
      hostId: gameState.isHost ? gameState.playerId : null
    };
  }

  // 更新本地派生状态
  if (cachedRoom) {
    updateLocalState(cachedRoom);
  }

  console.log('[GameStore] State restored from cache');
  return true;
}

// 检查是否有缓存的状态可以恢复
export function hasRestoreableState() {
  return hasCachedState();
}

export async function createRoom(name) {
  try {
    setConnectionStatus('connecting', '正在创建任务...');
    gameState.connecting = true;
    const playerId = generatePlayerId();
    const roomCode = p2p.generateRoomCode();

    gameState.playerId = playerId;
    gameState.playerName = name;
    gameState.roomCode = roomCode;
    gameState.isHost = true;

    cachedRoom = createInitialRoom(playerId, name, roomCode);
    // 设置房主peerId
    const hostPlayer = cachedRoom.players.find(p => p.id === playerId);
    if (hostPlayer) hostPlayer._peerId = `codenames-${roomCode}`;

    await p2p.createHost(roomCode, name);

    setupHostHandlers();

    updateLocalState(cachedRoom);

    gameState.connected = true;
    gameState.connecting = false;
    setConnectionStatus('connected', '任务创建成功');
    gameState.screen = 'lobby';
    return true;
  } catch (error) {
    console.error('Create room error:', error);
    gameState.error = error.message || '创建房间失败';
    gameState.connecting = false;
    setConnectionStatus('error', error.message || '创建房间失败');
    cleanup();
    return false;
  }
}

export async function joinRoom(name, code) {
  try {
    setConnectionStatus('connecting', '正在连接任务...');
    gameState.connecting = true;
    const playerId = generatePlayerId();

    gameState.playerId = playerId;
    gameState.playerName = name;
    gameState.roomCode = code;
    gameState.isHost = false;

    await p2p.joinRoom(code, name);

    setupGuestHandlers();

    p2p.sendTo(p2p.getConnectedPeers()[0], MSG.JOIN_REQUEST, {
      playerId,
      playerName: name,
      originalPeerId: p2p.peer?.id
    });

    gameState.connecting = false;
    setConnectionStatus('connected', '已加入任务');
    return true;
  } catch (error) {
    console.error('Join room error:', error);
    gameState.error = error.message || '加入房间失败';
    gameState.connecting = false;
    setConnectionStatus('error', error.message || '加入房间失败');
    cleanup();
    return false;
  }
}

// 重连功能
export async function reconnectRoom() {
  if (!gameState.roomCode || !gameState.playerName) {
    setConnectionStatus('error', '无法重连：缺少房间信息');
    return false;
  }

  try {
    setConnectionStatus('reconnecting', '正在重新连接...');
    gameState.connecting = true;

    // 清理旧连接
    p2p.disconnect();

    if (gameState.isHost) {
      // 房主重连
      await p2p.createHost(gameState.roomCode, gameState.playerName);
      setupHostHandlers();
    } else {
      // 访客重连
      await p2p.joinRoom(gameState.roomCode, gameState.playerName);
      setupGuestHandlers();

      p2p.sendTo(p2p.getConnectedPeers()[0], MSG.JOIN_REQUEST, {
        playerId: gameState.playerId,
        playerName: gameState.playerName,
        originalPeerId: p2p.peer?.id,
        isReconnect: true
      });
    }

    gameState.connecting = false;
    setConnectionStatus('connected', '重连成功');
    return true;
  } catch (error) {
    console.error('Reconnect error:', error);
    gameState.error = error.message || '重连失败';
    gameState.connecting = false;
    setConnectionStatus('error', error.message || '重连失败');
    return false;
  }
}

function setupHostHandlers() {
  p2p.onPlayerConnected = (conn) => {
    console.log('Player connected:', conn.peer);
    // 发送当前房间状态给新连接的玩家
    if (cachedRoom) {
      setTimeout(() => {
        p2p.sendTo(conn.peer, MSG.ROOM_STATE, { room: cachedRoom });
      }, 500);
    }
  };

  p2p.onPlayerDisconnected = (peerId) => {
    console.log('Player disconnected:', peerId);
    const playerToRemove = cachedRoom?.players.find(p => p._peerId === peerId);
    if (playerToRemove && cachedRoom) {
      removePlayerFromRoom(cachedRoom, playerToRemove.id);
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
}

function setupGuestHandlers() {
  p2p.onPlayerDisconnected = (peerId) => {
    setConnectionStatus('error', '与房主断开连接');
    gameState.error = '与房主断开连接';
    // 不立即清理，允许重连
    gameState.connected = false;
  };

  p2p.onMessage = (data, peerId) => {
    handleGuestMessage(data, peerId);
  };

  p2p.onError = (err) => {
    console.error('Guest error:', err);
    gameState.error = err.message;
    setConnectionStatus('error', err.message);
  };
}

function handleHostMessage(data, peerId) {
  switch (data.type) {
    case MSG.JOIN_REQUEST: {
      const { playerId, playerName, originalPeerId, isReconnect } = data.payload;
      console.log('Join request from:', playerName, isReconnect ? '(reconnect)' : '');
      
      // 检查是否是断线重连
      const existingPlayer = cachedRoom?.players.find(p => p.id === playerId);
      if (existingPlayer && !existingPlayer.isOnline) {
        // 断线重连
        existingPlayer.isOnline = true;
        existingPlayer._peerId = originalPeerId || peerId;
        if (cachedRoom.disconnectedPlayers) {
          cachedRoom.disconnectedPlayers = cachedRoom.disconnectedPlayers.filter(p => p.id !== playerId);
        }
        
        // 检查是否可以恢复游戏
        if (canResumeGame(cachedRoom)) {
          resumeGame(cachedRoom);
        }
        
        broadcastState();
        p2p.sendTo(peerId, MSG.JOIN_RESPONSE, { success: true, reconnected: true });
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
      break;
    }

    case MSG.START_GAME: {
      if (data.payload.playerId !== cachedRoom.hostId) return;
      startGame(cachedRoom);
      broadcastState();
      break;
    }

    case MSG.SUBMIT_CLUES: {
      const result = submitClues(cachedRoom, data.payload.playerId, data.payload.clues);
      if (result.error) {
        p2p.sendTo(peerId, MSG.ROOM_STATE, { room: cachedRoom, error: result.error });
        return;
      }
      broadcastState();
      break;
    }

    case MSG.SUBMIT_TEAM_GUESS: {
      const result = submitTeamGuess(cachedRoom, data.payload.playerId, data.payload.guess);
      if (result.error) {
        p2p.sendTo(peerId, MSG.ROOM_STATE, { room: cachedRoom, error: result.error });
        return;
      }
      // 检查是否需要进入投票阶段
      if (checkNeedTeamVoting(cachedRoom)) {
        cachedRoom.phase = GAME_PHASES.TEAM_VOTING;
      }
      broadcastState();
      break;
    }

    case MSG.SUBMIT_OPPONENT_GUESS: {
      const result = submitOpponentGuess(cachedRoom, data.payload.playerId, data.payload.guess);
      if (result.error) {
        p2p.sendTo(peerId, MSG.ROOM_STATE, { room: cachedRoom, error: result.error });
        return;
      }
      broadcastState();
      break;
    }

    case MSG.SUBMIT_TEAM_VOTE: {
      const result = submitTeamFinalVote(cachedRoom, data.payload.playerId, data.payload.guess);
      if (result.error) {
        p2p.sendTo(peerId, MSG.ROOM_STATE, { room: cachedRoom, error: result.error });
        return;
      }
      broadcastState();
      break;
    }

    case MSG.NEXT_ROUND: {
      if (data.payload.playerId !== cachedRoom.hostId) return;
      if (cachedRoom.status === GAME_PHASES.ENDED) {
        resetGame(cachedRoom);
      } else {
        nextRound(cachedRoom);
      }
      broadcastState();
      break;
    }
  }
}

function handleGuestMessage(data, peerId) {
  switch (data.type) {
    case MSG.ROOM_STATE: {
      if (data.payload.room) {
        cachedRoom = data.payload.room;
        updateLocalState(cachedRoom);
        if (data.payload.error) {
          alert(data.payload.error);
        }
        if (!gameState.connected) {
          gameState.connected = true;
          setConnectionStatus('connected', '已连接');
          gameState.screen = 'lobby';
        }
      }
      break;
    }

    case MSG.JOIN_RESPONSE: {
      if (data.payload.success === false) {
        gameState.error = data.payload.error || '加入房间失败';
        setConnectionStatus('error', data.payload.error || '加入房间失败');
        cleanup();
        gameState.screen = 'menu';
      } else if (data.payload.reconnected) {
        setConnectionStatus('connected', '重连成功');
      }
      break;
    }
  }
}

function broadcastState() {
  if (!cachedRoom) return;
  p2p.broadcast(MSG.ROOM_STATE, { room: cachedRoom });
  updateLocalState(cachedRoom);
}

function updateLocalState(room) {
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
    teams: structuredClone(room.teams) || {
      white: { players: [], interceptTokens: 0, missTokens: 0, encryptorIndex: 0 },
      black: { players: [], interceptTokens: 0, missTokens: 0, encryptorIndex: 0 }
    },
    whiteKeywords: room.whiteKeywords ? [...room.whiteKeywords] : [],
    blackKeywords: room.blackKeywords ? [...room.blackKeywords] : [],
    currentCode: room.currentCode ? [...room.currentCode] : [],
    currentRound: room.currentRound || 0,
    phase: room.phase || GAME_PHASES.WAITING,
    encryptor: room.encryptor,
    encryptorTeam: room.encryptorTeam,
    clues: room.clues ? [...room.clues] : [],
    teamVotes: room.teamVotes ? structuredClone(room.teamVotes) : {
      white: { player1Guess: null, player2Guess: null, finalGuess: null },
      black: { player1Guess: null, player2Guess: null, finalGuess: null }
    },
    opponentGuess: room.opponentGuess ? [...room.opponentGuess] : null,
    notes: structuredClone(room.notes) || { white: [], black: [] },
    roundResult: room.roundResult ? { ...room.roundResult } : null,
    winner: room.winner,
    status: room.status || GAME_PHASES.WAITING,
    rotationIndex: room.rotationIndex || 0,
    disconnectedPlayers: room.disconnectedPlayers || [],
    savedPhase: room.savedPhase || null
  };

  if (gameState.room.teams) {
    gameState.room.teams.white.interceptTokens = room.teams?.white?.interceptionTokens || 0;
    gameState.room.teams.white.missTokens = room.teams?.white?.miscommunicationTokens || 0;
    gameState.room.teams.black.interceptTokens = room.teams?.black?.interceptionTokens || 0;
    gameState.room.teams.black.missTokens = room.teams?.black?.miscommunicationTokens || 0;
  }

  syncScreenToPhase(room);
}

function syncScreenToPhase(room) {
  if (room.status === 'playing' && gameState.screen === 'lobby') {
    gameState.screen = 'game';
  }
  if (room.status === GAME_PHASES.ENDED && gameState.screen !== 'result') {
    gameState.screen = 'result';
  }
}

export function handleStartGame() {
  if (!gameState.isHost) return;
  p2p.broadcast(MSG.START_GAME, { playerId: gameState.playerId });
  startGame(cachedRoom);
  broadcastState();
}

export async function handleSubmitClues(clues) {
  p2p.broadcast(MSG.SUBMIT_CLUES, {
    playerId: gameState.playerId,
    clues: clues
  });
  const result = submitClues(cachedRoom, gameState.playerId, clues);
  if (result.error) {
    alert(result.error);
    return false;
  }
  broadcastState();
  return true;
}

// 提交队友猜测
export async function handleSubmitTeamGuess(guess) {
  p2p.broadcast(MSG.SUBMIT_TEAM_GUESS, {
    playerId: gameState.playerId,
    guess: guess
  });
  const result = submitTeamGuess(cachedRoom, gameState.playerId, guess);
  if (result.error) {
    alert(result.error);
    return false;
  }
  // 检查是否需要进入投票阶段
  if (checkNeedTeamVoting(cachedRoom)) {
    cachedRoom.phase = GAME_PHASES.TEAM_VOTING;
  }
  broadcastState();
  return true;
}

// 提交对方拦截
export async function handleSubmitOpponentGuess(guess) {
  p2p.broadcast(MSG.SUBMIT_OPPONENT_GUESS, {
    playerId: gameState.playerId,
    guess: guess
  });
  const result = submitOpponentGuess(cachedRoom, gameState.playerId, guess);
  if (result.error) {
    alert(result.error);
    return false;
  }
  broadcastState();
  return true;
}

// 提交队内最终投票
export async function handleSubmitTeamVote(guess) {
  p2p.broadcast(MSG.SUBMIT_TEAM_VOTE, {
    playerId: gameState.playerId,
    guess: guess
  });
  const result = submitTeamFinalVote(cachedRoom, gameState.playerId, guess);
  if (result.error) {
    alert(result.error);
    return false;
  }
  broadcastState();
  return true;
}

export function handleNextRound() {
  if (!gameState.isHost) return;
  p2p.broadcast(MSG.NEXT_ROUND, { playerId: gameState.playerId });
  if (cachedRoom.status === GAME_PHASES.ENDED) {
    resetGame(cachedRoom);
  } else {
    nextRound(cachedRoom);
  }
  broadcastState();
}

export function handlePlayAgain() {
  if (!gameState.isHost) return;
  p2p.broadcast(MSG.NEXT_ROUND, { playerId: gameState.playerId });
  resetGame(cachedRoom);
  broadcastState();
}

export async function leaveRoom() {
  cleanup();
  gameState.screen = 'menu';
}

function cleanup() {
  p2p.disconnect();
  cachedRoom = null;
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

  gameState.room = {
    players: [],
    teams: {
      white: { players: [], interceptTokens: 0, missTokens: 0, encryptorIndex: 0 },
      black: { players: [], interceptTokens: 0, missTokens: 0, encryptorIndex: 0 }
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
    opponentGuess: null,
    notes: { white: [], black: [] },
    roundResult: null,
    winner: null,
    status: GAME_PHASES.WAITING,
    rotationIndex: 0,
    disconnectedPlayers: [],
    savedPhase: null
  };

  // 清除缓存
  clearStateCache();
}

export { GAME_PHASES, GUESS_TYPE };
