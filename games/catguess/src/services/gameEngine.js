export const GAME_PHASES = {
  WAITING: 'waiting',
  STORYTELLER_PICKING: 'storyteller_picking',
  OTHERS_PICKING: 'others_picking',
  REVEALING: 'revealing',
  SCORING: 'scoring',
  ENDED: 'ended',
  PLAYING: 'playing'
};

export function generatePlayerId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function createInitialRoom(hostPlayerId, hostName, roomCode, wordPool) {
  return {
    id: roomCode,
    code: roomCode,
    hostId: hostPlayerId,
    status: GAME_PHASES.WAITING,
    phase: GAME_PHASES.WAITING,
    players: [{
      id: hostPlayerId,
      name: hostName,
      isHost: true,
      isOnline: true,
      order: 0,
      hand: []
    }],
    gameState: {
      round: 0,
      storytellerId: null,
      secretCardId: null,
      clue: '',
      submittedCards: [],
      shuffledCards: [],
      votes: [],
      roundScores: {},
      scores: {},
      roundHistory: [],
      winner: null
    },
    wordPool: [...wordPool],
    disconnectedPlayers: [],
    savedPhase: null,
    savedStorytellerId: null,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
}

export function addPlayerToRoom(room, playerName, playerId) {
  const disconnectedPlayer = room.disconnectedPlayers?.find(p => p.id === playerId);
  if (disconnectedPlayer) {
    const player = room.players.find(p => p.id === playerId);
    if (player) {
      player.isOnline = true;
      player.name = playerName;
      room.disconnectedPlayers = room.disconnectedPlayers.filter(p => p.id !== playerId);
      room.updatedAt = Date.now();
      return { room, reconnected: true };
    }
  }

  if (room.players.length >= 6) {
    return { error: '房间已满（最多6人）' };
  }

  if (room.players.find(p => p.id === playerId)) {
    return { error: '玩家已在房间中' };
  }

  const player = {
    id: playerId,
    name: playerName,
    isHost: false,
    isOnline: true,
    order: room.players.length,
    hand: []
  };

  room.players.push(player);
  room.updatedAt = Date.now();
  return { room, reconnected: false };
}

export function removePlayerFromRoom(room, playerId) {
  const player = room.players.find(p => p.id === playerId);
  if (!player) return room;

  if (
    room.status === GAME_PHASES.PLAYING &&
    room.phase !== GAME_PHASES.WAITING &&
    room.phase !== GAME_PHASES.ENDED
  ) {
    player.isOnline = false;
    if (!room.disconnectedPlayers) room.disconnectedPlayers = [];
    room.disconnectedPlayers.push({
      id: player.id,
      name: player.name,
      disconnectedAt: Date.now()
    });

    room.savedPhase = room.phase;
    room.savedStorytellerId = room.gameState.storytellerId;
    room.updatedAt = Date.now();
    return room;
  }

  room.players = room.players.filter(p => p.id !== playerId);

  if (room.players.length > 0) {
    const oldHost = room.players.find(p => p.id === room.hostId);
    if (!oldHost) {
      room.hostId = room.players[0].id;
      room.players[0].isHost = true;
    }
  }

  room.updatedAt = Date.now();
  return room;
}

export function dealCardsToPlayers(room, cardsPerPlayer = 5) {
  room.players.forEach(player => {
    player.hand = [];
    for (let i = 0; i < cardsPerPlayer; i++) {
      if (room.wordPool.length === 0) break;
      const randomIndex = Math.floor(Math.random() * room.wordPool.length);
      const word = room.wordPool.splice(randomIndex, 1)[0];
      player.hand.push(word);
    }
  });

  room.updatedAt = Date.now();
  return { room };
}

export function startGame(room) {
  if (room.status !== GAME_PHASES.WAITING) {
    return { error: '游戏已经开始' };
  }

  if (room.players.filter(p => p.isOnline).length < 3) {
    return { error: '至少需要3名玩家才能开始游戏' };
  }

  room.status = GAME_PHASES.PLAYING;
  room.phase = GAME_PHASES.STORYTELLER_PICKING;
  room.gameState.round = 1;
  room.gameState.storytellerId = room.players.filter(p => p.isOnline)[0].id;
  room.gameState.secretCardId = null;
  room.gameState.clue = '';
  room.gameState.submittedCards = [];
  room.gameState.shuffledCards = [];
  room.gameState.votes = [];
  room.gameState.roundScores = {};
  room.gameState.roundHistory = [];
  room.gameState.winner = null;
  room.disconnectedPlayers = [];
  room.savedPhase = null;
  room.savedStorytellerId = null;

  room.players.forEach(p => {
    room.gameState.scores[p.id] = room.gameState.scores[p.id] || 0;
  });

  dealCardsToPlayers(room, 5);

  room.updatedAt = Date.now();
  return { room };
}

export function submitStorySelection(room, playerId, selectedCardIndex, clue) {
  if (room.phase !== GAME_PHASES.STORYTELLER_PICKING) {
    return { error: '当前不是讲故事者选择阶段' };
  }

  if (room.gameState.storytellerId !== playerId) {
    return { error: '只有当前讲故事者可以提交选择' };
  }

  const storyteller = room.players.find(p => p.id === playerId);
  if (!storyteller) {
    return { error: '玩家不存在' };
  }

  if (selectedCardIndex < 0 || selectedCardIndex >= storyteller.hand.length) {
    return { error: '无效的卡片选择' };
  }

  if (!clue || clue.trim().length === 0) {
    return { error: '提示不能为空' };
  }

  if (clue.trim().length > 20) {
    return { error: '提示不能超过20个字' };
  }

  room.gameState.secretCardId = selectedCardIndex;
  room.gameState.clue = clue.trim();
  room.phase = GAME_PHASES.OTHERS_PICKING;
  room.updatedAt = Date.now();

  return { room };
}

export function submitCard(room, playerId, selectedCardIndex) {
  if (room.phase !== GAME_PHASES.OTHERS_PICKING) {
    return { error: '当前不是其他玩家选牌阶段' };
  }

  if (playerId === room.gameState.storytellerId) {
    return { error: '讲故事者不需要选牌' };
  }

  const player = room.players.find(p => p.id === playerId);
  if (!player) {
    return { error: '玩家不存在' };
  }

  if (!player.isOnline) {
    return { error: '断线玩家无法选牌' };
  }

  if (selectedCardIndex < 0 || selectedCardIndex >= player.hand.length) {
    return { error: '无效的卡片选择' };
  }

  if (room.gameState.submittedCards.find(sc => sc.playerId === playerId)) {
    return { error: '你已经提交过了' };
  }

  room.gameState.submittedCards.push({
    playerId,
    cardId: selectedCardIndex
  });

  room.updatedAt = Date.now();

  const nonStorytellerPlayers = room.players.filter(
    p => p.id !== room.gameState.storytellerId && p.isOnline
  );
  const allSubmitted = nonStorytellerPlayers.every(
    p => room.gameState.submittedCards.find(sc => sc.playerId === p.id)
  );

  if (allSubmitted) {
    room.phase = GAME_PHASES.REVEALING;

    const allCards = [];

    const storyteller = room.players.find(p => p.id === room.gameState.storytellerId);
    const secretWord = storyteller.hand[room.gameState.secretCardId];
    allCards.push({
      word: secretWord,
      isSecret: true,
      submitterId: storyteller.id
    });

    room.gameState.submittedCards.forEach(sc => {
      const submitter = room.players.find(p => p.id === sc.playerId);
      if (!submitter) return;
      const word = submitter.hand[sc.cardId];
      allCards.push({
        word,
        isSecret: false,
        submitterId: sc.playerId
      });
    });

    const shuffled = allCards.sort(() => Math.random() - 0.5);
    room.gameState.shuffledCards = shuffled.map((card, index) => ({
      id: index,
      word: card.word,
      isSecret: card.isSecret,
      submitterId: card.submitterId
    }));

    room.updatedAt = Date.now();
  }

  return { room };
}

export function submitVote(room, voterId, votedCardId) {
  if (room.phase !== GAME_PHASES.REVEALING) {
    return { error: '当前不是投票阶段' };
  }

  if (voterId === room.gameState.storytellerId) {
    return { error: '讲故事者不能投票' };
  }

  const voter = room.players.find(p => p.id === voterId);
  if (!voter) {
    return { error: '玩家不存在' };
  }

  if (!voter.isOnline) {
    return { error: '断线玩家无法投票' };
  }

  if (room.gameState.votes.find(v => v.voterId === voterId)) {
    return { error: '你已经投过票了' };
  }

  if (votedCardId < 0 || votedCardId >= room.gameState.shuffledCards.length) {
    return { error: '无效的投票选择' };
  }

  room.gameState.votes.push({ voterId, votedCardId });
  room.updatedAt = Date.now();

  const eligibleVoters = room.players.filter(
    p => p.id !== room.gameState.storytellerId && p.isOnline
  );
  const allVoted = eligibleVoters.every(
    p => room.gameState.votes.find(v => v.voterId === p.id)
  );

  if (allVoted) {
    calculateScores(room);
    room.phase = GAME_PHASES.SCORING;
    room.updatedAt = Date.now();
  }

  return { room };
}

export function calculateScores(room) {
  const { shuffledCards, votes, storytellerId, scores } = room.gameState;

  room.gameState.roundScores = {};
  room.players.forEach(p => {
    room.gameState.roundScores[p.id] = 0;
  });

  const secretCard = shuffledCards.find(c => c.isSecret);
  const secretCardId = secretCard ? secretCard.id : -1;

  const correctVoters = votes.filter(v => v.votedCardId === secretCardId);
  const correctCount = correctVoters.length;
  const totalVoters = votes.length;

  if (correctCount === 0 || correctCount === totalVoters) {
    votes.forEach(v => {
      room.gameState.roundScores[v.voterId] += 2;
    });
  } else {
    room.gameState.roundScores[storytellerId] += 3;
    correctVoters.forEach(v => {
      room.gameState.roundScores[v.voterId] += 3;
    });
  }

  votes.forEach(v => {
    const card = shuffledCards.find(c => c.id === v.votedCardId);
    if (card && !card.isSecret) {
      room.gameState.roundScores[card.submitterId] =
        (room.gameState.roundScores[card.submitterId] || 0) + 1;
    }
  });

  Object.keys(room.gameState.roundScores).forEach(pid => {
    scores[pid] = (scores[pid] || 0) + room.gameState.roundScores[pid];
  });

  room.gameState.roundHistory.push({
    round: room.gameState.round,
    storytellerId,
    clue: room.gameState.clue,
    secretCardWord: secretCard ? secretCard.word : '',
    shuffledCards: shuffledCards.map(c => ({ id: c.id, word: c.word })),
    votes: votes.map(v => ({ voterId: v.voterId, votedCardId: v.votedCardId })),
    roundScores: { ...room.gameState.roundScores },
    scores: { ...scores },
    correctCount,
    totalVoters
  });

  room.updatedAt = Date.now();
  return { room };
}

export function nextRound(room) {
  const onlinePlayers = room.players.filter(p => p.isOnline);

  if (onlinePlayers.length < 3) {
    return { error: '在线玩家不足3人，游戏无法继续' };
  }

  const currentStorytellerIndex = onlinePlayers.findIndex(
    p => p.id === room.gameState.storytellerId
  );
  const nextStorytellerIndex =
    currentStorytellerIndex >= 0
      ? (currentStorytellerIndex + 1) % onlinePlayers.length
      : 0;

  room.gameState.round++;
  room.gameState.storytellerId = onlinePlayers[nextStorytellerIndex].id;
  room.gameState.secretCardId = null;
  room.gameState.clue = '';
  room.gameState.submittedCards = [];
  room.gameState.shuffledCards = [];
  room.gameState.votes = [];
  room.gameState.roundScores = {};

  dealCardsToPlayers(room, 5);

  const hasWinner = checkWinCondition(room, 10);

  if (!hasWinner) {
    room.phase = GAME_PHASES.STORYTELLER_PICKING;
  }

  room.updatedAt = Date.now();
  return { room };
}

export function restartGame(room) {
  room.status = GAME_PHASES.PLAYING;
  room.phase = GAME_PHASES.STORYTELLER_PICKING;
  room.gameState.round = 1;
  room.gameState.storytellerId = room.players.filter(p => p.isOnline)[0]?.id || room.players[0]?.id;
  room.gameState.secretCardId = null;
  room.gameState.clue = '';
  room.gameState.submittedCards = [];
  room.gameState.shuffledCards = [];
  room.gameState.votes = [];
  room.gameState.roundScores = {};
  room.gameState.scores = {};
  room.gameState.roundHistory = [];
  room.gameState.winner = null;
  room.disconnectedPlayers = [];
  room.savedPhase = null;
  room.savedStorytellerId = null;

  room.players.forEach(p => {
    room.gameState.scores[p.id] = 0;
  });

  dealCardsToPlayers(room, 5);

  room.updatedAt = Date.now();
  return { room };
}

export function checkWinCondition(room, targetScore = 10) {
  for (const [playerId, score] of Object.entries(room.gameState.scores)) {
    if (score >= targetScore) {
      room.gameState.winner = playerId;
      room.status = GAME_PHASES.ENDED;
      room.phase = GAME_PHASES.ENDED;
      room.updatedAt = Date.now();
      return true;
    }
  }
  return false;
}

export function getOnlinePlayerCount(room) {
  return room.players.filter(p => p.isOnline).length;
}

export function getDisconnectedPlayers(room) {
  return room.players.filter(p => !p.isOnline);
}
