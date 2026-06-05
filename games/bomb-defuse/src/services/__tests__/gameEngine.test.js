import { describe, expect, it } from 'vitest'
import {
  DEFAULT_DIFFICULTY,
  GAME_PHASES,
  addPlayerToRoom,
  checkEndCondition,
  createInitialRoom,
  getPlayerRole,
  recordStrike,
  removePlayerFromRoom,
  restartGame,
  setRoomDifficulty,
  startGame,
  submitModuleAction
} from '../gameEngine'

function createTwoPlayerRoom() {
  const room = createInitialRoom('p1', 'Host', 'ABCD')
  addPlayerToRoom(room, 'Guest', 'p2')
  return room
}

describe('bomb defuse game engine', () => {
  it('creates a waiting room with one host player', () => {
    const room = createInitialRoom('p1', 'Host', 'ABCD')

    expect(room.code).toBe('ABCD')
    expect(room.hostId).toBe('p1')
    expect(room.phase).toBe(GAME_PHASES.WAITING)
    expect(room.players).toEqual([
      expect.objectContaining({
        id: 'p1',
        name: 'Host',
        isHost: true,
        isOnline: true,
        role: null
      })
    ])
  })

  it('allows one guest to join the room', () => {
    const room = createInitialRoom('p1', 'Host', 'ABCD')
    const result = addPlayerToRoom(room, 'Guest', 'p2')

    expect(result.error).toBeUndefined()
    expect(room.players).toHaveLength(2)
    expect(room.players[1]).toEqual(expect.objectContaining({
      id: 'p2',
      name: 'Guest',
      isHost: false,
      isOnline: true
    }))
  })

  it('reconnects an existing player id without adding a duplicate slot', () => {
    const room = createTwoPlayerRoom()
    startGame(room, { seed: 'reconnect-test' })
    const roleBeforeDisconnect = getPlayerRole(room, 'p2')

    removePlayerFromRoom(room, 'p2')
    const result = addPlayerToRoom(room, 'Guest Again', 'p2')

    expect(result.error).toBeUndefined()
    expect(result.reconnected).toBe(true)
    expect(room.players).toHaveLength(2)
    expect(room.players[1]).toEqual(expect.objectContaining({
      id: 'p2',
      name: 'Guest Again',
      isOnline: true,
      role: roleBeforeDisconnect
    }))
  })

  it('rejects a third player', () => {
    const room = createTwoPlayerRoom()
    const result = addPlayerToRoom(room, 'Third', 'p3')

    expect(result.error).toBe('房间已满，需要刚好 2 名玩家')
    expect(room.players).toHaveLength(2)
  })

  it('cannot start with fewer than two online players', () => {
    const room = createInitialRoom('p1', 'Host', 'ABCD')
    const result = startGame(room)

    expect(result.error).toBe('需要 2 名在线玩家才能开始拆弹')
    expect(room.phase).toBe(GAME_PHASES.WAITING)
  })

  it('starts with two players, assigns different roles, and creates four modules', () => {
    const room = createTwoPlayerRoom()
    const result = startGame(room, { seed: 'test-seed', now: 1000, durationMs: 120000 })

    expect(result.error).toBeUndefined()
    expect(room.phase).toBe(GAME_PHASES.PLAYING)
    expect(room.status).toBe(GAME_PHASES.PLAYING)
    expect(room.players.map(player => player.role).sort()).toEqual(['defuser', 'expert'])
    expect(getPlayerRole(room, 'p1')).not.toBe(getPlayerRole(room, 'p2'))
    expect(room.gameState.seed).toBe('test-seed')
    expect(room.gameState.startedAt).toBe(1000)
    expect(room.gameState.deadlineAt).toBe(121000)
    expect(room.gameState.modules).toHaveLength(4)
  })

  it('adds a strike for a wrong module action', () => {
    const room = createTwoPlayerRoom()
    startGame(room, { seed: 'test-seed' })

    const result = submitModuleAction(room, 'p1', 'wires-1', {
      type: 'cut_wire',
      wireId: 'wrong-wire'
    })

    expect(result.correct).toBe(false)
    expect(room.gameState.strikes).toHaveLength(1)
    expect(room.phase).toBe(GAME_PHASES.PLAYING)
  })

  it('explodes after three strikes', () => {
    const room = createTwoPlayerRoom()
    startGame(room, { seed: 'test-seed' })

    recordStrike(room, 'p1', 'wires-1', { type: 'cut_wire', wireId: 'wrong-1' })
    recordStrike(room, 'p1', 'symbols-1', { type: 'press_symbol', symbolId: 'wrong-2' })
    recordStrike(room, 'p1', 'keypad-1', { type: 'press_key', keyId: 'wrong-3' })

    expect(room.gameState.strikes).toHaveLength(3)
    expect(room.phase).toBe(GAME_PHASES.EXPLODED)
    expect(room.status).toBe(GAME_PHASES.EXPLODED)
    expect(room.gameState.result).toBe('exploded')
  })

  it('solves the game when all modules are solved', () => {
    const room = createTwoPlayerRoom()
    startGame(room, { seed: 'test-seed' })

    for (const module of room.gameState.modules) {
      const result = submitModuleAction(room, 'p1', module.id, module.solution.action)
      expect(result.correct).toBe(true)
    }

    expect(room.gameState.solvedModuleIds).toEqual(['wires-1', 'symbols-1', 'keypad-1', 'password-1'])
    expect(room.phase).toBe(GAME_PHASES.SOLVED)
    expect(room.status).toBe(GAME_PHASES.SOLVED)
    expect(room.gameState.result).toBe('solved')
  })

  it('advances a maze on a valid step and strikes on a wall', () => {
    const room = createTwoPlayerRoom()
    startGame(room, { seed: 'maze-engine', moduleTypes: ['maze'] })
    const maze = room.gameState.modules[0]
    const start = maze.bombView.position
    const startCell = maze.solution.cells[start.y][start.x]
    const directions = ['up', 'down', 'left', 'right']

    const wallDir = directions.find(dir => !startCell[dir])
    if (wallDir) {
      const blocked = submitModuleAction(room, 'p1', maze.id, { type: 'move', direction: wallDir })
      expect(blocked.correct).toBe(false)
      expect(room.gameState.strikes).toHaveLength(1)
    }

    const openDir = directions.find(dir => startCell[dir])
    const moved = submitModuleAction(room, 'p1', maze.id, { type: 'move', direction: openDir })
    expect(moved.correct).toBe(true)
    expect(maze.bombView.position).not.toEqual(start)
  })

  it('explodes when the timer expires', () => {
    const room = createTwoPlayerRoom()
    startGame(room, { seed: 'timer-test', now: 1000, durationMs: 3000 })

    checkEndCondition(room, 4000)

    expect(room.phase).toBe(GAME_PHASES.EXPLODED)
    expect(room.status).toBe(GAME_PHASES.EXPLODED)
    expect(room.gameState.result).toBe('exploded')
    expect(room.gameState.endedAt).toBe(4000)
  })

  it('solves before the timer expires', () => {
    const room = createTwoPlayerRoom()
    startGame(room, { seed: 'solve-before-expiry', now: Date.now(), durationMs: 60000 })

    for (const module of room.gameState.modules) {
      const result = submitModuleAction(room, 'p1', module.id, module.solution.action)
      expect(result.error).toBeUndefined()
    }

    expect(room.phase).toBe(GAME_PHASES.SOLVED)
    expect(room.gameState.result).toBe('solved')
  })

  it('rejects module actions after the game has ended', () => {
    const room = createTwoPlayerRoom()
    startGame(room, { seed: 'ended-test' })
    checkEndCondition(room, room.gameState.deadlineAt)

    const result = submitModuleAction(room, 'p1', 'wires-1', room.gameState.modules[0].solution.action)

    expect(result.error).toBe('当前任务不接受操作')
    expect(room.gameState.actionLog).toEqual([])
  })

  it('resets active game data on restart', () => {
    const room = createTwoPlayerRoom()
    startGame(room, { seed: 'test-seed' })
    recordStrike(room, 'p1', 'wires-1', { type: 'cut_wire', wireId: 'wrong-wire' })

    restartGame(room)

    expect(room.phase).toBe(GAME_PHASES.WAITING)
    expect(room.players.every(player => player.role === null)).toBe(true)
    expect(room.gameState.strikes).toEqual([])
    expect(room.gameState.modules).toEqual([])
  })
})

describe('bomb defuse difficulty', () => {
  it('defaults a new room to the standard difficulty', () => {
    const room = createInitialRoom('p1', 'Host', 'ABCD')
    expect(room.settings.difficulty).toBe(DEFAULT_DIFFICULTY)
  })

  it('lets the host change difficulty while waiting', () => {
    const room = createTwoPlayerRoom()
    const result = setRoomDifficulty(room, 'rookie')

    expect(result.error).toBeUndefined()
    expect(room.settings.difficulty).toBe('rookie')
  })

  it('rejects an unknown difficulty', () => {
    const room = createTwoPlayerRoom()
    const result = setRoomDifficulty(room, 'nightmare')

    expect(result.error).toBe('未知难度')
    expect(room.settings.difficulty).toBe(DEFAULT_DIFFICULTY)
  })

  it('rejects difficulty changes once the game is playing', () => {
    const room = createTwoPlayerRoom()
    startGame(room, { seed: 'difficulty-lock' })
    const result = setRoomDifficulty(room, 'hell')

    expect(result.error).toBe('任务进行中无法修改难度')
  })

  it('applies the rookie preset: three modules, no password, longer timer', () => {
    const room = createTwoPlayerRoom()
    setRoomDifficulty(room, 'rookie')
    startGame(room, { seed: 'rookie-seed', now: 1000 })

    expect(room.gameState.difficulty).toBe('rookie')
    expect(room.gameState.modules.map(module => module.type)).toEqual(['wires', 'symbols', 'keypad'])
    expect(room.gameState.deadlineAt).toBe(1000 + 420000)
    expect(room.gameState.strikeLimit).toBe(3)
  })

  it('applies the hard preset: tighter timer and lower strike limit', () => {
    const room = createTwoPlayerRoom()
    setRoomDifficulty(room, 'hard')
    startGame(room, { seed: 'hard-seed', now: 1000 })

    expect(room.gameState.modules).toHaveLength(4)
    expect(room.gameState.deadlineAt).toBe(1000 + 240000)
    expect(room.gameState.strikeLimit).toBe(2)
  })

  it('applies the hell preset with five modules including the maze', () => {
    const room = createTwoPlayerRoom()
    setRoomDifficulty(room, 'hell')
    startGame(room, { seed: 'hell-seed', now: 1000 })

    expect(room.gameState.modules).toHaveLength(5)
    expect(room.gameState.modules.map(module => module.type)).toContain('maze')
    expect(room.gameState.strikeLimit).toBe(2)
  })

  it('lets explicit start options override the difficulty preset', () => {
    const room = createTwoPlayerRoom()
    setRoomDifficulty(room, 'hell')
    startGame(room, { seed: 'override', now: 0, durationMs: 99000, strikeLimit: 5 })

    expect(room.gameState.deadlineAt).toBe(99000)
    expect(room.gameState.strikeLimit).toBe(5)
  })
})
