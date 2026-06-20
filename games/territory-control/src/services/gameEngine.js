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
export const THEMES = {
  default: { label: '经典' },
  catpaw: { label: '猫爪' }
}
export const DEFAULT_THEME = 'default'

export const TERRITORY_TYPES = {
  normal: { label: '普通' },
  granary: { label: '粮仓', productionBonus: 2 },
  fortress: { label: '要塞', defenseMultiplier: 1.3 },
  market: { label: '集市', marchSpeedMultiplier: 1.5 },
  ruins: { label: '废墟', globalProductionBonus: 0.5 }
}
export const PLAYER_COLORS = ['#e84d4f', '#2f8cff', '#23a66f', '#f2b233']
export const DISPATCH_RATIOS = [0.25, 0.5, 0.75]

/**
 * 天气事件：随机轮换的全局效果。所有天气效果通过 `getWeatherEffect` 统一定义，
 * `tickWeather` 负责轮换（每隔 WEATHER_GAP_MS 在 null 与某个天气间切换）。
 */
export const WEATHER_TYPES = {
  storm: { label: '暴雨', description: '全军行军 -30%', marchSpeedMultiplier: 0.7 },
  fog: { label: '大雾', description: '战斗伤害 -20%', combatDamageMultiplier: 0.8 },
  bountiful: { label: '丰收', description: '全球产兵 ×2', productionMultiplier: 2 },
  earthquake: { label: '地震', description: '每 5s 随机领地减员 30%', periodicShake: 0.3 },
  plague: { label: '瘟疫', description: '每 tick 随机领地 -1 兵', decay: 1 }
}
export const WEATHER_DURATION_MS = 25000
export const WEATHER_GAP_MS = 6000
export const WEATHER_EARTHQUAKE_INTERVAL_MS = 5000

/**
 * 拾取道具：地图上随机生成的小节点，派兵抵达即拾取并获得玩家级 buff。
 * 4 种 buff 全部持续 20s，互不冲突可叠加。
 */
export const ITEM_TYPES = {
  forcedMarch: { label: '急行军令', description: '派兵速度 ×2 (20s)', marchSpeedMultiplier: 2 },
  conscription: { label: '征兵令', description: '产兵 ×2 (20s)', productionMultiplier: 2 },
  beacon: { label: '烽火台', description: '战斗力 ×1.5 (20s)', attackMultiplier: 1.5 },
  emptyCity: { label: '空城计', description: '防御 ×1.5 (20s)', defenseMultiplier: 1.5 }
}
export const BUFF_DURATION_MS = 20000
export const INITIAL_ITEM_COUNT = 4
export const ITEM_RESPAWN_INTERVAL_MS = 25000

/**
 * 行军遭遇：派兵时按概率触发，立即影响 troop.amount 或行进时间。
 * 触发后视觉/日志由前端在 dispatch 返回值中读取。
 */
export const ENCOUNTER_TYPES = {
  bandit: { label: '山贼伏击', description: '损失 30% 兵力', unitLossRatio: 0.3 },
  volunteers: { label: '义军投奔', description: '增加 20% 兵力', unitGainRatio: 0.2 },
  lost: { label: '迷路', description: '延迟 50% 到达', arrivalDelayRatio: 0.5 }
}
export const ENCOUNTER_CHANCE = 0.2

export const MAP_WIDTH = 1000
export const MAP_HEIGHT = 640
export const MAP_ASPECT_RATIO = MAP_WIDTH / MAP_HEIGHT
const MAX_PLAYERS = 4
const MIN_PLAYERS = 2
const MAX_UNITS = 50
export const TRAVEL_TIME_PER_EDGE = 1500
const PRODUCTION_INTERVAL = 2

let movingTroopIdCounter = 0

export function findPath(edges, sourceId, targetId, territories = []) {
  if (sourceId === targetId) return null
  const obstacleIds = new Set(territories.filter(t => t.isObstacle).map(t => t.id))
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
      if (obstacleIds.has(neighbor)) continue
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

export function setTheme(room, theme) {
  if (room.phase !== GAME_PHASES.WAITING) {
    return { error: '战局开始后不能修改主题' }
  }
  if (!THEMES[theme]) {
    return { error: '未知主题' }
  }
  room.settings = { ...room.settings, theme }
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
  const theme = room.settings?.theme || DEFAULT_THEME
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
    theme,
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    territories: map.territories,
    edges: map.edges,
    items: map.items,
    movingTroops: [],
    weather: createEmptyWeather(),
    weatherRotationAt: Date.now() + WEATHER_GAP_MS,
    playerBuffs: {},
    nextItemRespawnAt: Date.now() + ITEM_RESPAWN_INTERVAL_MS,
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

  // 肉鸽机制：天气轮换 + 道具重生 + buff 过期清理。每 tick 都跑。
  tickWeather(room, now)
  tickItemRespawn(room, now)
  expirePlayerBuffs(room, now)

  if (shouldProduce) {
    // 构建 owner 在线状态索引(每 tick 一次 O(n),避免在 territory.forEach 内重复 find)
    const ownerOnlineMap = new Map()
    room.players.forEach(player => {
      ownerOnlineMap.set(player.id, player.isOnline !== false)
    })

    // 废墟全局加成：拥有废墟的玩家其全部领地都获得 +0.5/次产出
    const ruinsOwners = new Set(
      room.gameState.territories
        .filter(t => t.type === 'ruins' && t.ownerId)
        .map(t => t.ownerId)
    )

    // 天气丰收取整加成(×2)
    const weatherProductionMultiplier = getWeatherEffect(room, 'productionMultiplier') || 1

    room.gameState.territories.forEach(territory => {
      if (territory.isObstacle) return
      if (!territory.ownerId) return
      if (ownerOnlineMap.get(territory.ownerId) === false) return

      // 基础产出（粮仓翻倍 + 玩家征兵 buff 翻倍 + 丰收再翻倍）
      const baseBonus = territory.type === 'granary' ? TERRITORY_TYPES.granary.productionBonus : 1
      const playerBuffMultiplier = getPlayerBuffEffect(room, territory.ownerId, 'productionMultiplier') || 1
      let finalBonus = baseBonus * playerBuffMultiplier * weatherProductionMultiplier

      // 废墟全球 +0.5：仅当主人拥有废墟时附加
      if (ruinsOwners.has(territory.ownerId)) {
        finalBonus += TERRITORY_TYPES.ruins.globalProductionBonus
      }

      territory.units = Math.min(MAX_UNITS, territory.units + Math.max(0.5, finalBonus))
    })
  }

  // 瘟疫：每 tick 随机 1 个非障碍领地减 1 兵
  applyPlague(room)

  // 地震：每 WEATHER_EARTHQUAKE_INTERVAL_MS 一次随机减员
  applyEarthquake(room, now)

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

  const weatherMarchMultiplier = getWeatherEffect(room, 'marchSpeedMultiplier') || 1
  const weatherCombatMultiplier = getWeatherEffect(room, 'combatDamageMultiplier') || 1

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

    // 道具节点：派兵抵达直接拾取
    if (territory.kind === 'item') {
      grantItemBuff(room, troop.playerId, territory.itemKind)
      removeItem(room, territory.id)
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
        troop.nextArrivalAt = now + computeTravelDuration(room, troop, weatherMarchMultiplier)
      }
    } else {
      // 敌方/中立领地：战斗结算
      // 防御系数：要塞 + 玩家空城计 buff（叠加），再叠加大雾减伤
      const fortressMultiplier = territory.type === 'fortress' ? TERRITORY_TYPES.fortress.defenseMultiplier : 1
      const emptyCityMultiplier = getPlayerBuffEffect(room, territory.ownerId, 'defenseMultiplier') || 1
      const defenseMultiplier = fortressMultiplier * emptyCityMultiplier / weatherCombatMultiplier
      const effectiveDefense = Math.floor(territory.units * defenseMultiplier)
      // 攻击系数：烽火台 buff
      const attackMultiplier = getPlayerBuffEffect(room, troop.playerId, 'attackMultiplier') || 1
      const effectiveAttack = Math.floor(troop.amount * attackMultiplier)
      if (effectiveAttack > effectiveDefense) {
        territory.ownerId = troop.playerId
        territory.units = Math.min(MAX_UNITS, effectiveAttack - territory.units)
        if (isFinalStep) {
          removeMovingTroop(room, troop.id)
        } else {
          troop.nextArrivalAt = now + computeTravelDuration(room, troop, weatherMarchMultiplier)
        }
      } else {
        territory.units -= Math.ceil(effectiveAttack / defenseMultiplier)
        if (territory.units <= 0) {
          territory.units = 0
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

  // 源和目标都允许在 territories（含道具节点）中查找。
  const source = room.gameState.territories.find(territory => territory.id === sourceId)
  const target = room.gameState.territories.find(territory => territory.id === targetId)
  if (!source || !target) return { error: '领地不存在' }
  if (source.isObstacle || target.isObstacle) return { error: '不能对障碍领地操作' }
  if (source.kind === 'item') return { error: '道具节点不能作为派兵起点' }
  if (source.ownerId !== playerId) return { error: '只能从自己的领地派遣' }
  if (source.id === target.id) return { error: '不能派遣到同一领地' }

  const path = findPath(room.gameState.edges, sourceId, targetId, room.gameState.territories)
  if (!path) return { error: '目标领地不可达' }

  const normalizedRatio = normalizeDispatchRatio(ratio)
  let amount = Math.floor(source.units * normalizedRatio)
  if (amount <= 0) return { error: '兵力不足' }

  // 行军遭遇：派兵瞬间按概率触发，立即影响 amount 或到达时间
  // 使用 seed-based rng 让测试可重放
  const encounter = rollEncounter(room, now)
  if (encounter) {
    const effect = ENCOUNTER_TYPES[encounter]
    if (effect.unitLossRatio) {
      amount = Math.max(1, Math.floor(amount * (1 - effect.unitLossRatio)))
    } else if (effect.unitGainRatio) {
      amount = Math.min(MAX_UNITS, Math.floor(amount * (1 + effect.unitGainRatio)))
    }
  }

  source.units -= Math.floor(source.units * normalizedRatio)

  // 行军速度系数：源集市 × 玩家急行军 buff × 天气
  const sourceMarchMultiplier = source.type === 'market' ? TERRITORY_TYPES.market.marchSpeedMultiplier : 1
  const playerMarchMultiplier = getPlayerBuffEffect(room, playerId, 'marchSpeedMultiplier') || 1
  const weatherMarchMultiplier = getWeatherEffect(room, 'marchSpeedMultiplier') || 1
  const encounterDelay = encounter && ENCOUNTER_TYPES[encounter].arrivalDelayRatio
    ? ENCOUNTER_TYPES[encounter].arrivalDelayRatio
    : 0

  movingTroopIdCounter += 1
  const troop = {
    id: `mv${movingTroopIdCounter}`,
    playerId,
    amount,
    path,
    currentStep: 0,
    nextArrivalAt: now + computeBaseTravelTime(encounterDelay, sourceMarchMultiplier, playerMarchMultiplier, weatherMarchMultiplier),
    sourceMarchMultiplier,
    encounter
  }
  room.gameState.movingTroops.push(troop)

  touch(room)
  return { room, amount, path, encounter, troopId: troop.id }
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

function assignSpecialTerritoryTypes(territories, rng) {
  // 从中立非障碍领地中随机选取 5 种特殊类型: 1-2 粮仓 + 1 要塞 + 0-1 集市 + 0-1 废墟
  const candidates = territories
    .map((t, i) => ({ index: i, territory: t }))
    .filter(({ territory }) => !territory.ownerId && !territory.isObstacle)

  if (candidates.length === 0) return

  // Fisher-Yates 打乱
  for (let i = candidates.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1))
    ;[candidates[i], candidates[j]] = [candidates[j], candidates[i]]
  }

  const granaryCount = Math.min(randomInt(rng, 1, 2), candidates.length)
  for (let i = 0; i < granaryCount; i++) {
    candidates[i].territory.type = 'granary'
  }

  let cursor = granaryCount
  if (cursor < candidates.length) {
    candidates[cursor].territory.type = 'fortress'
    cursor += 1
  }
  if (cursor < candidates.length) {
    candidates[cursor].territory.type = 'market'
  }
  if (cursor + 1 < candidates.length) {
    candidates[cursor + 1].territory.type = 'ruins'
  }
}

function spawnItems(territories, rng, count) {
  // 从非障碍、非己方领地的空位随机生成道具节点，与 territories 同结构以便参与寻路
  const empty = []
  for (let x = 120; x < MAP_WIDTH - 120; x += 80) {
    for (let y = 120; y < MAP_HEIGHT - 120; y += 80) {
      if (territories.some(t => distance(t, { x, y }) < 70)) continue
      empty.push({ x, y })
    }
  }
  if (empty.length === 0) return []

  const kinds = Object.keys(ITEM_TYPES)
  const items = []
  const usedIndexes = new Set()
  for (let i = 0; i < count && empty.length > 0; i += 1) {
    const idx = Math.floor(rng() * empty.length)
    if (usedIndexes.has(idx)) continue
    usedIndexes.add(idx)
    const pos = empty[idx]
    items.push({
      id: `item${i + 1}`,
      x: pos.x,
      y: pos.y,
      ownerId: null,
      units: 0,
      isCapital: false,
      isObstacle: false,
      type: 'normal',
      kind: 'item',
      itemKind: kinds[i % kinds.length]
    })
  }
  return items
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
    territories[index].type = 'normal'
  })

  territories.forEach(territory => {
    if (!territory.ownerId && !territory.isObstacle) {
      territory.units = randomInt(rng, config.neutralUnits[0], config.neutralUnits[1])
    }
  })

  // 肉鸽元素：随机分配 5 种领地类型给部分中立领地
  assignSpecialTerritoryTypes(territories, rng)

  // 肉鸽元素：在地图空位生成道具节点，纳入 territories 以便参与寻路
  const items = spawnItems(territories, rng, INITIAL_ITEM_COUNT)
  territories.push(...items)

  const edges = createEdges(territories)

  // 确保可玩图连通，若不连通则逐步移除障碍直到连通
  let finalObstacleIndexes = [...obstacleIndexes]
  let playableTerritories = territories.filter(t => !t.isObstacle)
  while (!isGraphConnected(playableTerritories, edges) && finalObstacleIndexes.length > 0) {
    const restored = finalObstacleIndexes.pop()
    territories[restored].isObstacle = false
    territories[restored].units = randomInt(rng, config.neutralUnits[0], config.neutralUnits[1])
    playableTerritories = territories.filter(t => !t.isObstacle)
  }

  return {
    territories,
    edges,
    items
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
      isCapital: false,
      type: 'normal'
    })
  }

  while (territories.length < config.territoryCount) {
    territories.push({
      id: `t${territories.length + 1}`,
      x: randomInt(rng, 80, MAP_WIDTH - 80),
      y: randomInt(rng, 80, MAP_HEIGHT - 80),
      ownerId: null,
      units: 0,
      isCapital: false,
      type: 'normal'
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
    if (adj.has(from) && adj.has(to)) {
      adj.get(from).push(to)
      adj.get(to).push(from)
    }
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
    items: [],
    movingTroops: [],
    weather: createEmptyWeather(),
    weatherRotationAt: 0,
    playerBuffs: {},
    nextItemRespawnAt: 0,
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

// ========== 肉鸽机制辅助函数 ==========

function createEmptyWeather() {
  return { type: null, startedAt: 0, durationMs: 0, lastEarthquakeAt: 0 }
}

/**
 * 天气轮换：每隔 WEATHER_GAP_MS 检查一次。如果当前有天气且已过期，切到 null；
 * 如果当前 null 且已到轮换时间，随机选一个新天气。
 */
function tickWeather(room, now) {
  const weather = room.gameState.weather
  if (!weather) return
  if (weather.type) {
    if (now - weather.startedAt >= weather.durationMs) {
      weather.type = null
      weather.startedAt = 0
      weather.durationMs = 0
      room.gameState.weatherRotationAt = now + WEATHER_GAP_MS
    }
    return
  }
  if (now >= room.gameState.weatherRotationAt) {
    const keys = Object.keys(WEATHER_TYPES)
    const pick = keys[Math.floor(Math.random() * keys.length)]
    weather.type = pick
    weather.startedAt = now
    weather.durationMs = WEATHER_DURATION_MS
    weather.lastEarthquakeAt = now
  }
}

/** 读取当前天气的某个效果字段（若无该字段则返回 fallback）。 */
export function getWeatherEffect(room, field) {
  const type = room.gameState.weather?.type
  if (!type) return null
  return WEATHER_TYPES[type]?.[field] ?? null
}

/** 读取某玩家所有未过期 buff 中指定字段的最大值。 */
export function getPlayerBuffEffect(room, playerId, field) {
  if (!playerId) return null
  const buffs = room.gameState.playerBuffs?.[playerId] || []
  let best = null
  buffs.forEach(buff => {
    const v = ITEM_TYPES[buff.type]?.[field]
    if (v === undefined) return
    if (best === null || v > best) best = v
  })
  return best
}

/** 玩家拾取道具：写入 playerBuffs 列表（同种 buff 续期而非叠加）。 */
function grantItemBuff(room, playerId, itemKind) {
  if (!ITEM_TYPES[itemKind]) return
  if (!room.gameState.playerBuffs[playerId]) {
    room.gameState.playerBuffs[playerId] = []
  }
  const list = room.gameState.playerBuffs[playerId]
  const idx = list.findIndex(buff => buff.type === itemKind)
  const now = Date.now()
  if (idx >= 0) {
    list[idx].expiresAt = now + BUFF_DURATION_MS
    list[idx].appliedAt = now
  } else {
    list.push({ type: itemKind, appliedAt: now, expiresAt: now + BUFF_DURATION_MS })
  }
}

/** 每 tick 清理已过期 buff。 */
function expirePlayerBuffs(room, now) {
  const all = room.gameState.playerBuffs || {}
  Object.keys(all).forEach(playerId => {
    all[playerId] = all[playerId].filter(buff => buff.expiresAt > now)
    if (all[playerId].length === 0) delete all[playerId]
  })
}

/** 瘟疫：每 tick 随机 1 个非障碍有主领地 -1 兵。 */
function applyPlague(room) {
  if (getWeatherEffect(room, 'decay') !== 1) return
  const targets = room.gameState.territories.filter(t => !t.isObstacle && t.ownerId && t.units > 0)
  if (targets.length === 0) return
  const pick = targets[Math.floor(Math.random() * targets.length)]
  pick.units = Math.max(0, pick.units - 1)
  if (pick.units === 0) {
    pick.ownerId = null
    pick.isCapital = false
  }
}

/** 地震：每 WEATHER_EARTHQUAKE_INTERVAL_MS 随机 1 个非障碍领地减 30% 兵。 */
function applyEarthquake(room, now) {
  if (!room.gameState.weather) return
  if (getWeatherEffect(room, 'periodicShake') === null) return
  if (now - room.gameState.weather.lastEarthquakeAt < WEATHER_EARTHQUAKE_INTERVAL_MS) return
  room.gameState.weather.lastEarthquakeAt = now
  const targets = room.gameState.territories.filter(t => !t.isObstacle && t.units > 0)
  if (targets.length === 0) return
  const pick = targets[Math.floor(Math.random() * targets.length)]
  const loss = Math.ceil(pick.units * WEATHER_TYPES.earthquake.periodicShake)
  pick.units = Math.max(0, pick.units - loss)
  if (pick.units === 0) {
    pick.ownerId = null
    pick.isCapital = false
  }
}

/** 道具定时重生：每隔 ITEM_RESPAWN_INTERVAL_MS 补一个随机空位道具。 */
function tickItemRespawn(room, now) {
  if (now < room.gameState.nextItemRespawnAt) return
  room.gameState.nextItemRespawnAt = now + ITEM_RESPAWN_INTERVAL_MS
  if (room.gameState.items.length >= INITIAL_ITEM_COUNT) return
  // 用已生成的 territories 列表（含已存在的道具节点）做空位判断
  const seed = `${room.gameState.seed || 'respawn'}-${now}`
  const rng = createRng(seed)
  const newItems = spawnItems(room.gameState.territories, rng, 1)
  if (newItems.length === 0) return
  room.gameState.territories.push(...newItems)
  room.gameState.items.push(...newItems)
  // 把新道具的边补进图
  const newEdges = createEdges(newItems)
  // 仅加入与现有节点相关的边
  const existingNodeIds = new Set(room.gameState.edges.flatMap(e => [e.from, e.to]))
  newEdges.forEach(e => {
    if (existingNodeIds.has(e.from) || existingNodeIds.has(e.to)) {
      // createEdges 在全图里建边，只取一端在原图且另一端是新道具的
      // 这里更稳妥：直接重建
    }
  })
  // 简单做法：重建全图边
  room.gameState.edges = createEdges(room.gameState.territories)
}

function removeItem(room, itemId) {
  room.gameState.territories = room.gameState.territories.filter(t => t.id !== itemId)
  room.gameState.items = room.gameState.items.filter(t => t.id !== itemId)
  // 移除与该节点相关的边
  room.gameState.edges = room.gameState.edges.filter(e => e.from !== itemId && e.to !== itemId)
}

/** 派兵时按概率触发一次遭遇。使用 seed-based rng 让测试可重放。 */
function rollEncounter(room, now) {
  // 用 room seed + 派兵计数 + now 派生一个确定性 rng
  if (!room.__encounterCounter) room.__encounterCounter = 0
  room.__encounterCounter += 1
  const seedStr = `${room.gameState.seed || 'no-seed'}|enc|${room.__encounterCounter}|${now}`
  const rng = createRng(seedStr)
  if (rng() >= ENCOUNTER_CHANCE) return null
  const keys = Object.keys(ENCOUNTER_TYPES)
  return keys[Math.floor(rng() * keys.length)]
}

/** 计算一段行军的基础耗时：源 × 玩家 buff × 天气 + 遭遇延迟 */
function computeBaseTravelTime(encounterDelay, sourceMarch, playerMarch, weatherMarch) {
  const multiplier = (sourceMarch || 1) * (playerMarch || 1) * (weatherMarch || 1)
  const base = TRAVEL_TIME_PER_EDGE / multiplier
  return base * (1 + (encounterDelay || 0))
}

/** 计算一段行军后续 step 的耗时（天气随时可能切换，重新读取） */
function computeTravelDuration(room, troop, weatherMarchMultiplier) {
  const sourceMarch = troop.sourceMarchMultiplier || 1
  const playerMarch = getPlayerBuffEffect(room, troop.playerId, 'marchSpeedMultiplier') || 1
  return computeBaseTravelTime(0, sourceMarch, playerMarch, weatherMarchMultiplier)
}

function touch(room) {
  room.updatedAt = Date.now()
}
