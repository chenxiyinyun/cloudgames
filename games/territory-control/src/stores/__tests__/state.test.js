import { describe, expect, it } from 'vitest'
import { addPlayerToRoom, createInitialRoom, dispatchUnits, startGame, tickProduction } from '../../services/gameEngine'
import { gameState, updateLocalState } from '../state'

function makePlayingRoom(playerCount = 2) {
  const room = createInitialRoom('p1', 'Ada', 'ABC123')
  for (let i = 2; i <= playerCount; i += 1) {
    addPlayerToRoom(room, `P${i}`, `p${i}`)
  }
  startGame(room, { seed: 'state-mirror' })
  return room
}

describe('territory state mirror', () => {
  it('exposes movingTroops in the mirror after dispatch', () => {
    const room = makePlayingRoom(2)
    updateLocalState(room)

    // 先 sanity check: 没派兵时,镜像里 movingTroops 存在且为 []
    expect(Array.isArray(gameState.room.gameState.movingTroops)).toBe(true)
    expect(gameState.room.gameState.movingTroops).toHaveLength(0)

    // 找一对相邻领地(source 必须是 p1 自己的)
    const source = room.gameState.territories.find(t => t.ownerId === 'p1')
    const target = room.gameState.territories.find(t => t.id !== source.id)
    source.units = 30
    target.units = 2
    target.ownerId = null

    const result = dispatchUnits(room, 'p1', source.id, target.id, 0.5, 3000)
    expect(result.error).toBeUndefined()

    // 关键断言:派兵后,镜像里必须能看到这支部队(否则 GameScreen 不会画动画)
    updateLocalState(room)
    expect(gameState.room.gameState.movingTroops).toHaveLength(1)
    expect(gameState.room.gameState.movingTroops[0].amount).toBe(15)
    expect(gameState.room.gameState.movingTroops[0].path[0]).toBe(source.id)
    expect(gameState.room.gameState.movingTroops[0].path.at(-1)).toBe(target.id)
  })

  it('clears movingTroops in the mirror after combat resolves', () => {
    const room = makePlayingRoom(2)
    const source = room.gameState.territories.find(t => t.ownerId === 'p1')
    const target = room.gameState.territories.find(t => t.id !== source.id)
    source.units = 30
    target.units = 2
    target.ownerId = null

    dispatchUnits(room, 'p1', source.id, target.id, 0.5, 3000)
    updateLocalState(room)
    expect(gameState.room.gameState.movingTroops).toHaveLength(1)

    // 推进 3 秒,让部队到达终点并战斗结算
    tickProduction(room, Date.now() + 5000)

    updateLocalState(room)
    expect(gameState.room.gameState.movingTroops).toHaveLength(0)
    // 中立领地被攻占,ownerId 变 p1
    expect(gameState.room.gameState.territories.find(t => t.id === target.id).ownerId).toBe('p1')
  })
})
