export const GAME_PHASES = {
  WAITING: 'waiting',
  PLAYING: 'playing',
  ENDED: 'ended'
}

export const MAP_SIZES = {
  small: { label: '小', territoryCount: 10, minDistance: 170, neutralUnits: [8, 20], obstacleCount: 1 },
  medium: { label: '中', territoryCount: 16, minDistance: 130, neutralUnits: [12, 28], obstacleCount: 3 },
  large: { label: '大', territoryCount: 24, minDistance: 105, neutralUnits: [14, 34], obstacleCount: 5 }
}

export const DEFAULT_MAP_SIZE = 'medium'
export const PLAYER_COLORS = ['#e84d4f', '#2f8cff', '#23a66f', '#f2b233']
export const DISPATCH_RATIOS = [0.25, 0.5, 0.75]

const MAP_WIDTH = 1000
const MAP_HEIGHT = 640
const MAX_PLAYERS = 4
const MIN_PLAYERS = 2
const MAX_UNITS = 50
const TRAVEL_TIME_PER_EDGE = 1500
const PRODUCTION_INTERVAL = 2

let movingTroopIdCounter = 0

export function findPath(edges, sourceId, targetId) {
  if (sourceId === targetId) return null
  const adj = new Map()
  edges.forEach(({ from, to }) => {
    if (!adj.has(from)) adj.set(from, [])
    if (!adj.has(to)) adj.set(to, [])
    adj.get(from).push(to)
    adj.get(to).push(from)
  })
  if (!adj.has(sourceId) || !adj.has(targetId)) return null
  const visited = new Set([sourceId])
  const queue = [[sourceId, [sourceId]]]
  while (queue.length > 0) {
    const [current, path] = queue.shift()
    for (const neighbor of (adj.get(current) || [])) {
      if (neighbor === targetId) return [...path, neighbor]
      if (!visited.has(neighbor)) {
        visited.add(neighbor)
        queue.push([neighbor, [...path, neighbor]])
      }
    }
  }
  return null
}

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
    settings: {
      mapSize: DEFAULT_MAP_SIZE
    },
    players: [{
      id: hostPlayerId,
      name: hostName,
      isHost: true,
      isOnline: true,
      isEliminated: false,
      order: 0,
      color: PLAYER_COLORS[0]
    }],
    gameState: createEmptyGameState(),
    disconnectedPlayers: [],
    createdAt: now,
    updatedAt: now
  }
}

export function addPlayerToRoom(room, playerName, playerId) {
  const existing = room.players.find(player => player.id === playerId)
  if (existing) {
    existing.name = playerName
    existing.isOnline = true
    touch(room)
    return { room, reconnected: true }
  }

  if (room.phase !== GAME_PHASES.WAITING) {
    return { error: '战局已经开始' }
  }

  if (room.players.length >= MAX_PLAYERS) {
    return { error: '房间已满，最多 4 人' }
  }

  const order = room.players.length
  room.players.push({
    id: playerId,
    name: playerName,
    isHost: false,
    isOnline: true,
    isEliminated: false,
    order,
    color: PLAYER_COLORS[order]
  })
  touch(room)
  return { room, reconnected: false }
}

export function removePlayerFromRoom(room, playerId) {
  const player = room.players.find(candidate => candidate.id === playerId)
  if (!player) return room

  if (room.phase === GAME_PHASES.PLAYING) {
    markPlayerOffline(room, playerId)
  } else {
    room.players = room.players.filter(candidate => candidate.id !== playerId)
    room.players.forEach((candidate, index) => {
      candidate.order = index
      candidate.color = PLAYER_COLORS[index]
    })
    if (room.players.length > 0 && !room.players.some(candidate => candidate.id === room.hostId)) {
      room.hostId = room.players[0].id
      room.players[0].isHost = true
    }
    touch(room)
  }
  return room
}

export function setMapSize(room, mapSize) {
  if (room.phase !== GAME_PHASES.WAITING) {
    return { error: '战局开始后不能修改地图' }
  }
  if (!MAP_SIZES[mapSize]) {
    return { error: '未知地图尺寸' }
  }
  room.settings = { ...room.settings, mapSize }
  touch(room)
  return { room }
}

export function startGame(room, options = {}) {
  if (room.phase !== GAME_PHASES.WAITING) {
    return { error: '战局已经开始' }
  }

  const onlinePlayers = room.players.filter(player => player.isOnline)
  if (onlinePlayers.length < MIN_PLAYERS || onlinePlayers.length > MAX_PLAYERS) {
    return { error: '需要 2 到 4 名在线玩家' }
  }

  const mapSize = options.mapSize || room.settings?.mapSize || DEFAULT_MAP_SIZE
  if (!MAP_SIZES[mapSize]) {
    return { error: '未知地图尺寸' }
  }

  const seed = options.seed || createSeed(room.code, Date.now())
  const map = generateMap({
    seed,
    mapSize,
    players: onlinePlayers
  })

  room.phase = GAME_PHASES.PLAYING
  room.status = GAME_PHASES.PLAYING
  room.players.forEach(player => {
    player.isEliminated = !onlinePlayers.some(online => online.id === player.id)
  })
  room.gameState = {
    mapSize,
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    territories: map.territories,
    edges: map.edges,
    movingTroops: [],
    startedAt: Date.now(),
    lastTickAt: Date.now(),
    winnerId: null,
    endedAt: null
  }
  touch(room)
  return { room }
}

export function tickProduction(room, now = Date.now()) {
  if (room.phase !== GAME_PHASES.PLAYING) return { room }

  // 产出计数：每 PRODUCTION_INTERVAL 个 tick 才产出一次
  if (!room.gameState.productionTick) room.gameState.productionTick = 0
  room.gameState.productionTick += 1
  const shouldProduce = room.gameState.productionTick % PRODUCTION_INTERVAL === 0

  if (shouldProduce) {
    // 构建 owner 在线状态索引(每 tick 一次 O(n),避免在 territory.forEach 内重复 find)
    const ownerOnlineMap = new Map()
    room.players.forEach(player => {
      ownerOnlineMap.set(player.id, player.isOnline !== false)
    })

    room.gameState.territories.forEach(territory => {
      if (territory.isObstacle) return
      if (!territory.ownerId) return
      // 离线玩家的 territory 停止 +1 兵:防止"断网 5 分钟回来看自己兵山"导致躺赢
      // 现有兵不会被清零(仅停止 +1),玩家 reconnect 后立即恢复生产
      if (ownerOnlineMap.get(territory.ownerId) === false) return
      territory.units = Math.min(MAX_UNITS, territory.units + 1)
    })
  }

  tickMovingTroops(room, now)

  room.gameState.lastTickAt = now
  checkVictory(room, now)
  touch(room)
  return { room }
}

export function tickMovingTroops(room, now = Date.now()) {
  if (!room.gameState.movingTroops) return
  const arrived = []
  room.gameState.movingTroops.forEach(troop => {
    if (now < troop.nextArrivalAt) return
    arrived.push(troop)
  })

  arrived.forEach(troop => {
    troop.currentStep += 1
    const territoryId = troop.path[troop.currentStep]
    const territory = room.gameState.territories.find(t => t.id === territoryId)
    if (!territory) {
      removeMovingTroop(room, troop.id)
      return
    }
    if (territory.isObstacle) {
      removeMovingTroop(room, troop.id)
      return
    }

    const isFinalStep = troop.currentStep >= troop.path.length - 1

    if (territory.ownerId === troop.playerId) {
      // 友方领地：如果是终点则增兵，否则路过
      if (isFinalStep) {
        territory.units = Math.min(MAX_UNITS, territory.units + troop.amount)
        removeMovingTroop(room, troop.id)
      } else {
        troop.nextArrivalAt = now + TRAVEL_TIME_PER_EDGE
      }
    } else {
      // 敌方/中立领地：战斗结算
      if (troop.amount > territory.units) {
        territory.ownerId = troop.playerId
        territory.units = Math.min(MAX_UNITS, troop.amount - territory.units)
        if (isFinalStep) {
          removeMovingTroop(room, troop.id)
        } else {
          troop.nextArrivalAt = now + TRAVEL_TIME_PER_EDGE
        }
      } else {
        territory.units -= troop.amount
        if (territory.units === 0) {
          territory.ownerId = null
        }
        removeMovingTroop(room, troop.id)
      }
    }
  })
}

function removeMovingTroop(room, troopId) {
  room.gameState.movingTroops = room.gameState.movingTroops.filter(t => t.id !== troopId)
}

/**
 * 把超时未上线的玩家的 territory 强制中立化,玩家标记为已淘汰。
 * 解决"躺赢"问题:玩家断网 60s 后,即使有 territory 也不再保留 owner,
 * 其他玩家可正常夺取。
 *
 * @param {object} room
 * @param {number} nowMs
 * @param {number} timeoutMs - 默认 60s
 * @returns {string[]} 被中立化的玩家 id 列表(供上层 broadcast)
 */
export function neutralizeLongOfflinePlayers(room, nowMs = Date.now(), timeoutMs = 60 * 1000) {
  if (room.phase !== GAME_PHASES.PLAYING) return []
  if (!room.disconnectedPlayers?.length) return []

  const stale = room.disconnectedPlayers.filter(p => nowMs - p.disconnectedAt >= timeoutMs)
  if (stale.length === 0) return []

  const eliminatedIds = []
  stale.forEach(entry => {
    const player = room.players.find(p => p.id === entry.id)
    if (!player || player.isOnline !== false) return

    player.isEliminated = true
    room.gameState.territories.forEach(territory => {
      if (territory.ownerId === player.id) {
        territory.ownerId = null
        territory.isCapital = false
        // 现有兵力保留(不归零)— 让中立 terrain 仍有意义,其他玩家可夺取
      }
    })
    eliminatedIds.push(player.id)
  })

  if (eliminatedIds.length > 0) {
    // 从 disconnectedPlayers 移除已处理的(避免下次重复处理)
    room.disconnectedPlayers = room.disconnectedPlayers.filter(p => !eliminatedIds.includes(p.id))
    checkVictory(room, nowMs)
    touch(room)
  }

  return eliminatedIds
}

export function dispatchUnits(room, playerId, sourceId, targetId, ratio = 0.5, now = Date.now()) {
  if (room.phase !== GAME_PHASES.PLAYING) {
    return { error: '当前战局不接受操作' }
  }

  const player = room.players.find(candidate => candidate.id === playerId)
  if (!player || player.isEliminated || !player.isOnline) {
    return { error: '玩家不在战局中' }
  }

  const source = room.gameState.territories.find(territory => territory.id === sourceId)
  const target = room.gameState.territories.find(territory => territory.id === targetId)
  if (!source || !target) return { error: '领地不存在' }
  if (source.isObstacle || target.isObstacle) return { error: '不能对障碍领地操作' }
  if (source.ownerId !== playerId) return { error: '只能从自己的领地派遣' }
  if (source.id === target.id) return { error: '不能派遣到同一领地' }

  const path = findPath(room.gameState.edges, sourceId, targetId)
  if (!path) return { error: '目标领地不可达' }

  const normalizedRatio = normalizeDispatchRatio(ratio)
  const amount = Math.floor(source.units * normalizedRatio)
  if (amount <= 0) return { error: '兵力不足' }

  source.units -= amount
  movingTroopIdCounter += 1
  room.gameState.movingTroops.push({
    id: `mv${movingTroopIdCounter}`,
    playerId,
    amount,
    path,
    currentStep: 0,
    nextArrivalAt: now + TRAVEL_TIME_PER_EDGE
  })

  touch(room)
  return { room, amount, path }
}

export function restartGame(room) {
  room.phase = GAME_PHASES.WAITING
  room.status = GAME_PHASES.WAITING
  room.players.forEach((player, index) => {
    player.isEliminated = false
    player.isHost = player.id === room.hostId
    player.color = PLAYER_COLORS[index]
    player.order = index
  })
  room.gameState = createEmptyGameState()
  room.disconnectedPlayers = []
  touch(room)
  return { room }
}

export function endGame(room, winnerId = null, now = Date.now()) {
  room.phase = GAME_PHASES.ENDED
  room.status = GAME_PHASES.ENDED
  room.gameState.winnerId = winnerId
  room.gameState.endedAt = now
  touch(room)
  return { room }
}

export function getOwnedTerritoryCount(room, playerId) {
  return room.gameState.territories.filter(territory => territory.ownerId === playerId).length
}

export function getPlayerById(room, playerId) {
  return room.players.find(player => player.id === playerId) || null
}

function resolveArrival(room, playerId, target, amount) {
  if (target.ownerId === playerId) {
    target.units = Math.min(MAX_UNITS, target.units + amount)
    return
  }

  if (amount > target.units) {
    target.ownerId = playerId
    target.units = Math.min(MAX_UNITS, amount - target.units)
    return
  }

  target.units -= amount
  if (target.units === 0) {
    target.ownerId = null
  }
}

function checkVictory(room, now = Date.now()) {
  const livePlayerIds = room.players
    .filter(player => !player.isEliminated)
    .map(player => player.id)

  livePlayerIds.forEach(playerId => {
    const player = room.players.find(candidate => candidate.id === playerId)
    if (player && getOwnedTerritoryCount(room, playerId) === 0) {
      player.isEliminated = true
    }
  })

  const remaining = room.players.filter(player =>
    !player.isEliminated && getOwnedTerritoryCount(room, player.id) > 0
  )
  if (remaining.length === 1 && room.phase === GAME_PHASES.PLAYING) {
    endGame(room, remaining[0].id, now)
  }
}

function markPlayerOffline(room, playerId) {
  const player = room.players.find(candidate => candidate.id === playerId)
  if (!player) return
  player.isOnline = false
  if (!room.disconnectedPlayers.some(candidate => candidate.id === player.id)) {
    room.disconnectedPlayers.push({
      id: player.id,
      name: player.name,
      disconnectedAt: Date.now()
    })
  }
  touch(room)
}

function normalizeDispatchRatio(ratio) {
  const numeric = Number(ratio)
  if (DISPATCH_RATIOS.includes(numeric)) return numeric
  return 0.5
}

function generateMap({ seed, mapSize, players }) {
  const config = MAP_SIZES[mapSize] || MAP_SIZES[DEFAULT_MAP_SIZE]
  const rng = createRng(seed)
  const territories = createTerritories(config, rng)
  const spawnIndexes = chooseSpawnIndexes(territories, players.length, rng)

  spawnIndexes.forEach((territoryIndex, index) => {
    const territory = territories[territoryIndex]
    territory.ownerId = players[index].id
    territory.units = 15
    territory.isCapital = true
  })

  const obstacleIndexes = chooseObstacleIndexes(territories, spawnIndexes, config.obstacleCount, rng)
  obstacleIndexes.forEach(index => {
    territories[index].isObstacle = true
    territories[index].ownerId = null
    territories[index].units = 0
    territories[index].isCapital = false
  })

  territories.forEach(territory => {
    if (!territory.ownerId && !territory.isObstacle) {
      territory.units = randomInt(rng, config.neutralUnits[0], config.neutralUnits[1])
    }
  })

  const playableTerritories = territories.filter(t => !t.isObstacle)
  const edges = createEdges(playableTerritories)

  // 确保可玩图连通，若不连通则逐步移除障碍直到连通
  let finalEdges = edges
  let finalObstacleIndexes = obstacleIndexes
  while (!isGraphConnected(playableTerritories, finalEdges) && finalObstacleIndexes.length > 0) {
    const restored = finalObstacleIndexes.pop()
    territories[restored].isObstacle = false
    territories[restored].units = randomInt(rng, config.neutralUnits[0], config.neutralUnits[1])
    const updatedPlayable = territories.filter(t => !t.isObstacle)
    finalEdges = createEdges(updatedPlayable)
  }

  return {
    territories,
    edges: finalEdges
  }
}

function createTerritories(config, rng) {
  const territories = []
  let attempts = 0
  while (territories.length < config.territoryCount && attempts < config.territoryCount * 120) {
    attempts += 1
    const x = randomInt(rng, 80, MAP_WIDTH - 80)
    const y = randomInt(rng, 80, MAP_HEIGHT - 80)
    const minDistance = config.minDistance * (territories.length < 8 ? 1 : 0.82)
    const tooClose = territories.some(territory => distance(territory, { x, y }) < minDistance)
    if (tooClose) continue
    territories.push({
      id: `t${territories.length + 1}`,
      x,
      y,
      ownerId: null,
      units: 0,
      isCapital: false
    })
  }

  while (territories.length < config.territoryCount) {
    territories.push({
      id: `t${territories.length + 1}`,
      x: randomInt(rng, 80, MAP_WIDTH - 80),
      y: randomInt(rng, 80, MAP_HEIGHT - 80),
      ownerId: null,
      units: 0,
      isCapital: false
    })
  }
  return territories
}

function chooseSpawnIndexes(territories, playerCount, rng) {
  // 4 角固定,按 playerCount 随机抽 — 2 人可能是 LT/RB 或 RT/LB 等,避免背板
  const corners = [
    { x: 70, y: 70 },
    { x: MAP_WIDTH - 70, y: 70 },
    { x: MAP_WIDTH - 70, y: MAP_HEIGHT - 70 },
    { x: 70, y: MAP_HEIGHT - 70 }
  ]
  // Fisher-Yates shuffle(corners) — 用 seed-based rng 保证可重放
  for (let i = corners.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1))
    ;[corners[i], corners[j]] = [corners[j], corners[i]]
  }
  const picked = corners.slice(0, playerCount)
  const used = new Set()
  return picked.map(corner => {
    let bestIndex = 0
    let bestDistance = Infinity
    territories.forEach((territory, index) => {
      if (used.has(index)) return
      const score = distance(territory, corner)
      if (score < bestDistance) {
        bestDistance = score
        bestIndex = index
      }
    })
    used.add(bestIndex)
    return bestIndex
  })
}

function chooseObstacleIndexes(territories, spawnIndexes, count, rng) {
  if (count <= 0) return []
  const spawnSet = new Set(spawnIndexes)
  // 出生点附近的领地也不选为障碍，保证玩家有扩展空间
  const spawnPositions = spawnIndexes.map(i => territories[i])
  const SPAWN_SAFE_RADIUS = 180

  const candidates = territories
    .map((t, i) => ({ index: i, territory: t }))
    .filter(({ index, territory }) => {
      if (spawnSet.has(index)) return false
      const tooCloseToSpawn = spawnPositions.some(s => distance(territory, s) < SPAWN_SAFE_RADIUS)
      return !tooCloseToSpawn
    })

  // Fisher-Yates 从候选中随机选取
  for (let i = candidates.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1))
    ;[candidates[i], candidates[j]] = [candidates[j], candidates[i]]
  }

  return candidates.slice(0, Math.min(count, candidates.length)).map(c => c.index)
}

function isGraphConnected(territories, edges) {
  if (territories.length === 0) return true
  const adj = new Map()
  territories.forEach(t => adj.set(t.id, []))
  edges.forEach(({ from, to }) => {
    if (adj.has(from)) adj.get(from).push(to)
    if (adj.has(to)) adj.get(to).push(from)
  })
  const startId = territories[0].id
  const visited = new Set([startId])
  const queue = [startId]
  while (queue.length > 0) {
    const current = queue.shift()
    for (const neighbor of (adj.get(current) || [])) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor)
        queue.push(neighbor)
      }
    }
  }
  return visited.size === territories.length
}

function createEdges(territories) {
  const edgeKeys = new Set()
  const addEdge = (from, to) => {
    if (from === to) return
    const key = [from, to].sort().join('-')
    edgeKeys.add(key)
  }

  for (let index = 1; index < territories.length; index += 1) {
    let nearestIndex = 0
    let nearestDistance = Infinity
    for (let previous = 0; previous < index; previous += 1) {
      const d = distance(territories[index], territories[previous])
      if (d < nearestDistance) {
        nearestDistance = d
        nearestIndex = previous
      }
    }
    addEdge(territories[index].id, territories[nearestIndex].id)
  }

  territories.forEach(territory => {
    const nearest = territories
      .filter(candidate => candidate.id !== territory.id)
      .map(candidate => ({ id: candidate.id, d: distance(territory, candidate) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, 3)
    nearest.forEach(candidate => addEdge(territory.id, candidate.id))
  })

  return [...edgeKeys].map(key => {
    const [from, to] = key.split('-')
    return { from, to }
  })
}

function createEmptyGameState() {
  return {
    mapSize: DEFAULT_MAP_SIZE,
    seed: null,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    territories: [],
    edges: [],
    movingTroops: [],
    productionTick: 0,
    startedAt: null,
    lastTickAt: null,
    winnerId: null,
    endedAt: null
  }
}

function createSeed(roomCode, timestamp) {
  return `${roomCode}-${timestamp}`
}

function createRng(seed) {
  let h = 2166136261
  const text = String(seed)
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return function next() {
    h += 0x6d2b79f5
    let t = h
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function randomInt(rng, min, max) {
  return Math.floor(rng() * (max - min + 1)) + min
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function touch(room) {
  room.updatedAt = Date.now()
}
