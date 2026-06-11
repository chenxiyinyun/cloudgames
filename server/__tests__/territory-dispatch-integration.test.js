import { describe, it, expect } from 'vitest'
import { createRoomManager } from '../roomManager.js'
import { getGameAdapter } from '../games/index.js'
import { C2S, S2C } from '../protocol.js'

let codeSeq = 0
function generateRoomCode() {
  codeSeq += 1
  return `INT${String(codeSeq).padStart(2, '0')}`
}

function makeConn() {
  const messages = []
  return {
    roomCode: null,
    playerId: null,
    send: (obj) => messages.push(JSON.parse(JSON.stringify(obj))),
    messages,
    last() { return messages[messages.length - 1]; },
    ofType(type) { return messages.filter(m => m.type === type) }
  }
}

// 每个测试独立的 clock,避免并行测试间共享状态导致时序竞争
function setupWithClock() {
  const clock = { now: 1_000_000 }
  const manager = createRoomManager({
    getGameAdapter,
    generateRoomCode,
    now: () => clock.now
  })
  const host = makeConn()
  const guest = makeConn()
  manager.handleMessage(host, { type: C2S.CREATE, gameId: 'territory', playerId: 'h1', playerName: 'Host' })
  const roomCode = host.last().roomCode
  manager.handleMessage(guest, { type: C2S.JOIN, roomCode, playerId: 'g1', playerName: 'Guest' })
  manager.handleMessage(host, { type: C2S.INTENT, action: 'START_GAME' })
  return { manager, host, guest, roomCode, clock }
}

function serverState(manager, roomCode) {
  return manager.rooms.get(roomCode).state
}

describe('territory-control: end-to-end dispatch integration', () => {
  it('dispatches correct amount: 50% of 40 units = 20', () => {
    const { manager, host, roomCode } = setupWithClock()
    const srv = serverState(manager, roomCode)
    const source = srv.gameState.territories.find(t => t.ownerId === 'h1')
    const target = srv.gameState.territories.find(t => t.ownerId !== 'h1' && !t.isObstacle)
    source.units = 40

    host.messages.length = 0
    manager.handleMessage(host, {
      type: C2S.INTENT,
      action: 'DISPATCH_UNITS',
      payload: { sourceId: source.id, targetId: target.id, ratio: 0.5 }
    })

    const latest = host.ofType(S2C.STATE).at(-1).room
    expect(latest.gameState.movingTroops).toHaveLength(1)
    expect(latest.gameState.movingTroops[0].amount).toBe(20)
    expect(latest.gameState.movingTroops[0].path[0]).toBe(source.id)
    expect(latest.gameState.movingTroops[0].path.at(-1)).toBe(target.id)
    expect(source.units).toBe(20)
  })

  it('rejects dispatching from a territory you do not own', () => {
    const { manager, guest, roomCode } = setupWithClock()
    const srv = serverState(manager, roomCode)
    const hostTerritory = srv.gameState.territories.find(t => t.ownerId === 'h1')
    const target = srv.gameState.territories.find(t => t.ownerId === 'g1' && !t.isObstacle)
    hostTerritory.units = 30
    guest.messages.length = 0

    manager.handleMessage(guest, {
      type: C2S.INTENT,
      action: 'DISPATCH_UNITS',
      payload: { sourceId: hostTerritory.id, targetId: target.id, ratio: 0.5 }
    })

    expect(guest.last().type).toBe(S2C.ERROR)
    expect(guest.last().message).toContain('自己')
  })

  it('moving troop arrives and resolves combat after travel time', () => {
    const { manager, host, roomCode, clock } = setupWithClock()
    const srv = serverState(manager, roomCode)
    const source = srv.gameState.territories.find(t => t.ownerId === 'h1')
    // 选 source 的邻居作为 target,确保路径只有 2 步 [source, target]
    const edge = srv.gameState.edges.find(
      e => (e.from === source.id && !srv.gameState.territories.find(t => t.id === e.to)?.isObstacle)
        || (e.to === source.id && !srv.gameState.territories.find(t => t.id === e.from)?.isObstacle)
    )
    expect(edge).toBeTruthy()
    const targetId = edge.from === source.id ? edge.to : edge.from
    const target = srv.gameState.territories.find(t => t.id === targetId)
    source.units = 40
    target.units = 6
    target.ownerId = null
    host.messages.length = 0

    manager.handleMessage(host, {
      type: C2S.INTENT,
      action: 'DISPATCH_UNITS',
      payload: { sourceId: source.id, targetId: target.id, ratio: 0.5 }
    })

    // 推进足够多的 tick(路径只有 2 步 → 最多 2 个 travel time)
    let safety = 10
    while (host.ofType(S2C.STATE).at(-1).room.gameState.movingTroops.length > 0 && safety > 0) {
      clock.now += 1000
      manager.tickAll()
      safety -= 1
    }
    expect({
      safety,
      remaining: host.ofType(S2C.STATE).at(-1).room.gameState.movingTroops
    }).toEqual({
      safety: expect.any(Number),
      remaining: []
    })
    expect(safety).toBeGreaterThan(0)

    const finalState = host.ofType(S2C.STATE).at(-1).room
    expect(finalState.gameState.movingTroops).toHaveLength(0)
    expect(finalState.gameState.territories.find(t => t.id === target.id).ownerId).toBe('h1')
  })

  it('rejects dispatch when resulting amount would round down to 0', () => {
    const { manager, host, roomCode } = setupWithClock()
    const srv = serverState(manager, roomCode)
    const source = srv.gameState.territories.find(t => t.ownerId === 'h1')
    const target = srv.gameState.territories.find(t => t.ownerId !== 'h1' && !t.isObstacle)
    source.units = 1
    host.messages.length = 0

    manager.handleMessage(host, {
      type: C2S.INTENT,
      action: 'DISPATCH_UNITS',
      payload: { sourceId: source.id, targetId: target.id, ratio: 0.25 }
    })

    expect(host.last().type).toBe(S2C.ERROR)
    expect(host.last().message).toContain('兵力不足')
  })
})