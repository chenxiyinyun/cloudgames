import { getAllKeywords, splitKeywords } from '../data/keywords';

export const GAME_PHASES = {
  WAITING: 'waiting',
  ASSIGNING_TEAMS: 'assigning_teams',
  ENCRYPTING: 'encrypting',
  GUESSING: 'guessing',
  RESULT: 'result',
  ENDED: 'ended'
};

export const GUESS_TYPE = {
  TEAMMATE: 'teammate',
  OPPONENT: 'opponent'
};

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
    teammateGuess: null,
    opponentGuess: null,
    usedClues: [],
    notes: { white: [], black: [] },
    roundHistory: [],
    winner: null,
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
    player.isEncryptor = (index === 0 || index === 2);
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
  room.encryptor = room.teams.white.players[0];
  room.encryptorTeam = 'white';
  room.clues = [];
  room.teammateGuess = null;
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
  room.phase = GAME_PHASES.GUESSING;
  room.updatedAt = Date.now();

  return { room };
}

export function submitGuess(room, playerId, guessType, guess) {
  if (room.phase !== GAME_PHASES.GUESSING) {
    return { error: '当前不是猜测阶段' };
  }

  if (![GUESS_TYPE.TEAMMATE, GUESS_TYPE.OPPONENT].includes(guessType)) {
    return { error: '无效的猜测类型' };
  }

  if (!Array.isArray(guess) || guess.length !== 3) {
    return { error: '需要提交3个数字' };
  }

  if (guess.some(g => !Number.isInteger(g) || g < 1 || g > 4)) {
    return { error: '每个数字必须在1-4之间' };
  }

  const player = room.players.find(p => p.id === playerId);
  if (!player) return { error: '玩家不存在' };

  if (guessType === GUESS_TYPE.TEAMMATE) {
    if (player.team !== room.encryptorTeam) {
      return { error: '只有加密方队友可以提交猜测' };
    }
    if (player.isEncryptor) {
      return { error: '情报官不能提交猜测' };
    }
    if (room.teammateGuess !== null) {
      return { error: '队伍猜测已提交' };
    }
    room.teammateGuess = guess;
  } else {
    if (player.team === room.encryptorTeam) {
      return { error: '只有对方队可以拦截' };
    }
    if (room.opponentGuess !== null) {
      return { error: '拦截猜测已提交' };
    }
    room.opponentGuess = guess;
  }

  room.updatedAt = Date.now();

  if (room.teammateGuess !== null && room.opponentGuess !== null) {
    return processRound(room);
  }

  return { room };
}

export function processRound(room) {
  const correctCode = room.currentCode;
  const teammateCorrect = room.teammateGuess.every((g, i) => g === correctCode[i]);
  const opponentCorrect = room.opponentGuess.every((g, i) => g === correctCode[i]);

  const encryptorTeam = room.encryptorTeam;
  const interceptTeam = encryptorTeam === 'white' ? 'black' : 'white';

  let message = '';
  const roundResult = {
    round: room.currentRound,
    encryptorTeam,
    interceptTeam,
    correctCode: [...correctCode],
    teammateGuess: [...room.teammateGuess],
    opponentGuess: [...room.opponentGuess],
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
    message = `⚠️ ${teamName(encryptorTeam)}队友猜对了，但${teamName(interceptTeam)}也成功拦截！${teamName(interceptTeam)}获得1个拦截标记！`;
  } else if (teammateCorrect && !opponentCorrect) {
    message = `✅ ${teamName(encryptorTeam)}队友猜对了，${teamName(interceptTeam)}拦截失败！无事发生，继续下一回合！`;
  } else if (!teammateCorrect && opponentCorrect) {
    room.teams[interceptTeam].interceptionTokens++;
    room.teams[encryptorTeam].miscommunicationTokens++;
    message = `🛡️ ${teamName(encryptorTeam)}队友猜错了，${teamName(interceptTeam)}成功拦截！${teamName(interceptTeam)}获得1个拦截标记，${teamName(encryptorTeam)}获得1个失误标记！`;
  } else {
    room.teams[encryptorTeam].miscommunicationTokens++;
    message = `❌ 双方都猜错了！${teamName(encryptorTeam)}获得1个失误标记！正确密码是: ${correctCode.join(' - ')}`;
  }

  roundResult.message = message;

  room.notes[encryptorTeam].push({
    round: room.currentRound,
    clues: [...room.clues],
    code: [...correctCode],
    teammateGuess: [...room.teammateGuess],
    success: teammateCorrect
  });

  room.notes[interceptTeam].push({
    round: room.currentRound,
    clues: [...room.clues],
    opponentGuess: [...room.opponentGuess],
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
      roundResult.message += '<br><br>🎉 白队获得胜利！（2次成功拦截）';
    }
  } else if (blackInterception >= 2) {
    room.winner = 'black';
    room.status = GAME_PHASES.ENDED;
    if (roundResult) {
      roundResult.message += '<br><br>🎉 黑队获得胜利！（2次成功拦截）';
    }
  } else if (whiteMiscommunication >= 2) {
    room.winner = 'black';
    room.status = GAME_PHASES.ENDED;
    if (roundResult) {
      roundResult.message += '<br><br>🎉 黑队获得胜利！（白队2次失误）';
    }
  } else if (blackMiscommunication >= 2) {
    room.winner = 'white';
    room.status = GAME_PHASES.ENDED;
    if (roundResult) {
      roundResult.message += '<br><br>🎉 白队获得胜利！（黑队2次失误）';
    }
  }

  return room;
}

export function nextRound(room) {
  const currentEncryptorTeam = room.encryptorTeam;
  room.teams[currentEncryptorTeam].encryptorIndex =
    (room.teams[currentEncryptorTeam].encryptorIndex + 1) % room.teams[currentEncryptorTeam].players.length;

  const nextTeam = currentEncryptorTeam === 'white' ? 'black' : 'white';
  const nextEncryptorId = room.teams[nextTeam].players[room.teams[nextTeam].encryptorIndex];

  room.currentRound++;
  room.phase = GAME_PHASES.ENCRYPTING;
  room.encryptor = nextEncryptorId;
  room.encryptorTeam = nextTeam;
  room.clues = [];
  room.teammateGuess = null;
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
  room.encryptor = room.teams.white.players[0];
  room.encryptorTeam = 'white';
  room.teams.white.encryptorIndex = 0;
  room.teams.black.encryptorIndex = 0;
  room.teams.white.interceptionTokens = 0;
  room.teams.black.interceptionTokens = 0;
  room.teams.white.miscommunicationTokens = 0;
  room.teams.black.miscommunicationTokens = 0;
  room.clues = [];
  room.teammateGuess = null;
  room.opponentGuess = null;
  room.usedClues = [];
  room.notes = { white: [], black: [] };
  room.roundHistory = [];
  room.winner = null;
  room.roundResult = null;
  room.updatedAt = Date.now();

  return room;
}