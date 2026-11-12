import { describe, it, expect, beforeEach } from 'vitest'
import {
  GAME_PHASES,
  BOARD_SIZE,
  BLACK,
  WHITE,
  EMPTY,
  TURN_TIME_MS,
  END_REASONS,
  generatePlayerId,
  createEmptyBoard,
  createInitialRoom,
  addPlayerToRoom,
  removePlayerFromRoom,
  startGame,
  placeStone,
  checkWin,
  applyTurnTimeout,
  tickTurnDeadline,
  resign,
  endGame,
  restartGame,
  getRemainingTurnMs
} from '../gameEngine'

// ─── Helpers ────────────────────────────────────────────────

function makeRoom() {
  const room = createInitialRoom('host-id', 'Host', 'ROOM01')
  addPlayerToRoom(room, 'Guest', 'guest-id')
  return room
}

function startedRoom() {
  const room = makeRoom()
  startGame(room, 1_000)
  return room
}

beforeEach(() => {
  // 每个用例使用独立房间，无需额外清理
})

// ════════════════════════════════════════════════════════════
//  generatePlayerId / createEmptyBoard
// ════════════════════════════════════════════════════════════

describe('generatePlayerId', () => {
  it('returns a non-empty string', () => {
    const id = generatePlayerId()
    expect(id).toBeTypeOf('string')
    expect(id.length).toBeGreaterThan(0)
  })

  it('returns unique IDs across multiple calls', () => {
    const ids = new Set()
    for (let i = 0; i < 100; i++) ids.add(generatePlayerId())
    expect(ids.size).toBe(100)
  })
})

describe('createEmptyBoard', () => {
  it('creates a 15×15 board of empty cells', () => {
    const board = createEmptyBoard()
    expect(board).toHaveLength(BOARD_SIZE)
    expect(board.every(row => row.length === BOARD_SIZE && row.every(cell => cell === EMPTY))).toBe(true)
  })
})

// ════════════════════════════════════════════════════════════
//  createInitialRoom
// ════════════════════════════════════════════════════════════

describe('createInitialRoom', () => {
  it('sets the host as the only player in waiting phase', () => {
    const room = createInitialRoom('host-id', 'Host', 'ROOM01')
    expect(room.code).toBe('ROOM01')
    expect(room.hostId).toBe('host-id')
    expect(room.status).toBe(GAME_PHASES.WAITING)
    expect(room.phase).toBe(GAME_PHASES.WAITING)
    expect(room.players).toHaveLength(1)
    expect(room.players[0]).toMatchObject({ id: 'host-id', name: 'Host', isHost: true, isOnline: true, role: null })
    expect(room.board).toHaveLength(BOARD_SIZE)
    expect(room.winner).toBeNull()
    expect(room.turnDeadline).toBeNull()
  })
})

// ════════════════════════════════════════════════════════════
//  addPlayerToRoom
// ════════════════════════════════════════════════════════════

describe('addPlayerToRoom', () => {
  it('lets a second player join and assigns join order', () => {
    const room = createInitialRoom('host-id', 'Host', 'ROOM01')
    const result = addPlayerToRoom(room, 'Guest', 'guest-id')
    expect(result.error).toBeUndefined()
    expect(result.reconnected).toBe(false)
    expect(room.players).toHaveLength(2)
    expect(room.players[1]).toMatchObject({ id: 'guest-id', name: 'Guest', isHost: false, order: 1 })
  })

  it('rejects a third player', () => {
    const room = makeRoom()
    const result = addPlayerToRoom(room, 'Extra', 'extra-id')
    expect(result.error).toContain('房间已满')
    expect(room.players).toHaveLength(2)
  })

  it('rejects duplicate join while online', () => {
    const room = makeRoom()
    const result = addPlayerToRoom(room, 'Guest', 'guest-id')
    expect(result.error).toContain('已在房间')
  })

  it('reconnects an offline player', () => {
    const room = startedRoom()
    removePlayerFromRoom(room, 'guest-id') // 对局中 → 标记离线但保留席位
    const result = addPlayerToRoom(room, 'Guest', 'guest-id')
    expect(result.error).toBeUndefined()
    expect(result.reconnected).toBe(true)
    expect(room.players.find(p => p.id === 'guest-id').isOnline).toBe(true)
    expect(room.disconnectedPlayers).toHaveLength(0)
  })

  it('rejects joining after the game started', () => {
    const room = startedRoom()
    const result = addPlayerToRoom(room, 'Late', 'late-id')
    expect(result.error).toContain('游戏已开始')
  })
})

// ════════════════════════════════════════════════════════════
//  removePlayerFromRoom
// ════════════════════════════════════════════════════════════

describe('removePlayerFromRoom', () => {
  it('removes a player while waiting and transfers host if needed', () => {
    const room = makeRoom()
    removePlayerFromRoom(room, 'host-id')
    expect(room.players).toHaveLength(1)
    expect(room.hostId).toBe('guest-id')
    expect(room.players[0].isHost).toBe(true)
  })

  it('marks a player offline during play and keeps the seat', () => {
    const room = startedRoom()
    removePlayerFromRoom(room, 'guest-id')
    const guest = room.players.find(p => p.id === 'guest-id')
    expect(guest.isOnline).toBe(false)
    expect(room.players).toHaveLength(2)
    expect(room.disconnectedPlayers.map(p => p.id)).toContain('guest-id')
  })
})

// ════════════════════════════════════════════════════════════
//  startGame
// ════════════════════════════════════════════════════════════

describe('startGame', () => {
  it('requires two players', () => {
    const room = createInitialRoom('host-id', 'Host', 'ROOM01')
    const result = startGame(room, 1_000)
    expect(result.error).toContain('需要两名玩家')
    expect(room.phase).toBe(GAME_PHASES.WAITING)
  })

  it('assigns black to the first player and starts with black turn', () => {
    const room = makeRoom()
    const result = startGame(room, 1_000)
    expect(result.error).toBeUndefined()
    expect(room.players[0].role).toBe('black')
    expect(room.players[1].role).toBe('white')
    expect(room.currentTurn).toBe('black')
    expect(room.status).toBe(GAME_PHASES.PLAYING)
    expect(room.phase).toBe(GAME_PHASES.PLAYING)
    expect(room.turnDeadline).toBe(1_000 + TURN_TIME_MS)
    expect(room.moveHistory).toHaveLength(0)
  })

  it('rejects starting twice', () => {
    const room = startedRoom()
    const result = startGame(room, 2_000)
    expect(result.error).toContain('已开始')
  })
})

// ════════════════════════════════════════════════════════════
//  placeStone
// ════════════════════════════════════════════════════════════

describe('placeStone', () => {
  it('alternates turns and records move history', () => {
    const room = startedRoom()
    placeStone(room, 'host-id', 7, 7, 2_000)
    expect(room.board[7][7]).toBe(BLACK)
    expect(room.currentTurn).toBe('white')
    placeStone(room, 'guest-id', 7, 8, 3_000)
    expect(room.board[7][8]).toBe(WHITE)
    expect(room.currentTurn).toBe('black')
    expect(room.moveHistory).toHaveLength(2)
    expect(room.moveHistory[0]).toMatchObject({ playerId: 'host-id', row: 7, col: 7, color: BLACK })
  })

  it('rejects out-of-turn placement', () => {
    const room = startedRoom()
    const result = placeStone(room, 'guest-id', 0, 0, 2_000)
    expect(result.error).toContain('还没轮到')
    expect(room.board[0][0]).toBe(EMPTY)
  })

  it('rejects occupied cells', () => {
    const room = startedRoom()
    placeStone(room, 'host-id', 7, 7, 2_000)
    const result = placeStone(room, 'guest-id', 7, 7, 3_000)
    expect(result.error).toContain('已有棋子')
  })

  it('rejects out-of-bounds and non-integer positions', () => {
    const room = startedRoom()
    expect(placeStone(room, 'host-id', -1, 0, 2_000).error).toContain('无效')
    expect(placeStone(room, 'host-id', 0, 15, 2_000).error).toContain('无效')
    expect(placeStone(room, 'host-id', 1.5, 0, 2_000).error).toContain('无效')
  })

  it('rejects placement when not playing', () => {
    const room = makeRoom()
    const result = placeStone(room, 'host-id', 7, 7, 2_000)
    expect(result.error).toContain('未在进行中')
  })

  it('rejects placement from an offline player', () => {
    const room = startedRoom()
    removePlayerFromRoom(room, 'host-id')
    const result = placeStone(room, 'host-id', 7, 7, 2_000)
    expect(result.error).toContain('离线')
  })

  it('detects a horizontal five-in-a-row win', () => {
    const room = startedRoom()
    // 黑: (7,3)(7,4)(7,5)(7,6)(7,7)；白在别处落子
    const moves = [
      ['host-id', 7, 3], ['guest-id', 0, 0],
      ['host-id', 7, 4], ['guest-id', 0, 1],
      ['host-id', 7, 5], ['guest-id', 0, 2],
      ['host-id', 7, 6], ['guest-id', 0, 3],
      ['host-id', 7, 7]
    ]
    let now = 2_000
    let lastResult
    for (const [playerId, row, col] of moves) {
      lastResult = placeStone(room, playerId, row, col, now)
      now += 1_000
    }
    expect(lastResult.error).toBeUndefined()
    expect(room.winner).toBe('black')
    expect(room.endReason).toBe(END_REASONS.WIN)
    expect(room.phase).toBe(GAME_PHASES.ENDED)
    expect(room.status).toBe(GAME_PHASES.ENDED)
    expect(room.winningLine).toHaveLength(5)
    expect(room.turnDeadline).toBeNull()
  })

  it('detects diagonal wins and long connects (overline)', () => {
    const room = startedRoom()
    // 黑沿主对角线 (3,3)…(8,8) 六子连线；白棋散落在不安全位置避免先获胜
    const moves = [
      ['host-id', 3, 3], ['guest-id', 0, 10],
      ['host-id', 4, 4], ['guest-id', 0, 11],
      ['host-id', 5, 5], ['guest-id', 1, 10],
      ['host-id', 6, 6], ['guest-id', 1, 11],
      ['host-id', 7, 7], ['guest-id', 2, 10],
      ['host-id', 8, 8]
    ]
    let now = 2_000
    for (const [playerId, row, col] of moves) {
      placeStone(room, playerId, row, col, now)
      now += 1_000
    }
    expect(room.winner).toBe('black')
    expect(room.winningLine.length).toBeGreaterThanOrEqual(5)
  })

  it('declares a draw when the board is full', () => {
    const room = startedRoom()
    // 用 5 周期图案填满棋盘（任意方向最多 3 连，不会产生五连）
    for (let row = 0; row < BOARD_SIZE; row++) {
      for (let col = 0; col < BOARD_SIZE; col++) {
        room.board[row][col] = (row + 2 * col) % 5 < 2 ? BLACK : WHITE
      }
    }
    // 留一个空位给黑棋下最后一手
    room.board[14][14] = EMPTY
    room.currentTurn = 'black'
    room.moveHistory = Array.from({ length: BOARD_SIZE * BOARD_SIZE - 1 }, () => ({}))
    const result = placeStone(room, 'host-id', 14, 14, 2_000)
    expect(result.error).toBeUndefined()
    expect(room.winner).toBe('draw')
    expect(room.endReason).toBe(END_REASONS.DRAW)
    expect(room.phase).toBe(GAME_PHASES.ENDED)
  })
})

// ════════════════════════════════════════════════════════════
//  checkWin
// ════════════════════════════════════════════════════════════

describe('checkWin', () => {
  it('returns null for an empty cell', () => {
    const board = createEmptyBoard()
    expect(checkWin(board, 7, 7)).toBeNull()
  })

  it('detects vertical five', () => {
    const board = createEmptyBoard()
    for (let i = 0; i < 5; i++) board[3 + i][7] = WHITE
    const line = checkWin(board, 5, 7)
    expect(line).toHaveLength(5)
  })

  it('detects anti-diagonal five', () => {
    const board = createEmptyBoard()
    for (let i = 0; i < 5; i++) board[3 + i][10 - i] = BLACK
    const line = checkWin(board, 5, 8)
    expect(line).toHaveLength(5)
  })

  it('returns null for only four in a row', () => {
    const board = createEmptyBoard()
    for (let i = 0; i < 4; i++) board[7][3 + i] = BLACK
    expect(checkWin(board, 7, 5)).toBeNull()
  })
})

// ════════════════════════════════════════════════════════════
//  回合超时
// ════════════════════════════════════════════════════════════

describe('tickTurnDeadline / applyTurnTimeout', () => {
  it('does nothing before the deadline', () => {
    const room = startedRoom()
    expect(tickTurnDeadline(room, 1_000 + TURN_TIME_MS - 1)).toBe(false)
    expect(room.phase).toBe(GAME_PHASES.PLAYING)
  })

  it('awards the win to the opponent at the deadline', () => {
    const room = startedRoom()
    // 轮到黑棋（host），超时 → 白棋胜
    expect(tickTurnDeadline(room, 1_000 + TURN_TIME_MS)).toBe(true)
    expect(room.winner).toBe('white')
    expect(room.endReason).toBe(END_REASONS.TIMEOUT)
    expect(room.phase).toBe(GAME_PHASES.ENDED)
    expect(room.turnDeadline).toBeNull()
  })

  it('ignores ticks when not playing', () => {
    const room = makeRoom()
    expect(tickTurnDeadline(room, 999_999_999)).toBe(false)
  })

  it('applyTurnTimeout is a no-op outside of play', () => {
    const room = makeRoom()
    applyTurnTimeout(room, 999_999_999)
    expect(room.phase).toBe(GAME_PHASES.WAITING)
  })

  it('getRemainingTurnMs returns null outside of play', () => {
    const room = makeRoom()
    expect(getRemainingTurnMs(room, 1_000)).toBeNull()
  })
})

// ════════════════════════════════════════════════════════════
//  resign / endGame
// ════════════════════════════════════════════════════════════

describe('resign', () => {
  it('ends the game with the opponent as winner', () => {
    const room = startedRoom()
    const result = resign(room, 'host-id')
    expect(result.error).toBeUndefined()
    expect(room.winner).toBe('white')
    expect(room.endReason).toBe(END_REASONS.RESIGN)
    expect(room.phase).toBe(GAME_PHASES.ENDED)
  })

  it('rejects resigning outside of play', () => {
    const room = makeRoom()
    expect(resign(room, 'host-id').error).toContain('未在进行中')
  })
})

describe('endGame', () => {
  it('lets the host end an ongoing game without a winner', () => {
    const room = startedRoom()
    const result = endGame(room)
    expect(result.error).toBeUndefined()
    expect(room.phase).toBe(GAME_PHASES.ENDED)
    expect(room.winner).toBeNull()
    expect(room.endReason).toBe(END_REASONS.HOST_END)
  })

  it('rejects ending when not playing', () => {
    const room = makeRoom()
    expect(endGame(room).error).toContain('未在进行中')
  })
})

// ════════════════════════════════════════════════════════════
//  restartGame
// ════════════════════════════════════════════════════════════

describe('restartGame', () => {
  it('requires the previous game to be ended', () => {
    const room = startedRoom()
    expect(restartGame(room, 2_000).error).toContain('尚未结束')
  })

  it('swaps roles and starts a fresh board with black first', () => {
    const room = startedRoom()
    resign(room, 'host-id') // 白棋胜，对局结束
    const result = restartGame(room, 5_000)
    expect(result.error).toBeUndefined()
    expect(room.players[0].role).toBe('white')
    expect(room.players[1].role).toBe('black')
    expect(room.currentTurn).toBe('black')
    expect(room.board.every(row => row.every(cell => cell === EMPTY))).toBe(true)
    expect(room.winner).toBeNull()
    expect(room.moveHistory).toHaveLength(0)
    expect(room.phase).toBe(GAME_PHASES.PLAYING)
    expect(room.turnDeadline).toBe(5_000 + TURN_TIME_MS)
  })

  it('requires both players online to restart', () => {
    const room = startedRoom()
    removePlayerFromRoom(room, 'guest-id')
    resign(room, 'host-id')
    const result = restartGame(room, 5_000)
    expect(result.error).toContain('等待玩家上线')
  })
})
