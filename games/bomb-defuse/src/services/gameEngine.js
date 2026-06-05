import { generateBombModules, validateModuleAction } from './modules'

export const GAME_PHASES = {
  WAITING: 'waiting',
  ROLE_SELECT: 'role_select',
  PLAYING: 'playing',
  SOLVED: 'solved',
  EXPLODED: 'exploded',
  ENDED: 'ended'
}

export const MODULE_TYPES = {
  WIRES: 'wires',
  SYMBOLS: 'symbols',
  KEYPAD: 'keypad',
  PASSWORD: 'password'
}

// Difficulty tiers control which modules appear, the countdown length, and the
// strike limit. Module sets are validated against the generator registry, so an
// unimplemented type (e.g. a future 'maze') is skipped gracefully.
export const DIFFICULTY_PRESETS = {
  rookie: { label: '新手', moduleTypes: ['wires', 'symbols', 'keypad'], durationMs: 420000, strikeLimit: 3 },
  normal: { label: '标准', moduleTypes: ['wires', 'symbols', 'keypad', 'password'], durationMs: 300000, strikeLimit: 3 },
  hard: { label: '困难', moduleTypes: ['wires', 'symbols', 'keypad', 'password'], durationMs: 240000, strikeLimit: 2 },
  // 迷宫模块上线后将追加到地狱档 moduleTypes，届时地狱档变为 5 模块。
  hell: { label: '地狱', moduleTypes: ['wires', 'symbols', 'keypad', 'password'], durationMs: 210000, strikeLimit: 1 }
}

export const DEFAULT_DIFFICULTY = 'normal'

const MODULE_STATUS = {
  UNSOLVED: 'unsolved',
  SOLVED: 'solved'
}

const DEFAULT_DURATION_MS = 300000
const DEFAULT_STRIKE_LIMIT = 3

export function generatePlayerId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

export function createInitialRoom(hostPlayerId, hostName, roomCode) {
  const now = Date.now()

  return {
    id: roomCode,
    code: roomCode,
    hostId: hostPlayerId,
    status: GAME_PHASES.WAITING,
    phase: GAME_PHASES.WAITING,
    settings: { difficulty: DEFAULT_DIFFICULTY },
    players: [{
      id: hostPlayerId,
      name: hostName,
      isHost: true,
      isOnline: true,
      order: 0,
      role: null
    }],
    gameState: createEmptyGameState(),
    disconnectedPlayers: [],
    createdAt: now,
    updatedAt: now
  }
}

export function addPlayerToRoom(room, playerName, playerId) {
  const existingPlayer = room.players.find(player => player.id === playerId)
  if (existingPlayer) {
    existingPlayer.name = playerName
    existingPlayer.isOnline = true
    touch(room)
    return { room, reconnected: true }
  }

  if (room.players.length >= 2) {
    return { error: '房间已满，需要刚好 2 名玩家' }
  }

  room.players.push({
    id: playerId,
    name: playerName,
    isHost: false,
    isOnline: true,
    order: room.players.length,
    role: null
  })

  if (room.players.length === 2 && room.players.every(p => !p.role)) {
    assignRoles(room)
  }
  touch(room)

  return { room, reconnected: false }
}

export function removePlayerFromRoom(room, playerId) {
  const player = room.players.find(candidate => candidate.id === playerId)
  if (!player) return room

  if (room.phase === GAME_PHASES.PLAYING) {
    player.isOnline = false
    room.disconnectedPlayers.push({
      id: player.id,
      name: player.name,
      disconnectedAt: Date.now()
    })
  } else {
    room.players = room.players.filter(candidate => candidate.id !== playerId)
    if (room.players.length > 0 && !room.players.some(candidate => candidate.id === room.hostId)) {
      room.hostId = room.players[0].id
      room.players[0].isHost = true
    }
  }

  touch(room)
  return room
}

export function startGame(room, options = {}) {
  if (room.phase !== GAME_PHASES.WAITING) {
    return { error: '任务已经开始' }
  }

  const onlinePlayers = room.players.filter(player => player.isOnline)
  if (onlinePlayers.length !== 2) {
    return { error: '需要 2 名在线玩家才能开始拆弹' }
  }

  const difficulty = options.difficulty ?? room.settings?.difficulty ?? DEFAULT_DIFFICULTY
  const preset = DIFFICULTY_PRESETS[difficulty] ?? DIFFICULTY_PRESETS[DEFAULT_DIFFICULTY]

  const startedAt = options.now ?? Date.now()
  const durationMs = options.durationMs ?? preset.durationMs ?? DEFAULT_DURATION_MS
  const seed = options.seed ?? createSeed(room.code, startedAt)

  if (options.roleByPlayerId || room.players.some(p => !p.role)) {
    assignRoles(room, options.roleByPlayerId)
  }
  room.status = GAME_PHASES.PLAYING
  room.phase = GAME_PHASES.PLAYING
  room.gameState = {
    ...createEmptyGameState(),
    seed,
    startedAt,
    deadlineAt: startedAt + durationMs,
    durationMs,
    strikeLimit: options.strikeLimit ?? preset.strikeLimit ?? DEFAULT_STRIKE_LIMIT,
    difficulty,
    serialNumber: options.serialNumber ?? createSerialNumber(seed),
    batteries: options.batteries ?? 2,
    indicators: options.indicators ?? ['CAR']
  }
  room.gameState.modules = generateBombModules({
    seed: room.gameState.seed,
    serialNumber: room.gameState.serialNumber,
    batteries: room.gameState.batteries,
    indicators: room.gameState.indicators,
    moduleTypes: options.moduleTypes ?? preset.moduleTypes
  })
  touch(room)

  return { room }
}

export function assignRoles(room, roleByPlayerId = null) {
  if (roleByPlayerId) {
    room.players.forEach(player => {
      player.role = roleByPlayerId[player.id] || null
    })
    touch(room)
    return { room }
  }

  const playersByOrder = [...room.players].sort((a, b) => a.order - b.order)
  playersByOrder.forEach((player, index) => {
    player.role = index === 0 ? 'defuser' : 'expert'
  })
  touch(room)

  return { room }
}

export function setRoomDifficulty(room, difficulty) {
  if (room.phase !== GAME_PHASES.WAITING) {
    return { error: '任务进行中无法修改难度' }
  }
  if (!DIFFICULTY_PRESETS[difficulty]) {
    return { error: '未知难度' }
  }

  room.settings = { ...room.settings, difficulty }
  touch(room)

  return { room }
}

export function submitModuleAction(room, playerId, moduleId, action) {
  if (room.phase !== GAME_PHASES.PLAYING) {
    return { error: '当前任务不接受操作' }
  }

  const player = room.players.find(candidate => candidate.id === playerId)
  if (!player || !player.isOnline) {
    return { error: '玩家不在任务中' }
  }

  if (player.role !== 'defuser') {
    return { error: '只有现场拆弹员可以操作模块' }
  }

  const module = room.gameState.modules.find(candidate => candidate.id === moduleId)
  if (!module) {
    return { error: '模块不存在' }
  }

  if (module.status === MODULE_STATUS.SOLVED) {
    return { error: '模块已经解除' }
  }

  const correct = validateModuleAction(module, action)
  room.gameState.actionLog.push({
    playerId,
    moduleId,
    action,
    correct,
    at: Date.now()
  })

  if (!correct) {
    recordStrike(room, playerId, moduleId, action)
    return { room, correct: false }
  }

  module.status = MODULE_STATUS.SOLVED
  room.gameState.solvedModuleIds.push(moduleId)
  checkEndCondition(room)
  touch(room)

  return { room, correct: true }
}

export function recordStrike(room, playerId, moduleId, action) {
  if (room.phase !== GAME_PHASES.PLAYING) {
    return { error: '当前任务不接受错误记录' }
  }

  room.gameState.strikes.push({
    playerId,
    moduleId,
    action,
    at: Date.now()
  })
  checkEndCondition(room)
  touch(room)

  return { room }
}

export function checkEndCondition(room, now = Date.now()) {
  if (room.phase !== GAME_PHASES.PLAYING) return { room }

  if (room.gameState.strikes.length >= room.gameState.strikeLimit) {
    finishRoom(room, GAME_PHASES.EXPLODED, 'exploded', now)
    return { room }
  }

  if (room.gameState.deadlineAt && now >= room.gameState.deadlineAt) {
    finishRoom(room, GAME_PHASES.EXPLODED, 'exploded', now)
    return { room }
  }

  const allModulesSolved = room.gameState.modules.length > 0 &&
    room.gameState.modules.every(module => module.status === MODULE_STATUS.SOLVED)
  if (allModulesSolved) {
    finishRoom(room, GAME_PHASES.SOLVED, 'solved', now)
  }

  return { room }
}

export function restartGame(room) {
  room.status = GAME_PHASES.WAITING
  room.phase = GAME_PHASES.WAITING
  room.players.forEach(player => {
    player.role = null
  })
  room.gameState = createEmptyGameState()
  room.disconnectedPlayers = []
  touch(room)

  return { room }
}

export function getPlayerRole(room, playerId) {
  return room.players.find(player => player.id === playerId)?.role || null
}

function createEmptyGameState() {
  return {
    seed: null,
    startedAt: null,
    deadlineAt: null,
    durationMs: DEFAULT_DURATION_MS,
    strikeLimit: DEFAULT_STRIKE_LIMIT,
    difficulty: DEFAULT_DIFFICULTY,
    strikes: [],
    serialNumber: '',
    batteries: 0,
    indicators: [],
    modules: [],
    solvedModuleIds: [],
    actionLog: [],
    result: null
  }
}

function createSeed(roomCode, timestamp) {
  return `${roomCode}-${timestamp}`
}

function createSerialNumber(seed) {
  const base = String(seed).toUpperCase().replace(/[^A-Z0-9]/g, '')
  return `${base.slice(0, 2).padEnd(2, 'X')}-${base.slice(-4).padStart(4, '0')}`
}

function finishRoom(room, phase, result, endedAt = Date.now()) {
  room.phase = phase
  room.status = phase
  room.gameState.result = result
  room.gameState.endedAt = endedAt
  touch(room)
}

function touch(room) {
  room.updatedAt = Date.now()
}
