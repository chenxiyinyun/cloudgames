import { describe, expect, it } from 'vitest'
import {
  GAME_PHASES,
  addPlayerToRoom,
  checkEndCondition,
  createInitialRoom,
  getPlayerRole,
  recordStrike,
  removePlayerFromRoom,
  restartGame,
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

  it('starts with two players, assigns different roles, and creates three modules', () => {
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
    expect(room.gameState.modules).toHaveLength(3)
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

    expect(room.gameState.solvedModuleIds).toEqual(['wires-1', 'symbols-1', 'keypad-1'])
    expect(room.phase).toBe(GAME_PHASES.SOLVED)
    expect(room.status).toBe(GAME_PHASES.SOLVED)
    expect(room.gameState.result).toBe('solved')
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
