import { describe, it, expect, beforeEach } from 'vitest'
import {
  GAME_PHASES,
  generatePlayerId,
  createInitialRoom,
  addPlayerToRoom,
  removePlayerFromRoom,
  assignTeams,
  startGame,
  generateCode,
  submitClues,
  submitTeamGuess,
  submitOpponentGuess,
  submitTeamFinalVote,
  checkNeedTeamVoting,
  processRound,
  checkWinCondition,
  nextRound,
  resetGame,
  getCurrentEncryptorInfo,
  getNextEncryptorInfo,
  getOnlinePlayerCount,
  getDisconnectedPlayers,
  resumeGame,
  canResumeGame
} from '../gameEngine'

// ─── Helpers ────────────────────────────────────────────────

function makeRoomWith4Players() {
  const room = createInitialRoom('host-id', 'Host', 'ABCD12')
  addPlayerToRoom(room, 'Player2', 'p2')
  addPlayerToRoom(room, 'Player3', 'p3')
  addPlayerToRoom(room, 'Player4', 'p4')
  return startGame(room)
}

function safeClue(n) {
  return `CLUE_UNIQUE_TEST_${n}`
}

/**
 * For round 1 (encryptor at index 0): the non-encryptor is at index 1.
 * Their guess goes to player2Guess slot.
 */
function getNonEncryptorVoteKey(room) {
  const encryptorTeam = room.encryptorTeam
  const encryptorId = room.encryptor
  const nonEncryptorId = room.teams[encryptorTeam].players.find(id => id !== encryptorId)
  const playerIndex = room.teams[encryptorTeam].players.indexOf(nonEncryptorId)
  return playerIndex === 0 ? 'player1Guess' : 'player2Guess'
}

// ════════════════════════════════════════════════════════════
//  generatePlayerId
// ════════════════════════════════════════════════════════════
describe('generatePlayerId', () => {
  it('returns a non-empty string', () => {
    const id = generatePlayerId()
    expect(id).toBeTypeOf('string')
    expect(id.length).toBeGreaterThan(0)
  })

  it('returns unique IDs across multiple calls', () => {
    const ids = new Set()
    for (let i = 0; i < 100; i++) {
      ids.add(generatePlayerId())
    }
    expect(ids.size).toBe(100)
  })
})

// ════════════════════════════════════════════════════════════
//  generateCode
// ════════════════════════════════════════════════════════════
describe('generateCode', () => {
  it('returns an array of 3 numbers', () => {
    const code = generateCode()
    expect(Array.isArray(code)).toBe(true)
    expect(code).toHaveLength(3)
  })

  it('each number is between 1 and 4 inclusive', () => {
    for (let i = 0; i < 50; i++) {
      const code = generateCode()
      code.forEach(n => {
        expect(n).toBeGreaterThanOrEqual(1)
        expect(n).toBeLessThanOrEqual(4)
      })
    }
  })
})

// ════════════════════════════════════════════════════════════
//  createInitialRoom
// ════════════════════════════════════════════════════════════
describe('createInitialRoom', () => {
  it('creates a room with correct id and code', () => {
    const room = createInitialRoom('abc', 'Alice', 'ROOM01')
    expect(room.id).toBe('ROOM01')
    expect(room.code).toBe('ROOM01')
  })

  it('sets the host as the only player', () => {
    const room = createInitialRoom('abc', 'Alice', 'ROOM01')
    expect(room.players).toHaveLength(1)
    expect(room.players[0].id).toBe('abc')
    expect(room.players[0].name).toBe('Alice')
    expect(room.players[0].isHost).toBe(true)
    expect(room.players[0].isOnline).toBe(true)
  })

  it('initializes in WAITING phase', () => {
    const room = createInitialRoom('abc', 'Alice', 'ROOM01')
    expect(room.status).toBe(GAME_PHASES.WAITING)
    expect(room.phase).toBe(GAME_PHASES.WAITING)
    expect(room.currentRound).toBe(0)
  })

  it('initializes empty keywords and code', () => {
    const room = createInitialRoom('abc', 'Alice', 'ROOM01')
    expect(room.whiteKeywords).toEqual([])
    expect(room.blackKeywords).toEqual([])
    expect(room.currentCode).toEqual([])
  })

  it('initializes team structures correctly', () => {
    const room = createInitialRoom('abc', 'Alice', 'ROOM01')
    expect(room.teams.white.players).toEqual([])
    expect(room.teams.black.players).toEqual([])
    expect(room.teams.white.interceptionTokens).toBe(0)
    expect(room.teams.black.miscommunicationTokens).toBe(0)
  })

  it('initializes vote structures with nulls', () => {
    const room = createInitialRoom('abc', 'Alice', 'ROOM01')
    expect(room.teamVotes.white.player1Guess).toBeNull()
    expect(room.teamVotes.white.player2Guess).toBeNull()
    expect(room.teamVotes.white.finalGuess).toBeNull()
    expect(room.teamVotes.black.player1Guess).toBeNull()
    expect(room.teamVotes.black.player2Guess).toBeNull()
    expect(room.teamVotes.black.finalGuess).toBeNull()
  })

  it('has hostId set correctly', () => {
    const room = createInitialRoom('abc', 'Alice', 'ROOM01')
    expect(room.hostId).toBe('abc')
  })

  it('initializes empty roundHistory and notes', () => {
    const room = createInitialRoom('abc', 'Alice', 'ROOM01')
    expect(room.roundHistory).toEqual([])
    expect(room.notes.white).toEqual([])
    expect(room.notes.black).toEqual([])
  })

  it('has createdAt and updatedAt timestamps', () => {
    const before = Date.now()
    const room = createInitialRoom('abc', 'Alice', 'ROOM01')
    const after = Date.now()
    expect(room.createdAt).toBeGreaterThanOrEqual(before)
    expect(room.createdAt).toBeLessThanOrEqual(after)
  })
})

// ════════════════════════════════════════════════════════════
//  addPlayerToRoom
// ════════════════════════════════════════════════════════════
describe('addPlayerToRoom', () => {
  let room

  beforeEach(() => {
    room = createInitialRoom('host-id', 'Host', 'ABCD12')
  })

  it('adds a new player successfully', () => {
    const result = addPlayerToRoom(room, 'Player2', 'p2')
    expect(result.error).toBeUndefined()
    expect(result.room.players).toHaveLength(2)
    const p = result.room.players[1]
    expect(p.id).toBe('p2')
    expect(p.name).toBe('Player2')
    expect(p.isHost).toBe(false)
    expect(p.isOnline).toBe(true)
    expect(result.reconnected).toBe(false)
  })

  it('increments player order', () => {
    addPlayerToRoom(room, 'Player2', 'p2')
    addPlayerToRoom(room, 'Player3', 'p3')
    expect(room.players[1].order).toBe(1)
    expect(room.players[2].order).toBe(2)
  })

  it('rejects duplicate player ID', () => {
    addPlayerToRoom(room, 'Player2', 'p2')
    const result = addPlayerToRoom(room, 'P2-Dup', 'p2')
    expect(result.error).toBe('玩家已在房间中')
  })

  it('rejects when room is full (4 players)', () => {
    addPlayerToRoom(room, 'P2', 'p2')
    addPlayerToRoom(room, 'P3', 'p3')
    addPlayerToRoom(room, 'P4', 'p4')
    const result = addPlayerToRoom(room, 'P5', 'p5')
    expect(result.error).toBe('房间已满')
    expect(room.players).toHaveLength(4)
  })

  it('handles reconnection of a disconnected player', () => {
    addPlayerToRoom(room, 'P2', 'p2')
    addPlayerToRoom(room, 'P3', 'p3')
    addPlayerToRoom(room, 'P4', 'p4')
    room.status = 'playing'
    room.phase = GAME_PHASES.ENCRYPTING
    removePlayerFromRoom(room, 'p2')
    const p2 = room.players.find(p => p.id === 'p2')
    expect(p2.isOnline).toBe(false)

    const result = addPlayerToRoom(room, 'Player2-NewName', 'p2')
    expect(result.reconnected).toBe(true)
    const reconnected = room.players.find(p => p.id === 'p2')
    expect(reconnected.isOnline).toBe(true)
    expect(reconnected.name).toBe('Player2-NewName')
    expect(room.disconnectedPlayers.filter(p => p.id === 'p2')).toHaveLength(0)
  })

  it('updates updatedAt timestamp on add', () => {
    const before = Date.now()
    addPlayerToRoom(room, 'P2', 'p2')
    expect(room.updatedAt).toBeGreaterThanOrEqual(before)
  })
})

// ════════════════════════════════════════════════════════════
//  removePlayerFromRoom
// ════════════════════════════════════════════════════════════
describe('removePlayerFromRoom', () => {
  let room

  beforeEach(() => {
    room = createInitialRoom('host-id', 'Host', 'ABCD12')
    addPlayerToRoom(room, 'P2', 'p2')
    addPlayerToRoom(room, 'P3', 'p3')
    addPlayerToRoom(room, 'P4', 'p4')
  })

  it('removes a player in WAITING phase', () => {
    removePlayerFromRoom(room, 'p2')
    expect(room.players).toHaveLength(3)
    expect(room.players.find(p => p.id === 'p2')).toBeUndefined()
  })

  it('reassigns host when host leaves (waiting phase)', () => {
    removePlayerFromRoom(room, 'host-id')
    expect(room.hostId).toBe(room.players[0].id)
    expect(room.players[0].isHost).toBe(true)
  })

  it('marks player as offline instead of removing during playing', () => {
    startGame(room)
    removePlayerFromRoom(room, 'p2')
    const p = room.players.find(p => p.id === 'p2')
    expect(p).toBeDefined()
    expect(p.isOnline).toBe(false)
    expect(room.disconnectedPlayers.length).toBeGreaterThan(0)
  })

  it('pauses the game when a player disconnects during playing', () => {
    startGame(room)
    const origPhase = room.phase
    removePlayerFromRoom(room, 'p2')
    expect(room.phase).toBe(GAME_PHASES.PAUSED)
    expect(room.status).toBe('paused')
    expect(room.savedPhase).toBe(origPhase)
  })

  it('does nothing if player not found', () => {
    const before = room.players.length
    removePlayerFromRoom(room, 'nonexistent')
    expect(room.players).toHaveLength(before)
  })

  it('resets to WAITING when players < 4 after removal (assigning teams)', () => {
    room.status = GAME_PHASES.ASSIGNING_TEAMS
    room.phase = GAME_PHASES.ASSIGNING_TEAMS
    room.players.forEach(p => { p.team = p.order < 2 ? 'white' : 'black' })
    room.teams.white.players = room.players.filter(p => p.team === 'white').map(p => p.id)
    room.teams.black.players = room.players.filter(p => p.team === 'black').map(p => p.id)

    removePlayerFromRoom(room, 'p4')
    expect(room.status).toBe(GAME_PHASES.WAITING)
    expect(room.phase).toBe(GAME_PHASES.WAITING)
    room.players.forEach(p => {
      expect(p.team).toBeNull()
      expect(p.isEncryptor).toBe(false)
    })
  })
})

// ════════════════════════════════════════════════════════════
//  assignTeams
// ════════════════════════════════════════════════════════════
describe('assignTeams', () => {
  let room

  beforeEach(() => {
    room = createInitialRoom('host-id', 'Host', 'ABCD12')
    addPlayerToRoom(room, 'P2', 'p2')
    addPlayerToRoom(room, 'P3', 'p3')
    addPlayerToRoom(room, 'P4', 'p4')
  })

  it('assigns each player to a team', () => {
    assignTeams(room)
    room.players.forEach(p => {
      expect(['white', 'black']).toContain(p.team)
      expect(p.isEncryptor).toBe(false)
    })
  })

  it('splits players evenly (2 white, 2 black)', () => {
    assignTeams(room)
    const whitePlayers = room.players.filter(p => p.team === 'white')
    const blackPlayers = room.players.filter(p => p.team === 'black')
    expect(whitePlayers).toHaveLength(2)
    expect(blackPlayers).toHaveLength(2)
  })

  it('sets status to ASSIGNING_TEAMS', () => {
    assignTeams(room)
    expect(room.status).toBe(GAME_PHASES.ASSIGNING_TEAMS)
    expect(room.phase).toBe(GAME_PHASES.ASSIGNING_TEAMS)
  })

  it('populates team player lists', () => {
    assignTeams(room)
    expect(room.teams.white.players).toHaveLength(2)
    expect(room.teams.black.players).toHaveLength(2)
  })
})

// ════════════════════════════════════════════════════════════
//  startGame
// ════════════════════════════════════════════════════════════
describe('startGame', () => {
  let room

  beforeEach(() => {
    room = createInitialRoom('host-id', 'Host', 'ABCD12')
    addPlayerToRoom(room, 'P2', 'p2')
    addPlayerToRoom(room, 'P3', 'p3')
    addPlayerToRoom(room, 'P4', 'p4')
  })

  it('assigns teams if in WAITING', () => {
    const started = startGame(room)
    expect(started.players.every(p => p.team !== null)).toBe(true)
  })

  it('sets status to playing', () => {
    const started = startGame(room)
    expect(started.status).toBe('playing')
  })

  it('starts at round 1', () => {
    const started = startGame(room)
    expect(started.currentRound).toBe(1)
  })

  it('sets phase to ENCRYPTING', () => {
    const started = startGame(room)
    expect(started.phase).toBe(GAME_PHASES.ENCRYPTING)
  })

  it('generates 4 white and 4 black keywords', () => {
    const started = startGame(room)
    expect(started.whiteKeywords).toHaveLength(4)
    expect(started.blackKeywords).toHaveLength(4)
    started.whiteKeywords.forEach(k => {
      expect(k).toBeTypeOf('string')
      expect(k.length).toBeGreaterThan(0)
    })
  })

  it('generates a 3-digit code', () => {
    const started = startGame(room)
    expect(started.currentCode).toHaveLength(3)
    started.currentCode.forEach(n => {
      expect(n).toBeGreaterThanOrEqual(1)
      expect(n).toBeLessThanOrEqual(4)
    })
  })

  it('sets the first encryptor as black team index 0', () => {
    const started = startGame(room)
    expect(started.encryptorTeam).toBe('black')
    expect(started.encryptor).toBe(started.teams.black.players[0])
    const encryptor = started.players.find(p => p.id === started.encryptor)
    expect(encryptor.isEncryptor).toBe(true)
  })

  it('resets all voting state', () => {
    const started = startGame(room)
    expect(started.teamVotes.white.player1Guess).toBeNull()
    expect(started.teamVotes.white.player2Guess).toBeNull()
    expect(started.teamVotes.white.finalGuess).toBeNull()
    expect(started.teamVotes.black.player1Guess).toBeNull()
    expect(started.teamVotes.black.player2Guess).toBeNull()
    expect(started.teamVotes.black.finalGuess).toBeNull()
    expect(started.opponentGuess).toBeNull()
    expect(started.clues).toEqual([])
    expect(started.usedClues).toEqual([])
    expect(started.roundHistory).toEqual([])
    expect(started.winner).toBeNull()
  })

  it('resets token counts', () => {
    const started = startGame(room)
    expect(started.teams.white.interceptionTokens).toBe(0)
    expect(started.teams.white.miscommunicationTokens).toBe(0)
    expect(started.teams.black.interceptionTokens).toBe(0)
    expect(started.teams.black.miscommunicationTokens).toBe(0)
  })
})

// ════════════════════════════════════════════════════════════
//  submitClues
// ════════════════════════════════════════════════════════════
describe('submitClues', () => {
  let room

  beforeEach(() => {
    room = makeRoomWith4Players()
  })

  it('accepts valid clues from the encryptor', () => {
    const encryptorId = room.encryptor
    const result = submitClues(room, encryptorId, [safeClue('A'), safeClue('B'), safeClue('C')])
    expect(result.error).toBeUndefined()
    expect(result.room.clues).toEqual([safeClue('A'), safeClue('B'), safeClue('C')])
  })

  it('transitions phase to GUESSING after clue submission', () => {
    const encryptorId = room.encryptor
    const result = submitClues(room, encryptorId, [safeClue('A'), safeClue('B'), safeClue('C')])
    expect(result.room.phase).toBe(GAME_PHASES.GUESSING)
  })

  it('rejects non-encryptor submitting clues', () => {
    const nonEncryptor = room.players.find(p => !p.isEncryptor).id
    const result = submitClues(room, nonEncryptor, [safeClue('A'), safeClue('B'), safeClue('C')])
    expect(result.error).toBe('只有当前回合的情报官可以提交线索')
  })

  it('rejects wrong number of clues', () => {
    const encryptorId = room.encryptor
    const result = submitClues(room, encryptorId, [safeClue('A'), safeClue('B')])
    expect(result.error).toBe('需要提交3个线索')
  })

  it('rejects empty/whitespace-only clues', () => {
    const encryptorId = room.encryptor
    const result = submitClues(room, encryptorId, ['  ', '  ', '  '])
    expect(result.error).toBe('所有线索都必须是非空字符串')
  })

  it('rejects null/undefined clues array', () => {
    const encryptorId = room.encryptor
    expect(submitClues(room, encryptorId, null).error).toBeDefined()
    expect(submitClues(room, encryptorId, undefined).error).toBeDefined()
  })

  it('trims whitespace from clues', () => {
    const encryptorId = room.encryptor
    const result = submitClues(room, encryptorId, ['  v1  ', '  v2  ', '  v3  '])
    expect(result.error).toBeUndefined()
    expect(result.room.clues).toEqual(['v1', 'v2', 'v3'])
  })

  it('adds clues to usedClues list (lowercased)', () => {
    const encryptorId = room.encryptor
    submitClues(room, encryptorId, [safeClue('A'), safeClue('B'), safeClue('C')])
    expect(room.usedClues).toContain(safeClue('A').toLowerCase())
    expect(room.usedClues).toContain(safeClue('B').toLowerCase())
    expect(room.usedClues).toContain(safeClue('C').toLowerCase())
  })

  it('rejects re-used clues (case insensitive)', () => {
    const encryptorId = room.encryptor
    submitClues(room, encryptorId, [safeClue('Z1'), safeClue('Z2'), safeClue('Z3')])
    nextRound(room)
    const encryptorId2 = room.encryptor
    const result = submitClues(room, encryptorId2, [safeClue('Z1'), safeClue('z2'), safeClue('new')])
    expect(result.error).toContain('已被使用过')
  })

  it('rejects clues that match keywords', () => {
    const encryptorId = room.encryptor
    const keyword = room.whiteKeywords[0]
    const result = submitClues(room, encryptorId, [keyword, safeClue('X'), safeClue('Y')])
    expect(result.error).toContain('包含或被关键词包含')
  })

  it('rejects clues during paused state', () => {
    room.phase = GAME_PHASES.PAUSED
    room.status = 'paused'
    const encryptorId = room.encryptor
    const result = submitClues(room, encryptorId, [safeClue('A'), safeClue('B'), safeClue('C')])
    expect(result.error).toBe('游戏已暂停，等待断线玩家重连')
  })
})

// ════════════════════════════════════════════════════════════
//  submitTeamGuess
// ════════════════════════════════════════════════════════════
describe('submitTeamGuess', () => {
  let room

  beforeEach(() => {
    room = makeRoomWith4Players()
    const encryptorId = room.encryptor
    submitClues(room, encryptorId, [safeClue('A'), safeClue('B'), safeClue('C')])
  })

  it('rejects guesses when not in GUESSING phase', () => {
    room.phase = GAME_PHASES.WAITING
    const player = room.players.find(p => !p.isEncryptor)
    const result = submitTeamGuess(room, player.id, [1, 2, 3])
    expect(result.error).toBe('当前不是猜测阶段')
  })

  it('rejects guesses with wrong length', () => {
    const player = room.players.find(p => !p.isEncryptor)
    const result = submitTeamGuess(room, player.id, [1, 2])
    expect(result.error).toBe('需要提交3个数字')
  })

  it('rejects guesses with numbers out of range', () => {
    const player = room.players.find(p => !p.isEncryptor)
    expect(submitTeamGuess(room, player.id, [0, 1, 2]).error).toBe('每个数字必须在1-4之间')
    expect(submitTeamGuess(room, player.id, [1, 5, 2]).error).toBe('每个数字必须在1-4之间')
  })

  it('rejects encryptor from guessing', () => {
    const encryptorId = room.encryptor
    const result = submitTeamGuess(room, encryptorId, [1, 2, 3])
    expect(result.error).toBe('情报官不能提交猜测')
  })

  it('rejects duplicate guess from same player', () => {
    const encryptorTeam = room.encryptorTeam
    const nonEncryptorId = room.teams[encryptorTeam].players.find(id => id !== room.encryptor)
    submitTeamGuess(room, nonEncryptorId, [1, 2, 3])
    const result = submitTeamGuess(room, nonEncryptorId, [4, 3, 2])
    expect(result.error).toBe('你已经提交过猜测了')
  })

  it('rejects non-existent player', () => {
    const result = submitTeamGuess(room, 'fake-id', [1, 2, 3])
    expect(result.error).toBe('玩家不存在')
  })

  it('accepts valid guess from non-encryptor teammate (round 1: encryptor at index 0)', () => {
    const encryptorTeam = room.encryptorTeam
    const nonEncryptorId = room.teams[encryptorTeam].players.find(id => id !== room.encryptor)
    const voteKey = getNonEncryptorVoteKey(room)

    const result = submitTeamGuess(room, nonEncryptorId, [1, 2, 3])
    expect(result.error).toBeUndefined()
    expect(result.room.teamVotes[encryptorTeam][voteKey]).toEqual([1, 2, 3])
  })

  it('rejects guesses during paused state', () => {
    room.phase = GAME_PHASES.PAUSED
    room.status = 'paused'
    const player = room.players.find(p => !p.isEncryptor)
    const result = submitTeamGuess(room, player.id, [1, 2, 3])
    expect(result.error).toBe('游戏已暂停，等待断线玩家重连')
  })

  it('opponent submitting teamGuess writes to own team votes (not encryptor-teams)', () => {
    const opponentTeam = room.encryptorTeam === 'white' ? 'black' : 'white'
    const opponentId = room.teams[opponentTeam].players[0]
    const encryptorTeam = room.encryptorTeam
    const voteKey = getNonEncryptorVoteKey(room)

    const result = submitTeamGuess(room, opponentId, [4, 4, 4])
    expect(result.error).toBeUndefined()
    expect(result.room.teamVotes[opponentTeam].player1Guess).toEqual([4, 4, 4])
    expect(result.room.teamVotes[encryptorTeam][voteKey]).toBeNull()
  })
})

// ════════════════════════════════════════════════════════════
//  submitOpponentGuess
// ════════════════════════════════════════════════════════════
describe('submitOpponentGuess', () => {
  let room

  beforeEach(() => {
    room = makeRoomWith4Players()
    const encryptorId = room.encryptor
    submitClues(room, encryptorId, [safeClue('A'), safeClue('B'), safeClue('C')])
  })

  it('rejects when not in GUESSING/TEAM_VOTING phase', () => {
    room.phase = GAME_PHASES.WAITING
    const opponentTeam = room.encryptorTeam === 'white' ? 'black' : 'white'
    const opponentId = room.teams[opponentTeam].players[0]
    const result = submitOpponentGuess(room, opponentId, [1, 2, 3])
    expect(result.error).toBe('当前不是猜测阶段')
  })

  it('rejects encryptor team from submitting opponent guess', () => {
    const nonEncryptorId = room.teams[room.encryptorTeam].players.find(
      id => id !== room.encryptor
    )
    const result = submitOpponentGuess(room, nonEncryptorId, [1, 2, 3])
    expect(result.error).toBe('只有对方队可以拦截')
  })

  it('rejects duplicate opponent guess', () => {
    const opponentTeam = room.encryptorTeam === 'white' ? 'black' : 'white'
    const opponentId1 = room.teams[opponentTeam].players[0]
    const opponentId2 = room.teams[opponentTeam].players[1]
    submitOpponentGuess(room, opponentId1, [1, 2, 3])
    const result = submitOpponentGuess(room, opponentId2, [4, 3, 2])
    expect(result.error).toBe('拦截猜测已提交')
  })

  it('accepts valid opponent guess', () => {
    const opponentTeam = room.encryptorTeam === 'white' ? 'black' : 'white'
    const opponentId = room.teams[opponentTeam].players[0]
    const result = submitOpponentGuess(room, opponentId, [4, 3, 2])
    expect(result.error).toBeUndefined()
    expect(result.room.opponentGuess).toEqual([4, 3, 2])
  })

  it('validates guess format', () => {
    const opponentTeam = room.encryptorTeam === 'white' ? 'black' : 'white'
    const opponentId = room.teams[opponentTeam].players[0]
    expect(submitOpponentGuess(room, opponentId, [1, 2]).error).toBeDefined()
    expect(submitOpponentGuess(room, opponentId, [1, 2, 6]).error).toBe('每个数字必须在1-4之间')
  })

  it('rejects non-existent player', () => {
    const result = submitOpponentGuess(room, 'fake-id', [1, 2, 3])
    expect(result.error).toBe('玩家不存在')
  })
})

// ════════════════════════════════════════════════════════════
//  submitTeamFinalVote
// ════════════════════════════════════════════════════════════
describe('submitTeamFinalVote', () => {
  let room

  beforeEach(() => {
    room = makeRoomWith4Players()
    const encryptorId = room.encryptor
    submitClues(room, encryptorId, [safeClue('A'), safeClue('B'), safeClue('C')])
  })

  it('rejects when not in GUESSING or TEAM_VOTING phase', () => {
    room.phase = GAME_PHASES.WAITING
    const encryptorTeam = room.encryptorTeam
    const nonEncryptorId = room.teams[encryptorTeam].players.find(id => id !== room.encryptor)
    const result = submitTeamFinalVote(room, nonEncryptorId, [1, 2, 3])
    expect(result.error).toBe('当前不是投票阶段')
  })

  it('rejects if final guess already agreed (manually set finalGuess)', () => {
    const encryptorTeam = room.encryptorTeam
    room.teamVotes[encryptorTeam].finalGuess = [1, 2, 3]
    const nonEncryptorId = room.teams[encryptorTeam].players.find(id => id !== room.encryptor)
    const result = submitTeamFinalVote(room, nonEncryptorId, [4, 3, 2])
    expect(result.error).toBe('队伍已经达成一致')
  })

  it('accepts final vote when team has not agreed yet', () => {
    const encryptorTeam = room.encryptorTeam
    const nonEncryptorId = room.teams[encryptorTeam].players.find(id => id !== room.encryptor)

    const voteKey = getNonEncryptorVoteKey(room)
    submitTeamGuess(room, nonEncryptorId, [1, 2, 3])
    expect(room.teamVotes[encryptorTeam][voteKey]).toEqual([1, 2, 3])
    expect(room.teamVotes[encryptorTeam].finalGuess).toBeNull()

    const result = submitTeamFinalVote(room, nonEncryptorId, [2, 2, 2])
    expect(result.error).toBeUndefined()
    expect(room.teamVotes[encryptorTeam].finalGuess).toEqual([2, 2, 2])
  })

  it('validates guess format', () => {
    const encryptorTeam = room.encryptorTeam
    const nonEncryptorId = room.teams[encryptorTeam].players.find(id => id !== room.encryptor)
    expect(submitTeamFinalVote(room, nonEncryptorId, [1, 2]).error).toBeDefined()
    expect(submitTeamFinalVote(room, nonEncryptorId, [1, 2, 6]).error).toBeDefined()
  })

  it('opponent voting writes to their own team final guess (not encryptors)', () => {
    const encryptorTeam = room.encryptorTeam
    const opponentTeam = encryptorTeam === 'white' ? 'black' : 'white'
    const opponentId = room.teams[opponentTeam].players[0]

    const result = submitTeamFinalVote(room, opponentId, [3, 3, 3])
    expect(result.error).toBeUndefined()
    expect(result.room.teamVotes[opponentTeam].finalGuess).toEqual([3, 3, 3])
    expect(result.room.teamVotes[encryptorTeam].finalGuess).toBeNull()
  })
})

// ════════════════════════════════════════════════════════════
//  checkNeedTeamVoting
// ════════════════════════════════════════════════════════════
describe('checkNeedTeamVoting', () => {
  it('returns false when no guesses submitted', () => {
    const room = makeRoomWith4Players()
    expect(checkNeedTeamVoting(room)).toBe(false)
  })

  it('returns false when only one guess submitted', () => {
    const room = makeRoomWith4Players()
    const encryptorId = room.encryptor
    submitClues(room, encryptorId, [safeClue('A'), safeClue('B'), safeClue('C')])
    const encryptorTeam = room.encryptorTeam
    const nonEncryptorId = room.teams[encryptorTeam].players.find(id => id !== room.encryptor)
    submitTeamGuess(room, nonEncryptorId, [1, 2, 3])
    expect(checkNeedTeamVoting(room)).toBe(false)
  })

  it('returns true when both player1Guess and player2Guess are set, finalGuess null', () => {
    const room = makeRoomWith4Players()
    const encryptorId = room.encryptor
    submitClues(room, encryptorId, [safeClue('A'), safeClue('B'), safeClue('C')])
    const encryptorTeam = room.encryptorTeam
    room.teamVotes[encryptorTeam].player1Guess = [1, 2, 3]
    room.teamVotes[encryptorTeam].player2Guess = [4, 3, 2]
    room.teamVotes[encryptorTeam].finalGuess = null
    expect(checkNeedTeamVoting(room)).toBe(true)
  })

  it('returns false when both submitted same (finalGuess auto-set)', () => {
    const room = makeRoomWith4Players()
    const encryptorId = room.encryptor
    submitClues(room, encryptorId, [safeClue('A'), safeClue('B'), safeClue('C')])
    const encryptorTeam = room.encryptorTeam
    room.teamVotes[encryptorTeam].player1Guess = [1, 2, 3]
    room.teamVotes[encryptorTeam].player2Guess = [1, 2, 3]
    room.teamVotes[encryptorTeam].finalGuess = [1, 2, 3]
    expect(checkNeedTeamVoting(room)).toBe(false)
  })
})

// ════════════════════════════════════════════════════════════
//  processRound
// ════════════════════════════════════════════════════════════
describe('processRound', () => {
  let room

  beforeEach(() => {
    room = makeRoomWith4Players()
  })

  it('transitions to RESULT phase', () => {
    const encryptorTeam = room.encryptorTeam
    const encryptorId = room.encryptor
    submitClues(room, encryptorId, [safeClue('A'), safeClue('B'), safeClue('C')])
    room.currentCode = [1, 2, 3]
    room.teamVotes[encryptorTeam].finalGuess = [1, 2, 3]
    room.opponentGuess = [4, 4, 4]
    processRound(room)
    expect(room.phase).toBe(GAME_PHASES.RESULT)
  })

  it('adds to roundHistory', () => {
    const encryptorTeam = room.encryptorTeam
    const encryptorId = room.encryptor
    submitClues(room, encryptorId, [safeClue('A'), safeClue('B'), safeClue('C')])
    room.currentCode = [1, 2, 3]
    room.teamVotes[encryptorTeam].finalGuess = [1, 2, 3]
    room.opponentGuess = [4, 4, 4]
    processRound(room)
    expect(room.roundHistory).toHaveLength(1)
    expect(room.roundHistory[0].round).toBe(1)
  })

  it('records correct code in round result', () => {
    const encryptorTeam = room.encryptorTeam
    const encryptorId = room.encryptor
    submitClues(room, encryptorId, [safeClue('A'), safeClue('B'), safeClue('C')])
    room.currentCode = [3, 2, 1]
    room.teamVotes[encryptorTeam].finalGuess = [3, 2, 1]
    room.opponentGuess = [3, 2, 1]
    processRound(room)
    expect(room.roundResult.correctCode).toEqual([3, 2, 1])
  })

  it('records teammate and opponent guesses in result', () => {
    const encryptorTeam = room.encryptorTeam
    const encryptorId = room.encryptor
    submitClues(room, encryptorId, [safeClue('A'), safeClue('B'), safeClue('C')])
    room.currentCode = [1, 1, 1]
    room.teamVotes[encryptorTeam].finalGuess = [2, 2, 2]
    room.opponentGuess = [3, 3, 3]
    processRound(room)
    expect(room.roundResult.teammateGuess).toEqual([2, 2, 2])
    expect(room.roundResult.opponentGuess).toEqual([3, 3, 3])
  })

  it('both correct → interception token for intercept team', () => {
    const encryptorTeam = room.encryptorTeam
    const interceptTeam = encryptorTeam === 'white' ? 'black' : 'white'
    const encryptorId = room.encryptor
    submitClues(room, encryptorId, [safeClue('A'), safeClue('B'), safeClue('C')])
    room.currentCode = [1, 2, 3]
    room.teamVotes[encryptorTeam].finalGuess = [1, 2, 3]
    room.opponentGuess = [1, 2, 3]
    processRound(room)
    expect(room.teams[interceptTeam].interceptionTokens).toBe(1)
    expect(room.roundResult.teammateCorrect).toBe(true)
    expect(room.roundResult.opponentCorrect).toBe(true)
  })

  it('teammate correct, opponent wrong → no tokens', () => {
    const encryptorTeam = room.encryptorTeam
    const interceptTeam = encryptorTeam === 'white' ? 'black' : 'white'
    const encryptorId = room.encryptor
    submitClues(room, encryptorId, [safeClue('A'), safeClue('B'), safeClue('C')])
    room.currentCode = [1, 2, 3]
    room.teamVotes[encryptorTeam].finalGuess = [1, 2, 3]
    room.opponentGuess = [4, 4, 4]
    processRound(room)
    expect(room.roundResult.teammateCorrect).toBe(true)
    expect(room.roundResult.opponentCorrect).toBe(false)
    expect(room.teams[encryptorTeam].miscommunicationTokens).toBe(0)
    expect(room.teams[interceptTeam].interceptionTokens).toBe(0)
  })

  it('teammate wrong, opponent correct → interception + miscommunication', () => {
    const encryptorTeam = room.encryptorTeam
    const interceptTeam = encryptorTeam === 'white' ? 'black' : 'white'
    const encryptorId = room.encryptor
    submitClues(room, encryptorId, [safeClue('A'), safeClue('B'), safeClue('C')])
    room.currentCode = [1, 2, 3]
    room.teamVotes[encryptorTeam].finalGuess = [4, 4, 4]
    room.opponentGuess = [1, 2, 3]
    processRound(room)
    expect(room.teams[interceptTeam].interceptionTokens).toBe(1)
    expect(room.teams[encryptorTeam].miscommunicationTokens).toBe(1)
  })

  it('both wrong → miscommunication token for encryptor team', () => {
    const encryptorTeam = room.encryptorTeam
    const encryptorId = room.encryptor
    submitClues(room, encryptorId, [safeClue('A'), safeClue('B'), safeClue('C')])
    room.currentCode = [1, 2, 3]
    room.teamVotes[encryptorTeam].finalGuess = [4, 4, 4]
    room.opponentGuess = [2, 3, 4]
    processRound(room)
    expect(room.teams[encryptorTeam].miscommunicationTokens).toBe(1)
    expect(room.roundResult.teammateCorrect).toBe(false)
    expect(room.roundResult.opponentCorrect).toBe(false)
  })

  it('records notes for both teams', () => {
    const encryptorTeam = room.encryptorTeam
    const interceptTeam = encryptorTeam === 'white' ? 'black' : 'white'
    const encryptorId = room.encryptor
    submitClues(room, encryptorId, [safeClue('A'), safeClue('B'), safeClue('C')])
    room.currentCode = [1, 2, 3]
    room.teamVotes[encryptorTeam].finalGuess = [1, 2, 3]
    room.opponentGuess = [4, 4, 4]
    processRound(room)
    expect(room.notes[encryptorTeam]).toHaveLength(1)
    expect(room.notes[interceptTeam]).toHaveLength(1)
  })

  it('deep-clones values so history is unaffected by mutation', () => {
    const encryptorTeam = room.encryptorTeam
    const encryptorId = room.encryptor
    submitClues(room, encryptorId, [safeClue('A'), safeClue('B'), safeClue('C')])
    room.currentCode = [1, 2, 3]
    room.teamVotes[encryptorTeam].finalGuess = [1, 2, 3]
    room.opponentGuess = [4, 4, 4]
    processRound(room)
    const originalCode = room.roundHistory[0].correctCode
    room.currentCode[0] = 99
    expect(originalCode).toEqual([1, 2, 3])
  })

  it('deep-clones guesses in round result', () => {
    const encryptorTeam = room.encryptorTeam
    const encryptorId = room.encryptor
    submitClues(room, encryptorId, [safeClue('A'), safeClue('B'), safeClue('C')])
    const tGuess = [1, 2, 3]
    const oGuess = [4, 3, 2]
    room.currentCode = [1, 2, 3]
    room.teamVotes[encryptorTeam].finalGuess = [...tGuess]
    room.opponentGuess = [...oGuess]
    processRound(room)
    tGuess[0] = 99
    oGuess[0] = 99
    expect(room.roundResult.teammateGuess).toEqual([1, 2, 3])
    expect(room.roundResult.opponentGuess).toEqual([4, 3, 2])
  })
})

// ════════════════════════════════════════════════════════════
//  checkWinCondition
// ════════════════════════════════════════════════════════════
describe('checkWinCondition', () => {
  let room

  beforeEach(() => {
    room = makeRoomWith4Players()
  })

  it('white wins with 2 interceptions', () => {
    room.teams.white.interceptionTokens = 2
    const result = checkWinCondition(room)
    expect(result.winner).toBe('white')
    expect(result.status).toBe(GAME_PHASES.ENDED)
  })

  it('black wins with 2 interceptions', () => {
    room.teams.black.interceptionTokens = 2
    const result = checkWinCondition(room)
    expect(result.winner).toBe('black')
    expect(result.status).toBe(GAME_PHASES.ENDED)
  })

  it('black wins when white has 2 miscommunications', () => {
    room.teams.white.miscommunicationTokens = 2
    const result = checkWinCondition(room)
    expect(result.winner).toBe('black')
    expect(result.status).toBe(GAME_PHASES.ENDED)
  })

  it('white wins when black has 2 miscommunications', () => {
    room.teams.black.miscommunicationTokens = 2
    const result = checkWinCondition(room)
    expect(result.winner).toBe('white')
    expect(result.status).toBe(GAME_PHASES.ENDED)
  })

  it('no winner with tokens < 2', () => {
    room.teams.white.interceptionTokens = 1
    room.teams.black.interceptionTokens = 1
    const result = checkWinCondition(room)
    expect(result.winner).toBeNull()
    expect(result.status).not.toBe(GAME_PHASES.ENDED)
  })

  it('appends win message to roundResult when provided', () => {
    room.teams.white.interceptionTokens = 2
    const roundResult = { message: 'test' }
    checkWinCondition(room, roundResult)
    expect(roundResult.message).toContain('白队获得胜利')
  })
})

// ════════════════════════════════════════════════════════════
//  nextRound
// ════════════════════════════════════════════════════════════
describe('nextRound', () => {
  let room

  beforeEach(() => {
    room = makeRoomWith4Players()
  })

  it('advances round number', () => {
    const prevRound = room.currentRound
    nextRound(room)
    expect(room.currentRound).toBe(prevRound + 1)
  })

  it('rotates encryptor (black-A → white-A)', () => {
    expect(room.encryptorTeam).toBe('black')
    const firstEncryptor = room.encryptor
    nextRound(room)
    expect(room.encryptorTeam).toBe('white')
    expect(room.encryptor).not.toBe(firstEncryptor)
  })

  it('resets clues and voting state', () => {
    nextRound(room)
    expect(room.clues).toEqual([])
    expect(room.opponentGuess).toBeNull()
    expect(room.teamVotes.white.player1Guess).toBeNull()
    expect(room.teamVotes.white.player2Guess).toBeNull()
    expect(room.teamVotes.white.finalGuess).toBeNull()
    expect(room.teamVotes.black.player1Guess).toBeNull()
    expect(room.teamVotes.black.player2Guess).toBeNull()
    expect(room.teamVotes.black.finalGuess).toBeNull()
    expect(room.roundResult).toBeNull()
  })

  it('generates a new code', () => {
    nextRound(room)
    expect(room.currentCode).toHaveLength(3)
  })

  it('returns to ENCRYPTING phase', () => {
    nextRound(room)
    expect(room.phase).toBe(GAME_PHASES.ENCRYPTING)
  })

  it('updates encryptor role on players', () => {
    nextRound(room)
    const newEncryptor = room.players.find(p => p.id === room.encryptor)
    expect(newEncryptor.isEncryptor).toBe(true)
    room.players.filter(p => p.id !== room.encryptor).forEach(p => {
      expect(p.isEncryptor).toBe(false)
    })
  })

  it('cycles through all 4 rotation positions', () => {
    const rotations = []
    for (let i = 0; i < 4; i++) {
      rotations.push({ team: room.encryptorTeam, id: room.encryptor })
      nextRound(room)
    }
    expect(room.encryptorTeam).toBe(rotations[0].team)
    expect(room.encryptor).toBe(rotations[0].id)
  })
})

// ════════════════════════════════════════════════════════════
//  resetGame
// ════════════════════════════════════════════════════════════
describe('resetGame', () => {
  let room

  beforeEach(() => {
    room = makeRoomWith4Players()
    const encryptorId = room.encryptor
    submitClues(room, encryptorId, [safeClue('A'), safeClue('B'), safeClue('C')])
  })

  it('resets currentRound to 1', () => {
    resetGame(room)
    expect(room.currentRound).toBe(1)
  })

  it('resets phase to ENCRYPTING', () => {
    resetGame(room)
    expect(room.phase).toBe(GAME_PHASES.ENCRYPTING)
    expect(room.status).toBe('playing')
  })

  it('resets token counts to 0', () => {
    room.teams.white.interceptionTokens = 5
    room.teams.black.miscommunicationTokens = 3
    resetGame(room)
    expect(room.teams.white.interceptionTokens).toBe(0)
    expect(room.teams.black.miscommunicationTokens).toBe(0)
  })

  it('generates new keywords', () => {
    resetGame(room)
    expect(room.whiteKeywords).toHaveLength(4)
    expect(room.blackKeywords).toHaveLength(4)
  })

  it('resets encryptor to first rotation (black-A)', () => {
    nextRound(room)
    nextRound(room)
    resetGame(room)
    expect(room.rotationIndex).toBe(0)
    expect(room.encryptorTeam).toBe('black')
  })

  it('clears round history and notes', () => {
    const encryptorTeam = room.encryptorTeam
    room.currentCode = [1, 2, 3]
    room.teamVotes[encryptorTeam].finalGuess = [1, 2, 3]
    room.opponentGuess = [4, 4, 4]
    processRound(room)
    resetGame(room)
    expect(room.roundHistory).toEqual([])
    expect(room.notes.white).toEqual([])
    expect(room.notes.black).toEqual([])
    expect(room.winner).toBeNull()
    expect(room.roundResult).toBeNull()
  })

  it('clears disconnected players and saved state', () => {
    room.disconnectedPlayers = [{ id: 'p1', name: 'X' }]
    room.savedPhase = 'test'
    room.savedEncryptor = 'test-id'
    resetGame(room)
    expect(room.disconnectedPlayers).toEqual([])
    expect(room.savedPhase).toBeNull()
    expect(room.savedEncryptor).toBeNull()
  })

  it('resets usedClues', () => {
    resetGame(room)
    expect(room.usedClues).toEqual([])
  })
})

// ════════════════════════════════════════════════════════════
//  getCurrentEncryptorInfo / getNextEncryptorInfo
// ════════════════════════════════════════════════════════════
describe('getCurrentEncryptorInfo', () => {
  let room

  beforeEach(() => {
    room = makeRoomWith4Players()
  })

  it('returns current encryptor info', () => {
    const info = getCurrentEncryptorInfo(room)
    expect(info.id).toBe(room.encryptor)
    expect(info.team).toBe(room.encryptorTeam)
    expect(typeof info.name).toBe('string')
    expect(typeof info.teamName).toBe('string')
  })

  it('returns teamName as 白队 or 黑队', () => {
    const info = getCurrentEncryptorInfo(room)
    expect(['白队', '黑队']).toContain(info.teamName)
  })

  it('handles missing encryptor player gracefully', () => {
    room.encryptor = 'nonexistent'
    const info = getCurrentEncryptorInfo(room)
    expect(info.id).toBe('nonexistent')
    expect(info.name).toBe('未知')
  })
})

describe('getNextEncryptorInfo', () => {
  let room

  beforeEach(() => {
    room = makeRoomWith4Players()
  })

  it('returns next encryptor in rotation', () => {
    const current = getCurrentEncryptorInfo(room)
    const next = getNextEncryptorInfo(room)
    expect(next.id).not.toBe(current.id)
    expect(next.id).toBeDefined()
    expect(typeof next.name).toBe('string')
  })

  it('next encryptor after black-A is white-A', () => {
    const next = getNextEncryptorInfo(room)
    expect(next.team).toBe('white')
  })
})

// ════════════════════════════════════════════════════════════
//  getOnlinePlayerCount / getDisconnectedPlayers
// ════════════════════════════════════════════════════════════
describe('online players', () => {
  let room

  beforeEach(() => {
    room = makeRoomWith4Players()
  })

  it('getOnlinePlayerCount returns 4 when all online', () => {
    expect(getOnlinePlayerCount(room)).toBe(4)
  })

  it('getDisconnectedPlayers returns empty when all online', () => {
    expect(getDisconnectedPlayers(room)).toEqual([])
  })

  it('counts offline players correctly', () => {
    room.players[0].isOnline = false
    room.players[2].isOnline = false
    expect(getOnlinePlayerCount(room)).toBe(2)
    expect(getDisconnectedPlayers(room)).toHaveLength(2)
  })
})

// ════════════════════════════════════════════════════════════
//  resumeGame / canResumeGame
// ════════════════════════════════════════════════════════════
describe('resumeGame', () => {
  let room

  beforeEach(() => {
    room = makeRoomWith4Players()
    room.players[0].isOnline = false
    room.phase = GAME_PHASES.PAUSED
    room.status = 'paused'
    room.savedPhase = GAME_PHASES.ENCRYPTING
    room.savedEncryptor = room.encryptor
    room.disconnectedPlayers = [{ id: room.players[0].id, name: room.players[0].name }]
  })

  it('does not resume when players are still offline', () => {
    const result = resumeGame(room)
    expect(result.phase).toBe(GAME_PHASES.PAUSED)
  })

  it('resumes when all players are back online', () => {
    room.players[0].isOnline = true
    room.disconnectedPlayers = []
    const result = resumeGame(room)
    expect(result.phase).toBe(GAME_PHASES.ENCRYPTING)
    expect(result.status).toBe('playing')
    expect(result.savedPhase).toBeNull()
    expect(result.savedEncryptor).toBeNull()
  })

  it('canResumeGame returns false when paused with offline players', () => {
    expect(canResumeGame(room)).toBe(false)
  })

  it('canResumeGame returns true when all online and paused', () => {
    room.players[0].isOnline = true
    expect(canResumeGame(room)).toBe(true)
  })

  it('canResumeGame returns false when not in PAUSED phase', () => {
    room.phase = GAME_PHASES.ENCRYPTING
    room.players[0].isOnline = true
    expect(canResumeGame(room)).toBe(false)
  })

  it('no-op when not paused', () => {
    room.phase = GAME_PHASES.ENCRYPTING
    room.players[0].isOnline = true
    const result = resumeGame(room)
    expect(result.phase).toBe(GAME_PHASES.ENCRYPTING)
  })
})

// ════════════════════════════════════════════════════════════
//  Edge cases – full game flows
// ════════════════════════════════════════════════════════════
describe('edge cases', () => {
  it('full flow: clues → team guess → final vote → opponent → round resolves', () => {
    const room = makeRoomWith4Players()
    expect(room.status).toBe('playing')
    expect(room.phase).toBe(GAME_PHASES.ENCRYPTING)

    const encryptorId = room.encryptor
    submitClues(room, encryptorId, [safeClue('E0'), safeClue('E1'), safeClue('E2')])
    expect(room.phase).toBe(GAME_PHASES.GUESSING)

    const encryptorTeam = room.encryptorTeam
    const interceptTeam = encryptorTeam === 'white' ? 'black' : 'white'
    const nonEncryptorId = room.teams[encryptorTeam].players.find(id => id !== room.encryptor)
    const opponentId = room.teams[interceptTeam].players[0]

    room.currentCode = [1, 2, 3]

    const voteKey = getNonEncryptorVoteKey(room)
    submitTeamGuess(room, nonEncryptorId, [1, 2, 3])
    expect(room.teamVotes[encryptorTeam][voteKey]).toEqual([1, 2, 3])
    expect(room.teamVotes[encryptorTeam].finalGuess).toBeNull()

    submitTeamFinalVote(room, nonEncryptorId, [1, 2, 3])
    expect(room.teamVotes[encryptorTeam].finalGuess).toEqual([1, 2, 3])

    submitOpponentGuess(room, opponentId, [4, 4, 4])

    expect(room.phase).toBe(GAME_PHASES.RESULT)
    expect(room.roundResult.teammateCorrect).toBe(true)
    expect(room.roundResult.opponentCorrect).toBe(false)
  })

  it('reconnecting player preserves game state', () => {
    const room = makeRoomWith4Players()
    const encryptorId = room.encryptor
    submitClues(room, encryptorId, [safeClue('R0'), safeClue('R1'), safeClue('R2')])

    room.players[0].isOnline = false
    room.disconnectedPlayers = [{ id: room.players[0].id, name: room.players[0].name }]
    room.phase = GAME_PHASES.PAUSED
    room.status = 'paused'
    room.savedPhase = GAME_PHASES.GUESSING

    room.players[0].isOnline = true
    room.disconnectedPlayers = []
    resumeGame(room)

    expect(room.phase).toBe(GAME_PHASES.GUESSING)
    expect(room.status).toBe('playing')
    expect(room.disconnectedPlayers).toEqual([])
  })

  it('rotation cycles fully after 4 rounds', () => {
    const room = makeRoomWith4Players()
    const firstEncryptorId = room.encryptor
    const firstTeam = room.encryptorTeam

    nextRound(room)
    nextRound(room)
    nextRound(room)
    nextRound(room)

    expect(room.rotationIndex).toBe(0)
    expect(room.encryptor).toBe(firstEncryptorId)
    expect(room.encryptorTeam).toBe(firstTeam)
  })

  it('empty room removal does nothing', () => {
    const room = createInitialRoom('h1', 'Host', 'EMPTY')
    removePlayerFromRoom(room, 'h1')
    expect(room.players).toHaveLength(0)
  })

  it('keyword clash detection works across both keyword sets', () => {
    const room = makeRoomWith4Players()
    const encryptorId = room.encryptor
    const blackKeyword = room.blackKeywords[0]
    const result = submitClues(room, encryptorId, [blackKeyword, safeClue('X'), safeClue('Y')])
    expect(result.error).toContain('包含或被关键词包含')
  })

  it('both wrong scenario in full flow', () => {
    const room = makeRoomWith4Players()
    const encryptorTeam = room.encryptorTeam
    const encryptorId = room.encryptor
    submitClues(room, encryptorId, [safeClue('W0'), safeClue('W1'), safeClue('W2')])
    room.currentCode = [1, 1, 1]
    room.teamVotes[encryptorTeam].finalGuess = [2, 2, 2]
    room.opponentGuess = [3, 3, 3]
    processRound(room)
    expect(room.phase).toBe(GAME_PHASES.RESULT)
    expect(room.teams[encryptorTeam].miscommunicationTokens).toBe(1)
  })
})
