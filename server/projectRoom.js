/** 按观察者裁剪权威房间；真人和 Agent 共用，禁止把权威 room 直接下发。 */
const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));
const publicPlayerFields = ['id', 'name', 'type', 'isHost', 'isOnline', 'order', 'role', 'team', 'isEncryptor', 'isEliminated', 'color'];

function playersFor(room, playerId) {
  return room.players.map(player => {
    const projected = Object.fromEntries(publicPlayerFields.filter(key => player[key] !== undefined).map(key => [key, clone(player[key])]));
    projected.type = player.type === 'agent' ? 'agent' : 'human';
    if (player.id === playerId && Array.isArray(player.hand)) projected.hand = clone(player.hand);
    return projected;
  });
}

function baseRoom(room, playerId) {
  return {
    id: room.id,
    code: room.code,
    hostId: room.hostId,
    status: room.status,
    phase: room.phase,
    settings: clone(room.settings),
    players: playersFor(room, playerId),
    disconnectedPlayers: (room.disconnectedPlayers || []).map(({ id, name, disconnectedAt }) => ({ id, name, disconnectedAt }))
  };
}

function projectCodenames(room, playerId) {
  const view = baseRoom(room, playerId);
  const me = room.players.find(player => player.id === playerId);
  const isEncryptor = room.encryptor === playerId;
  Object.assign(view, clone({
    teams: room.teams,
    currentRound: room.currentRound,
    encryptor: room.encryptor,
    encryptorTeam: room.encryptorTeam,
    clues: room.clues,
    usedClues: room.usedClues,
    notes: room.notes,
    roundHistory: room.roundHistory,
    roundResult: room.roundResult,
    winner: room.winner,
    rotationIndex: room.rotationIndex
  }));
  view.whiteKeywords = isEncryptor && me?.team === 'white' ? clone(room.whiteKeywords) : [];
  view.blackKeywords = isEncryptor && me?.team === 'black' ? clone(room.blackKeywords) : [];
  view.currentCode = isEncryptor ? clone(room.currentCode) : [];
  const ownVotes = room.teamVotes?.[me?.team];
  view.teamVotes = {
    white: { player1Guess: null, player2Guess: null, finalGuess: null },
    black: { player1Guess: null, player2Guess: null, finalGuess: null }
  };
  if (me?.team && ownVotes) view.teamVotes[me.team] = clone(ownVotes);
  view.opponentVotes = me?.team && me.team !== room.encryptorTeam
    ? clone(room.opponentVotes)
    : { player1Guess: null, player2Guess: null, finalGuess: null };
  view.opponentGuess = me?.team && me.team !== room.encryptorTeam ? clone(room.opponentGuess) : null;
  return view;
}

function projectCatguess(room, playerId) {
  const view = baseRoom(room, playerId);
  const source = room.gameState || {};
  const revealed = room.phase === 'scoring' || room.phase === 'ended';
  const storyteller = source.storytellerId === playerId;
  const gameState = clone({
    round: source.round,
    storytellerId: source.storytellerId,
    clue: source.clue,
    roundScores: source.roundScores,
    scores: source.scores,
    roundHistory: source.roundHistory,
    winner: source.winner
  });
  gameState.secretCardId = storyteller ? source.secretCardId : null;
  if (storyteller && source.secretWord !== undefined) gameState.secretWord = source.secretWord;
  gameState.submittedCards = (source.submittedCards || []).map(card => revealed || card.playerId === playerId
    ? clone(card)
    : { playerId: card.playerId, submitted: true });
  gameState.shuffledCards = (source.shuffledCards || []).map(card => revealed
    ? clone(card)
    : { id: card.id, word: card.word });
  gameState.votes = (source.votes || []).map(vote => revealed || vote.voterId === playerId
    ? clone(vote)
    : { voterId: vote.voterId, hasVoted: true });
  view.gameState = gameState;
  return view;
}

function projectBombdefuse(room, playerId) {
  const view = baseRoom(room, playerId);
  const role = room.players.find(player => player.id === playerId)?.role;
  const source = room.gameState || {};
  view.gameState = {
    startedAt: source.startedAt,
    deadlineAt: source.deadlineAt,
    durationMs: source.durationMs,
    strikeLimit: source.strikeLimit,
    difficulty: source.difficulty,
    strikes: clone(source.strikes || []),
    serialNumber: source.serialNumber,
    batteries: source.batteries,
    indicators: clone(source.indicators || []),
    solvedModuleIds: clone(source.solvedModuleIds || []),
    actionLog: clone(source.actionLog || []),
    result: source.result,
    endedAt: source.endedAt
  };
  view.gameState.modules = (source.modules || []).map(module => {
    const publicModule = clone(module);
    delete publicModule.solution;
    const { manualView, bombView } = publicModule;
    delete publicModule.manualView;
    delete publicModule.bombView;
    if (role === 'expert') return { ...publicModule, manualView };
    return { ...publicModule, bombView };
  });
  return view;
}

function projectGomoku(room, playerId) {
  const view = baseRoom(room, playerId);
  // 五子棋没有隐藏信息：棋盘、回合与计时对双方公开。
  Object.assign(view, clone({
    board: room.board,
    currentTurn: room.currentTurn,
    moveHistory: room.moveHistory,
    winner: room.winner,
    winningLine: room.winningLine,
    endReason: room.endReason,
    turnDeadline: room.turnDeadline
  }));
  return view;
}

export function projectRoom(room, playerId, gameId) {
  switch (gameId) {
    case 'codenames': return projectCodenames(room, playerId);
    case 'catguess': return projectCatguess(room, playerId);
    case 'bombdefuse': return projectBombdefuse(room, playerId);
    case 'territory': {
      const view = baseRoom(room, playerId);
      view.gameState = clone(room.gameState);
      return view;
    }
    case 'gomoku': return projectGomoku(room, playerId);
    default: throw new Error(`Unsupported game: ${gameId}`);
  }
}
