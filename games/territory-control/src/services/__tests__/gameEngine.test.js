import { describe, expect, it } from 'vitest'
import {
  GAME_PHASES,
  MAP_SIZES,
  addPlayerToRoom,
  createInitialRoom,
  dispatchUnits,
  endGame,
  findPath,
  neutralizeLongOfflinePlayers,
  restartGame,
  setMapSize,
  startGame,
  tickMovingTroops,
  tickProduction
} from '../gameEngine'

function makeRoom(playerCount = 2) {
  const room = createInitialRoom('p1', 'Ada', 'ABC123')
  for (let i = 2; i <= playerCount; i += 1) {
    addPlayerToRoom(room, `P${i}`, `p${i}`)
  }
  return room
}

function findEnemyEdge(room, playerId) {
  const own = room.gameState.territories.filter(t => t.ownerId === playerId)
  for (const territory of own) {
    const edge = room.gameState.edges.find(candidate =>
      candidate.from === territory.id || candidate.to === territory.id
    )
    if (!edge) continue
    const targetId = edge.from === territory.id ? edge.to : edge.from
    const target = room.gameState.territories.find(t => t.id === targetId)
    if (target && target.ownerId !== playerId) {
      return { source: territory, target }
    }
  }
  return null
}

function dispatchAndArrive(room, playerId, sourceId, targetId, ratio, now) {
  const result = dispatchUnits(room, playerId, sourceId, targetId, ratio, now)
  if (result.error) return result
  // 推进时间直到所有移动部队到达
  let safety = 20
  while (room.gameState.movingTroops.length > 0 && safety > 0) {
    now += 1000
    tickProduction(room, now)
    safety -= 1
  }
  return result
}

describe('territory control engine', () => {
  it('creates a room with a host player', () => {
    const room = createInitialRoom('p1', 'Ada', 'ABC123')

    expect(room.hostId).toBe('p1')
    expect(room.players).toHaveLength(1)
    expect(room.phase).toBe(GAME_PHASES.WAITING)
  })

  it('accepts two to four players and rejects a fifth', () => {
    const room = makeRoom(4)

    expect(room.players).toHaveLength(4)
    const result = addPlayerToRoom(room, 'Extra', 'p5')
    expect(result.error).toBe('房间已满，最多 4 人')
  })

  it.each(Object.entries(MAP_SIZES))('starts %s maps with the configured territory count', (mapSize, config) => {
    const room = makeRoom(3)
    setMapSize(room, mapSize)

    const result = startGame(room, { seed: `seed-${mapSize}` })

    expect(result.error).toBeUndefined()
    expect(room.phase).toBe(GAME_PHASES.PLAYING)
    expect(room.gameState.mapSize).toBe(mapSize)
    expect(room.gameState.territories).toHaveLength(config.territoryCount)
    expect(room.gameState.edges.length).toBeGreaterThanOrEqual(config.territoryCount - 1)
    for (const player of room.players) {
      expect(room.gameState.territories.some(t => t.ownerId === player.id && t.isCapital)).toBe(true)
    }
  })

  it('requires at least two online players to start', () => {
    const room = createInitialRoom('p1', 'Ada', 'ABC123')
    const result = startGame(room)

    expect(result.error).toBe('需要 2 到 4 名在线玩家')
  })

  it('produces one unit per owned territory every 2 ticks', () => {
    const room = makeRoom(2)
    startGame(room, { seed: 'production' })
    const owned = room.gameState.territories.filter(t => t.ownerId)
    const before = owned.map(t => t.units)

    // 第1个tick不产出
    tickProduction(room, 2000)
    owned.forEach((territory, index) => {
      expect(territory.units).toBe(before[index])
    })

    // 第2个tick产出
    tickProduction(room, 3000)
    owned.forEach((territory, index) => {
      expect(territory.units).toBe(before[index] + 1)
    })
  })

  it('dispatches units to a neutral territory and captures it on surplus', () => {
    const room = makeRoom(2)
    startGame(room, { seed: 'capture-neutral' })
    const pair = findEnemyEdge(room, 'p1')
    pair.source.units = 40
    pair.target.ownerId = null
    pair.target.units = 6

    dispatchAndArrive(room, 'p1', pair.source.id, pair.target.id, 0.5, 3000)

    // 派兵后 source 剩 20，但 dispatchAndArrive 推进了时间(生产+1)
    expect(pair.source.units).toBe(21)
    expect(pair.target.ownerId).toBe('p1')
    expect(pair.target.units).toBe(14)
  })

  it('only reduces a defended territory when attack is not enough', () => {
    const room = makeRoom(2)
    startGame(room, { seed: 'defended' })
    const pair = findEnemyEdge(room, 'p1')
    pair.source.units = 20
    pair.target.ownerId = 'p2'
    pair.target.units = 14

    dispatchAndArrive(room, 'p1', pair.source.id, pair.target.id, 0.5, 3000)

    // 派兵后 source 剩 10，但 dispatchAndArrive 推进了时间(生产+1)
    expect(pair.source.units).toBe(11)
    expect(pair.target.ownerId).toBe('p2')
    // 14 - 10 = 4，加上1次生产 = 5
    expect(pair.target.units).toBe(5)
  })

  it('allows dispatching to connected territory via edges', () => {
    const room = makeRoom(2)
    startGame(room, { seed: 'long-range' })
    const pair = findEnemyEdge(room, 'p1')
    pair.source.units = 30
    pair.target.ownerId = null
    pair.target.units = 4

    const path = findPath(room.gameState.edges, pair.source.id, pair.target.id)
    expect(path).not.toBeNull()

    dispatchAndArrive(room, 'p1', pair.source.id, pair.target.id, 0.5, 3000)

    expect(pair.target.ownerId).toBe('p1')
    expect(pair.target.units).toBe(11)
  })

  it('rejects dispatching to unreachable territory', () => {
    const room = makeRoom(2)
    startGame(room, { seed: 'unreachable' })
    const source = room.gameState.territories.find(t => t.ownerId === 'p1')
    source.units = 30

    // 清空所有边，使目标不可达
    room.gameState.edges = []

    const target = room.gameState.territories.find(t => t.id !== source.id)
    const result = dispatchUnits(room, 'p1', source.id, target.id, 0.5, 3000)
    expect(result.error).toBe('目标领地不可达')
  })

  it('creates moving troops with path on dispatch', () => {
    const room = makeRoom(2)
    startGame(room, { seed: 'moving' })
    const pair = findEnemyEdge(room, 'p1')
    pair.source.units = 40

    const result = dispatchUnits(room, 'p1', pair.source.id, pair.target.id, 0.5, 3000)

    expect(result.error).toBeUndefined()
    expect(result.amount).toBe(20)
    expect(room.gameState.movingTroops).toHaveLength(1)
    expect(room.gameState.movingTroops[0].amount).toBe(20)
    expect(room.gameState.movingTroops[0].path[0]).toBe(pair.source.id)
    expect(room.gameState.movingTroops[0].path[room.gameState.movingTroops[0].path.length - 1]).toBe(pair.target.id)
  })

  it('moving troops arrive and resolve combat after travel time', () => {
    const room = makeRoom(2)
    startGame(room, { seed: 'travel' })
    const pair = findEnemyEdge(room, 'p1')
    pair.source.units = 40
    pair.target.ownerId = null
    pair.target.units = 6

    dispatchUnits(room, 'p1', pair.source.id, pair.target.id, 0.5, 3000)
    expect(room.gameState.movingTroops).toHaveLength(1)

    // 还没到时间 → 不结算 (到达时间 = 3000 + 1500 = 4500)
    tickProduction(room, 4000)
    expect(room.gameState.movingTroops).toHaveLength(1)

    // 到达时间 → 结算
    tickProduction(room, 5001)
    expect(room.gameState.movingTroops).toHaveLength(0)
    expect(pair.target.ownerId).toBe('p1')
    expect(pair.target.units).toBe(14)
  })

  it('moving troops pass through friendly territory', () => {
    const room = makeRoom(2)
    startGame(room, { seed: 'pass-through' })
    // 找一条经过友方领地的路径
    const p1Territories = room.gameState.territories.filter(t => t.ownerId === 'p1')
    const p2Territories = room.gameState.territories.filter(t => t.ownerId === 'p2')

    // 找一个 p1 领地能经过另一个 p1 领地到达 p2 领地的路径
    let source = null
    let intermediate = null
    let target = null
    for (const s of p1Territories) {
      for (const i of p1Territories) {
        if (s.id === i.id) continue
        for (const t of p2Territories) {
          const path = findPath(room.gameState.edges, s.id, t.id)
          if (path && path.length >= 3 && path.includes(i.id)) {
            source = s
            intermediate = i
            target = t
          }
        }
      }
    }

    if (!source || !intermediate || !target) return

    source.units = 40
    intermediate.units = 10
    target.units = 5

    const path = findPath(room.gameState.edges, source.id, target.id)
    expect(path.length).toBeGreaterThanOrEqual(3)

    dispatchUnits(room, 'p1', source.id, target.id, 0.5, 3000)
    expect(room.gameState.movingTroops).toHaveLength(1)

    // 推进时间直到到达
    let now = 3000
    let safety = 20
    while (room.gameState.movingTroops.length > 0 && safety > 0) {
      now += 1000
      tickProduction(room, now)
      safety -= 1
    }

    // 部队应到达目标并攻占
    expect(target.ownerId).toBe('p1')
  })

  it('reinforces a friendly connected territory', () => {
    const room = makeRoom(2)
    startGame(room, { seed: 'reinforce-friendly' })
    const pair = findEnemyEdge(room, 'p1')
    pair.source.units = 30
    pair.target.ownerId = 'p1'
    pair.target.units = 10

    dispatchUnits(room, 'p1', pair.source.id, pair.target.id, 0.5, 3000)
    tickMovingTroops(room, 5001)

    expect(pair.target.ownerId).toBe('p1')
    expect(pair.target.units).toBe(25)
  })

  it('ends when one player controls all remaining owned territory', () => {
    const room = makeRoom(2)
    startGame(room, { seed: 'victory' })
    const p2Territories = room.gameState.territories.filter(t => t.ownerId === 'p2')
    p2Territories.forEach(t => {
      t.ownerId = 'p1'
      t.units = 1
    })

    tickProduction(room, 4000)

    expect(room.phase).toBe(GAME_PHASES.ENDED)
    expect(room.gameState.winnerId).toBe('p1')
  })

  it('resets to lobby on restart', () => {
    const room = makeRoom(2)
    startGame(room, { seed: 'restart' })

    restartGame(room)

    expect(room.phase).toBe(GAME_PHASES.WAITING)
    expect(room.gameState.territories).toEqual([])
    expect(room.gameState.movingTroops).toEqual([])
    expect(room.players.every(p => !p.isEliminated)).toBe(true)
  })

  it('skips production for offline owners', () => {
    const room = makeRoom(2)
    startGame(room, { seed: 'offline-prod' })
    const p1Territory = room.gameState.territories.find(t => t.ownerId === 'p1')
    const p2Territory = room.gameState.territories.find(t => t.ownerId === 'p2')
    const p1Before = p1Territory.units
    const p2Before = p2Territory.units

    // 标记 p1 离线(模拟 createNetworkLayer 的 markOffline 副作用)
    const p1 = room.players.find(p => p.id === 'p1')
    p1.isOnline = false

    // 需要2个tick才产出1次
    tickProduction(room, 5000)
    tickProduction(room, 6000)

    // p1 离线 → 不 +1
    expect(p1Territory.units).toBe(p1Before)
    // p2 在线 → 正常 +1
    expect(p2Territory.units).toBe(p2Before + 1)

    // p1 恢复在线 → 再过2个tick应该 +1
    p1.isOnline = true
    tickProduction(room, 7000)
    tickProduction(room, 8000)
    expect(p1Territory.units).toBe(p1Before + 1)
  })

  it('neutralizes long-offline players and removes them from disconnectedPlayers', () => {
    const room = makeRoom(2)
    startGame(room, { seed: 'neutralize' })
    const p1 = room.players.find(p => p.id === 'p1')
    p1.isOnline = false
    room.disconnectedPlayers.push({ id: 'p1', name: 'Ada', disconnectedAt: 1000 })

    // 30s 还在容忍窗内 → 不应被中立化
    const earlyResult = neutralizeLongOfflinePlayers(room, 30000, 60000)
    expect(earlyResult).toEqual([])
    expect(p1.isEliminated).toBe(false)
    const p1Territory = room.gameState.territories.find(t => t.ownerId === 'p1')
    expect(p1Territory).toBeDefined()

    // 61s → 超时,被中立化
    const lateResult = neutralizeLongOfflinePlayers(room, 62000, 60000)
    expect(lateResult).toEqual(['p1'])
    expect(p1.isEliminated).toBe(true)
    expect(room.gameState.territories.every(t => t.ownerId !== 'p1')).toBe(true)
    // 已处理的 disconnectedPlayers 条目应被移除(避免下次重复处理)
    expect(room.disconnectedPlayers.find(d => d.id === 'p1')).toBeUndefined()
  })

  it('does not neutralize online players even with stale disconnected entry', () => {
    const room = makeRoom(2)
    startGame(room, { seed: 'stale-dc' })
    const p1 = room.players.find(p => p.id === 'p1')
    room.disconnectedPlayers.push({ id: 'p1', name: 'Ada', disconnectedAt: 0 })
    // p1 现在重新在线(典型 reconnect 场景)
    p1.isOnline = true

    const result = neutralizeLongOfflinePlayers(room, 999999, 60000)

    expect(result).toEqual([])
    expect(p1.isEliminated).toBe(false)
  })

  it('triggers endGame when only one online player owns territory after neutralization', () => {
    const room = makeRoom(2)
    startGame(room, { seed: 'win-by-dc' })
    const p1 = room.players.find(p => p.id === 'p1')
    p1.isOnline = false
    room.disconnectedPlayers.push({ id: 'p1', name: 'Ada', disconnectedAt: 0 })

    neutralizeLongOfflinePlayers(room, 70000, 60000)

    // p1 的 territory 全被中立化,p2 是唯一有 territory 的玩家 → 胜利
    expect(room.phase).toBe(GAME_PHASES.ENDED)
    expect(room.gameState.winnerId).toBe('p2')
  })

  it('rejects joining when game already in progress', () => {
    const room = makeRoom(2)
    startGame(room, { seed: 'late-join' })
    const result = addPlayerToRoom(room, 'Late', 'p3')
    expect(result.error).toBe('战局已经开始')
  })

  it('rejects setMapSize when game already in progress', () => {
    const room = makeRoom(2)
    startGame(room, { seed: 'resize' })
    const result = setMapSize(room, 'large')
    expect(result.error).toBe('战局开始后不能修改地图')
  })

  it('caps dispatched units at MAX_UNITS (50) when capturing a weak enemy', () => {
    const room = makeRoom(2)
    startGame(room, { seed: 'cap-50' })
    const pair = findEnemyEdge(room, 'p1')
    pair.source.units = 300        // 300 * 0.5 = 150 应被 cap 到 50 - target.units
    pair.target.units = 2
    pair.target.ownerId = 'p2'

    dispatchAndArrive(room, 'p1', pair.source.id, pair.target.id, 0.5, 3000)

    // 攻占后 territory.units = min(50, 150 - 2) = 50
    expect(pair.target.ownerId).toBe('p1')
    expect(pair.target.units).toBe(50)
  })

  it('caps friendly reinforcement at MAX_UNITS (50)', () => {
    const room = makeRoom(2)
    startGame(room, { seed: 'cap-friendly' })
    const own = room.gameState.territories.filter(t => t.ownerId === 'p1')
    const source = own[0]
    const target = own[1] || own[0]
    if (target === source) {
      return
    }
    source.units = 200
    target.units = 45
    target.ownerId = 'p1'

    dispatchAndArrive(room, 'p1', source.id, target.id, 0.5, 3000)

    // 友方增援 100 + target.units 45 = 145 → cap 到 50
    expect(target.units).toBe(50)
  })

  it('rejects dispatching from territory you do not own', () => {
    const room = makeRoom(2)
    startGame(room, { seed: 'cheat' })
    const pair = findEnemyEdge(room, 'p1')
    // p1 试着从 p2 的领地派兵
    const p2Territory = room.gameState.territories.find(t => t.ownerId === 'p2')
    const result = dispatchUnits(room, 'p1', p2Territory.id, pair.target.id, 0.5, 3000)
    expect(result.error).toBe('只能从自己的领地派遣')
  })

  it('rejects dispatching with zero troops (amount <= 0)', () => {
    const room = makeRoom(2)
    startGame(room, { seed: 'zero' })
    const own = room.gameState.territories.find(t => t.ownerId === 'p1')
    own.units = 1  // 1 * 0.5 = 0(向下取整)
    const neutral = room.gameState.territories.find(t => !t.ownerId && t.id !== own.id)
    const result = dispatchUnits(room, 'p1', own.id, neutral.id, 0.5, 3000)
    expect(result.error).toBe('兵力不足')
  })

  it('handles 4-player game with mixed dispatch and victory', () => {
    const room = createInitialRoom('p1', 'Ada', 'ABCD')
    addPlayerToRoom(room, 'Ben', 'p2')
    addPlayerToRoom(room, 'Cee', 'p3')
    addPlayerToRoom(room, 'Dan', 'p4')
    const result = startGame(room, { seed: '4p-mix' })
    expect(result.error).toBeUndefined()
    expect(room.players).toHaveLength(4)
    // 4 个 capital
    const capitals = room.gameState.territories.filter(t => t.isCapital)
    expect(capitals).toHaveLength(4)
    // 任意一个玩家被消灭 → 还剩 3 个,继续
    const p1Territory = room.gameState.territories.find(t => t.ownerId === 'p1')
    p1Territory.ownerId = 'p2'
    p1Territory.units = 1
    tickProduction(room, 2000)
    expect(room.players.find(p => p.id === 'p1').isEliminated).toBe(true)
    expect(room.phase).toBe(GAME_PHASES.PLAYING)
  })

  it('endGame marks phase ended and records winnerId', () => {
    const room = makeRoom(2)
    startGame(room, { seed: 'endgame' })
    endGame(room, 'p1', 5000)
    expect(room.phase).toBe(GAME_PHASES.ENDED)
    expect(room.gameState.winnerId).toBe('p1')
    expect(room.gameState.endedAt).toBe(5000)
  })

  it('chooseSpawnIndexes randomizes corner order (non-deterministic across seeds)', () => {
    // 同一 playerCount=2 + 不同 seed → 应该拿到不同的 (corner 配对)
    // 直接通过 startGame 的 territory.x/y 间接验证: 两次开局,capital 坐标至少一对不同
    const samples = []
    for (let i = 0; i < 5; i += 1) {
      const room = makeRoom(2)
      startGame(room, { seed: `rand-${i}` })
      const capitals = room.gameState.territories
        .filter(t => t.isCapital)
        .map(t => `${t.x},${t.y}`)
        .sort()
      samples.push(capitals.join('|'))
    }
    const unique = new Set(samples)
    // 5 次开局应至少出现 2 种不同配对
    expect(unique.size).toBeGreaterThanOrEqual(2)
  })

  it('findPath returns null for disconnected nodes', () => {
    const edges = [{ from: 'a', to: 'b' }]
    expect(findPath(edges, 'a', 'c')).toBeNull()
  })

  it('findPath returns null for same source and target', () => {
    const edges = [{ from: 'a', to: 'b' }]
    expect(findPath(edges, 'a', 'a')).toBeNull()
  })

  it('findPath finds shortest path', () => {
    const edges = [
      { from: 'a', to: 'b' },
      { from: 'b', to: 'c' },
      { from: 'a', to: 'c' }
    ]
    // a→c 直接连接是最短路径
    const path = findPath(edges, 'a', 'c')
    expect(path).toEqual(['a', 'c'])
  })

  it('findPath finds multi-hop path when no direct edge', () => {
    const edges = [
      { from: 'a', to: 'b' },
      { from: 'b', to: 'c' }
    ]
    const path = findPath(edges, 'a', 'c')
    expect(path).toEqual(['a', 'b', 'c'])
  })
})
