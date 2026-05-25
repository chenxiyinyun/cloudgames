import { getAllKeywords, splitKeywords } from '../data/keywords';

export const GAME_PHASES = {
  WAITING: 'waiting',
  ASSIGNING_TEAMS: 'assigning_teams',
  ENCRYPTING: 'encrypting',
  TEAM_VOTING: 'team_voting',
  GUESSING: 'guessing',
  RESULT: 'result',
  ENDED: 'ended'
};

export const GUESS_TYPE = {
  TEAMMATE: 'teammate',
  OPPONENT: 'opponent'
};

// 轮换顺序：黑A -> 白A -> 黑B -> 白B -> 循环
const ROTATION_SEQUENCE = [
  { team: 'black', index: 0 },
  { team: 'white', index: 0 },
  { team: 'black', index: 1 },
  { team: 'white', index: 1 }
];

export function generatePlayerId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function createInitialRoom(hostPlayerId, hostName, roomCode) {
  return {
    id: roomCode,
    code: roomCode,
    hostId: hostPlayerId,
    status: GAME_PHASES.WAITING,
    players: [{
      id: hostPlayerId,
      name: hostName,
      team: null,
      isHost: true,
      isEncryptor: false,
      order: 0
    }],
    teams: {
      white: { players: [], encryptorIndex: 0, interceptionTokens: 0, miscommunicationTokens: 0 },
      black: { players: [], encryptorIndex: 0, interceptionTokens: 0, miscommunicationTokens: 0 }
    },
    whiteKeywords: [],
    blackKeywords: [],
    currentCode: [],
    currentRound: 0,
    phase: GAME_PHASES.WAITING,
    encryptor: null,
    encryptorTeam: null,
    clues: [],
    // 队内投票系统
    teamVotes: {
      white: { player1Guess: null, player2Guess: null, finalGuess: null },
      black: { player1Guess: null, player2Guess: null, finalGuess: null }
    },
    opponentGuess: null,
    usedClues: [],
    notes: { white: [], black: [] },
    roundHistory: [],
    winner: null,
    // 轮换索引
    rotationIndex: 0,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
}

export function addPlayerToRoom(room, playerName, playerId) {
  if (room.players.length >= 4) {
    return { error: '房间已满' };
  }

  if (room.players.find(p => p.id === playerId)) {
    return { error: '玩家已在房间中' };
  }

  const player = {
    id: playerId,
    name: playerName,
    team: null,
    isHost: false,
    isEncryptor: false,
    order: room.players.length
  };

  room.players.push(player);
  room.updatedAt = Date.now();
  return { room };
}

export function removePlayerFromRoom(room, playerId) {
  room.players = room.players.filter(p => p.id !== playerId);

  if (room.players.length > 0) {
    const oldHost = room.players.find(p => p.id === room.hostId);
    if (!oldHost) {
      room.hostId = room.players[0].id;
      room.players[0].isHost = true;
    }

    reconstructTeams(room);

    if (room.status === GAME_PHASES.WAITING || room.status === GAME_PHASES.ASSIGNING_TEAMS) {
      if (room.players.length < 4) {
        room.status = GAME_PHASES.WAITING;
        room.phase = GAME_PHASES.WAITING;
        room.players.forEach(p => {
          p.team = null;
          p.isEncryptor = false;
        });
        room.teams = {
          white: { players: [], encryptorIndex: 0, interceptionTokens: 0, miscommunicationTokens: 0 },
          black: { players: [], encryptorIndex: 0, interceptionTokens: 0, miscommunicationTokens: 0 }
        };
      }
    }
  }

  room.updatedAt = Date.now();
  return room;
}

function reconstructTeams(room) {
  if (!room.teams) {
    room.teams = {
      white: { players: [], encryptorIndex: 0, interceptionTokens: 0, miscommunicationTokens: 0 },
      black: { players: [], encryptorIndex: 0, interceptionTokens: 0, miscommunicationTokens: 0 }
    };
  }

  const assignedPlayers = room.players.filter(p => p.team !== null);
  room.teams.white.players = assignedPlayers.filter(p => p.team === 'white').map(p => p.id);
  room.teams.black.players = assignedPlayers.filter(p => p.team === 'black').map(p => p.id);
}

export function assignTeams(room) {
  const shuffled = [...room.players].sort(() => Math.random() - 0.5);

  room.players.forEach((player, index) => {
    player.team = index < 2 ? 'white' : 'black';
    player.isEncryptor = false; // 初始时不设置情报官，游戏开始后再设置
    player.order = index;
  });

  reconstructTeams(room);

  room.status = GAME_PHASES.ASSIGNING_TEAMS;
  room.phase = GAME_PHASES.ASSIGNING_TEAMS;
  room.updatedAt = Date.now();
  return room;
}

export function startGame(room) {
  if (room.status === GAME_PHASES.WAITING) {
    assignTeams(room);
  }

  const allKeywords = getAllKeywords();
  const selectedKeywords = allKeywords.sort(() => Math.random() - 0.5).slice(0, 8);
  const keywordSets = splitKeywords(selectedKeywords, 4, 4);

  room.whiteKeywords = keywordSets.white;
  room.blackKeywords = keywordSets.black;
  room.currentCode = generateCode();
  room.status = 'playing';
  room.currentRound = 1;
  room.phase = GAME_PHASES.ENCRYPTING;
  
  // 设置第一个情报官：黑队A (rotationIndex = 0)
  room.rotationIndex = 0;
  const firstRotation = ROTATION_SEQUENCE[0];
  room.encryptorTeam = firstRotation.team;
  room.encryptor = room.teams[firstRotation.team].players[firstRotation.index];
  
  // 更新玩家角色
  updateEncryptorRole(room);
  
  room.clues = [];
  room.teamVotes = {
    white: { player1Guess: null, player2Guess: null, finalGuess: null },
    black: { player1Guess: null, player2Guess: null, finalGuess: null }
  };
  room.opponentGuess = null;
  room.usedClues = [];
  room.notes = { white: [], black: [] };
  room.roundHistory = [];
  room.winner = null;
  room.teams.white.encryptorIndex = 0;
  room.teams.black.encryptorIndex = 0;
  room.teams.white.interceptionTokens = 0;
  room.teams.black.interceptionTokens = 0;
  room.teams.white.miscommunicationTokens = 0;
  room.teams.black.miscommunicationTokens = 0;
  room.updatedAt = Date.now();

  return room;
}

function updateEncryptorRole(room) {
  room.players.forEach(p => {
    p.isEncryptor = (p.id === room.encryptor);
  });
}

export function generateCode() {
  return [
    Math.floor(Math.random() * 4) + 1,
    Math.floor(Math.random() * 4) + 1,
    Math.floor(Math.random() * 4) + 1
  ];
}

export function submitClues(room, playerId, clues) {
  if (room.encryptor !== playerId) {
    return { error: '只有当前回合的情报官可以提交线索' };
  }

  if (!Array.isArray(clues) || clues.length !== 3) {
    return { error: '需要提交3个线索' };
  }

  const validClues = clues.map(c => c.trim()).filter(c => c.length > 0);
  if (validClues.length !== 3) {
    return { error: '所有线索都必须是非空字符串' };
  }

  const allKeywords = [...room.whiteKeywords, ...room.blackKeywords];

  for (const clue of validClues) {
    if (allKeywords.some(k => k.includes(clue) || clue.includes(k))) {
      return { error: `线索"${clue}"包含或被关键词包含，请更换` };
    }

    if (room.usedClues.includes(clue.toLowerCase())) {
      return { error: `线索"${clue}"已被使用过，请更换` };
    }
  }

  room.clues = validClues;
  room.usedClues.push(...validClues.map(c => c.toLowerCase()));
  
  // 进入猜测阶段 - 两队同时提交猜测
  room.phase = GAME_PHASES.GUESSING;
  room.updatedAt = Date.now();

  return { room };
}

// 提交队内猜测（队友两人各自提交）
export function submitTeamGuess(room, playerId, guess) {
  if (room.phase !== GAME_PHASES.GUESSING) {
    return { error: '当前不是猜测阶段' };
  }

  if (!Array.isArray(guess) || guess.length !== 3) {
    return { error: '需要提交3个数字' };
  }

  if (guess.some(g => !Number.isInteger(g) || g < 1 || g > 4)) {
    return { error: '每个数字必须在1-4之间' };
  }

  const player = room.players.find(p => p.id === playerId);
  if (!player) return { error: '玩家不存在' };

  // 情报官不能提交猜测
  if (player.isEncryptor) {
    return { error: '情报官不能提交猜测' };
  }

  const team = player.team;
  const teamPlayers = room.teams[team].players;
  const playerIndex = teamPlayers.indexOf(playerId);
  
  if (playerIndex === -1) {
    return { error: '玩家不在队伍中' };
  }

  // 检查是否已提交过
  const voteKey = playerIndex === 0 ? 'player1Guess' : 'player2Guess';
  if (room.teamVotes[team][voteKey] !== null) {
    return { error: '你已经提交过猜测了' };
  }

  room.teamVotes[team][voteKey] = guess;
  room.updatedAt = Date.now();

  // 检查该队是否两人都提交了
  const teamVote = room.teamVotes[team];
  if (teamVote.player1Guess !== null && teamVote.player2Guess !== null) {
    // 判断两人是否一致
    const guess1 = teamVote.player1Guess;
    const guess2 = teamVote.player2Guess;
    const isSame = guess1.every((g, i) => g === guess2[i]);
    
    if (isSame) {
      teamVote.finalGuess = guess1;
    }
    // 如果不一致，进入投票阶段，等待统一决定
  }

  // 检查是否可以处理回合
  if (canProcessRound(room)) {
    return processRound(room);
  }

  return { room };
}

// 提交队内统一投票（当两人不一致时使用）
export function submitTeamFinalVote(room, playerId, guess) {
  if (room.phase !== GAME_PHASES.TEAM_VOTING && room.phase !== GAME_PHASES.GUESSING) {
    return { error: '当前不是投票阶段' };
  }

  if (!Array.isArray(guess) || guess.length !== 3) {
    return { error: '需要提交3个数字' };
  }

  if (guess.some(g => !Number.isInteger(g) || g < 1 || g > 4)) {
    return { error: '每个数字必须在1-4之间' };
  }

  const player = room.players.find(p => p.id === playerId);
  if (!player) return { error: '玩家不存在' };

  const team = player.team;
  
  // 只有该队成员可以投票
  if (player.team !== team) {
    return { error: '只能为自己队伍投票' };
  }

  // 如果已经有一致猜测，不需要投票
  if (room.teamVotes[team].finalGuess !== null) {
    return { error: '队伍已经达成一致' };
  }

  room.teamVotes[team].finalGuess = guess;
  room.updatedAt = Date.now();

  // 检查是否可以处理回合
  if (canProcessRound(room)) {
    return processRound(room);
  }

  return { room };
}

// 提交对方拦截猜测
export function submitOpponentGuess(room, playerId, guess) {
  if (room.phase !== GAME_PHASES.GUESSING && room.phase !== GAME_PHASES.TEAM_VOTING) {
    return { error: '当前不是猜测阶段' };
  }

  if (!Array.isArray(guess) || guess.length !== 3) {
    return { error: '需要提交3个数字' };
  }

  if (guess.some(g => !Number.isInteger(g) || g < 1 || g > 4)) {
    return { error: '每个数字必须在1-4之间' };
  }

  const player = room.players.find(p => p.id === playerId);
  if (!player) return { error: '玩家不存在' };

  // 只有对方队伍可以拦截
  if (player.team === room.encryptorTeam) {
    return { error: '只有对方队可以拦截' };
  }

  // 检查是否已提交过
  if (room.opponentGuess !== null) {
    return { error: '拦截猜测已提交' };
  }

  room.opponentGuess = guess;
  room.updatedAt = Date.now();

  // 检查是否可以处理回合
  if (canProcessRound(room)) {
    return processRound(room);
  }

  return { room };
}

// 检查是否可以处理回合
function canProcessRound(room) {
  const encryptorTeam = room.encryptorTeam;
  const interceptTeam = encryptorTeam === 'white' ? 'black' : 'white';
  
  // 加密方队友必须达成一致
  const encryptorTeamHasFinal = room.teamVotes[encryptorTeam].finalGuess !== null;
  // 对方必须提交拦截
  const opponentHasGuess = room.opponentGuess !== null;
  
  return encryptorTeamHasFinal && opponentHasGuess;
}

// 检查是否需要进入投票阶段
export function checkNeedTeamVoting(room) {
  const encryptorTeam = room.encryptorTeam;
  const teamVote = room.teamVotes[encryptorTeam];
  
  // 两人都提交了但不一致
  if (teamVote.player1Guess !== null && teamVote.player2Guess !== null && teamVote.finalGuess === null) {
    return true;
  }
  return false;
}

export function processRound(room) {
  const correctCode = room.currentCode;
  const encryptorTeam = room.encryptorTeam;
  const interceptTeam = encryptorTeam === 'white' ? 'black' : 'white';
  
  const teammateGuess = room.teamVotes[encryptorTeam].finalGuess;
  const opponentGuess = room.opponentGuess;

  const teammateCorrect = teammateGuess.every((g, i) => g === correctCode[i]);
  const opponentCorrect = opponentGuess.every((g, i) => g === correctCode[i]);

  let message = '';
  const roundResult = {
    round: room.currentRound,
    encryptorTeam,
    interceptTeam,
    correctCode: [...correctCode],
    teammateGuess: [...teammateGuess],
    opponentGuess: [...opponentGuess],
    teammateCorrect,
    opponentCorrect,
    tokens: {
      whiteInterception: room.teams.white.interceptionTokens || 0,
      blackInterception: room.teams.black.interceptionTokens || 0,
      whiteMiscommunication: room.teams.white.miscommunicationTokens || 0,
      blackMiscommunication: room.teams.black.miscommunicationTokens || 0
    }
  };

  if (teammateCorrect && opponentCorrect) {
    room.teams[interceptTeam].interceptionTokens++;
    message = ` intercepted! ${teamName(interceptTeam)}获得1个拦截标记！`;
  } else if (teammateCorrect && !opponentCorrect) {
    message = ` ${teamName(encryptorTeam)}队友猜对了，${teamName(interceptTeam)}拦截失败！无事发生，继续下一回合！`;
  } else if (!teammateCorrect && opponentCorrect) {
    room.teams[interceptTeam].interceptionTokens++;
    room.teams[encryptorTeam].miscommunicationTokens++;
    message = ` ${teamName(encryptorTeam)}队友猜错了，${teamName(interceptTeam)}成功拦截！${teamName(interceptTeam)}获得1个拦截标记，${teamName(encryptorTeam)}获得1个失误标记！`;
  } else {
    room.teams[encryptorTeam].miscommunicationTokens++;
    message = ` 双方都猜错了！${teamName(encryptorTeam)}获得1个失误标记！正确密码是: ${correctCode.join(' - ')}`;
  }

  roundResult.message = message;

  room.notes[encryptorTeam].push({
    round: room.currentRound,
    clues: [...room.clues],
    code: [...correctCode],
    teammateGuess: [...teammateGuess],
    success: teammateCorrect
  });

  room.notes[interceptTeam].push({
    round: room.currentRound,
    clues: [...room.clues],
    opponentGuess: [...opponentGuess],
    success: opponentCorrect
  });

  roundResult.tokens = {
    whiteInterception: room.teams.white.interceptionTokens,
    blackInterception: room.teams.black.interceptionTokens,
    whiteMiscommunication: room.teams.white.miscommunicationTokens,
    blackMiscommunication: room.teams.black.miscommunicationTokens
  };

  checkWinCondition(room, roundResult);

  room.phase = GAME_PHASES.RESULT;
  room.roundResult = roundResult;
  room.roundHistory.push(roundResult);
  room.updatedAt = Date.now();

  return { room };
}

function teamName(team) {
  return team === 'white' ? '白队' : '黑队';
}

export function checkWinCondition(room, roundResult) {
  const whiteInterception = room.teams.white.interceptionTokens;
  const blackInterception = room.teams.black.interceptionTokens;
  const whiteMiscommunication = room.teams.white.miscommunicationTokens;
  const blackMiscommunication = room.teams.black.miscommunicationTokens;

  if (whiteInterception >= 2) {
    room.winner = 'white';
    room.status = GAME_PHASES.ENDED;
    if (roundResult) {
      roundResult.message += '<br><br> 白队获得胜利！（2次成功拦截）';
    }
  } else if (blackInterception >= 2) {
    room.winner = 'black';
    room.status = GAME_PHASES.ENDED;
    if (roundResult) {
      roundResult.message += '<br><br> 黑队获得胜利！（2次成功拦截）';
    }
  } else if (whiteMiscommunication >= 2) {
    room.winner = 'black';
    room.status = GAME_PHASES.ENDED;
    if (roundResult) {
      roundResult.message += '<br><br> 黑队获得胜利！（白队2次失误）';
    }
  } else if (blackMiscommunication >= 2) {
    room.winner = 'white';
    room.status = GAME_PHASES.ENDED;
    if (roundResult) {
      roundResult.message += '<br><br> 白队获得胜利！（黑队2次失误）';
    }
  }

  return room;
}

export function nextRound(room) {
  // 移动到下一个轮换位置
  room.rotationIndex = (room.rotationIndex + 1) % ROTATION_SEQUENCE.length;
  const nextRotation = ROTATION_SEQUENCE[room.rotationIndex];
  
  room.encryptorTeam = nextRotation.team;
  room.encryptor = room.teams[nextRotation.team].players[nextRotation.index];
  
  // 更新玩家角色
  updateEncryptorRole(room);
  
  room.currentRound++;
  room.phase = GAME_PHASES.ENCRYPTING;
  room.clues = [];
  room.teamVotes = {
    white: { player1Guess: null, player2Guess: null, finalGuess: null },
    black: { player1Guess: null, player2Guess: null, finalGuess: null }
  };
  room.opponentGuess = null;
  room.currentCode = generateCode();
  room.roundResult = null;
  room.updatedAt = Date.now();

  return room;
}

export function resetGame(room) {
  const allKeywords = getAllKeywords();
  const selectedKeywords = allKeywords.sort(() => Math.random() - 0.5).slice(0, 8);
  const keywordSets = splitKeywords(selectedKeywords, 4, 4);

  room.whiteKeywords = keywordSets.white;
  room.blackKeywords = keywordSets.black;
  room.currentCode = generateCode();
  room.status = 'playing';
  room.currentRound = 1;
  room.phase = GAME_PHASES.ENCRYPTING;
  
  // 重置轮换
  room.rotationIndex = 0;
  const firstRotation = ROTATION_SEQUENCE[0];
  room.encryptorTeam = firstRotation.team;
  room.encryptor = room.teams[firstRotation.team].players[firstRotation.index];
  
  updateEncryptorRole(room);
  
  room.teams.white.encryptorIndex = 0;
  room.teams.black.encryptorIndex = 0;
  room.teams.white.interceptionTokens = 0;
  room.teams.black.interceptionTokens = 0;
  room.teams.white.miscommunicationTokens = 0;
  room.teams.black.miscommunicationTokens = 0;
  room.clues = [];
  room.teamVotes = {
    white: { player1Guess: null, player2Guess: null, finalGuess: null },
    black: { player1Guess: null, player2Guess: null, finalGuess: null }
  };
  room.opponentGuess = null;
  room.usedClues = [];
  room.notes = { white: [], black: [] };
  room.roundHistory = [];
  room.winner = null;
  room.roundResult = null;
  room.updatedAt = Date.now();

  return room;
}

// 获取当前情报官信息
export function getCurrentEncryptorInfo(room) {
  const encryptor = room.players.find(p => p.id === room.encryptor);
  return {
    id: room.encryptor,
    name: encryptor?.name || '未知',
    team: room.encryptorTeam,
    teamName: teamName(room.encryptorTeam)
  };
}

// 获取轮换顺序中的下一个情报官
export function getNextEncryptorInfo(room) {
  const nextIndex = (room.rotationIndex + 1) % ROTATION_SEQUENCE.length;
  const nextRotation = ROTATION_SEQUENCE[nextIndex];
  const nextEncryptorId = room.teams[nextRotation.team].players[nextRotation.index];
  const nextEncryptor = room.players.find(p => p.id === nextEncryptorId);
  
  return {
    id: nextEncryptorId,
    name: nextEncryptor?.name || '未知',
    team: nextRotation.team,
    teamName: teamName(nextRotation.team)
  };
}