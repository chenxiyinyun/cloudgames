import { reactive } from 'vue';
import p2p from '../services/p2p';
import {
  GAME_PHASES, GUESS_TYPE,
  generatePlayerId, createInitialRoom,
  addPlayerToRoom, removePlayerFromRoom,
  startGame, submitClues, submitTeamGuess, submitOpponentGuess, submitTeamFinalVote,
  checkNeedTeamVoting, processRound,
  nextRound, resetGame, getCurrentEncryptorInfo
} from '../services/gameEngine';

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
  PLAYER_LEFT: 'PLAYER_LEFT'
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
    rotationIndex: 0
  }
});

let cachedRoom = null;

function getEncryptorTeamName() {
  return gameState.room.encryptorTeam === 'white' ? '白队' : '黑队';
}

function getInterceptTeamName() {
  return gameState.room.encryptorTeam === 'white' ? '黑队' : '白队';
}

export async function createRoom(name) {
  try {
    gameState.connecting = true;
    const playerId = generatePlayerId();
    const roomCode = p2p.generateRoomCode();

    gameState.playerId = playerId;
    gameState.playerName = name;
    gameState.roomCode = roomCode;
    gameState.isHost = true;

    cachedRoom = createInitialRoom(playerId, name, roomCode);

    await p2p.createHost(roomCode, name);

    setupHostHandlers();

    updateLocalState(cachedRoom);

    gameState.connected = true;
    gameState.connecting = false;
    gameState.screen = 'lobby';
    return true;
  } catch (error) {
    console.error('Create room error:', error);
    gameState.error = error.message || '创建房间失败';
    gameState.connecting = false;
    cleanup();
    return false;
  }
}

export async function joinRoom(name, code) {
  try {
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
    return true;
  } catch (error) {
    console.error('Join room error:', error);
    gameState.error = error.message || '加入房间失败';
    gameState.connecting = false;
    cleanup();
    return false;
  }
}

function setupHostHandlers() {
  p2p.onPlayerConnected = (conn) => {
    console.log('Player connected:', conn.peer);
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
  };
}

function setupGuestHandlers() {
  p2p.onPlayerDisconnected = (peerId) => {
    gameState.error = '与房主断开连接';
    cleanup();
    gameState.screen = 'menu';
  };

  p2p.onMessage = (data, peerId) => {
    handleGuestMessage(data, peerId);
  };

  p2p.onError = (err) => {
    console.error('Guest error:', err);
    gameState.error = err.message;
  };
}

function handleHostMessage(data, peerId) {
  switch (data.type) {
    case MSG.JOIN_REQUEST: {
      const { playerId, playerName, originalPeerId } = data.payload;
      console.log('Join request from:', playerName);
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
          gameState.screen = 'lobby';
        }
      }
      break;
    }

    case MSG.JOIN_RESPONSE: {
      if (data.payload.success === false) {
        gameState.error = data.payload.error || '加入房间失败';
        cleanup();
        gameState.screen = 'menu';
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
    rotationIndex: room.rotationIndex || 0
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
    rotationIndex: 0
  };
}

export { GAME_PHASES, GUESS_TYPE };