import { beforeEach, describe, expect, it } from 'vitest'
import { createInitialRoom, startGame } from '../../services/gameEngine'
import {
  gameState,
  getRoom,
  resetLocalState,
  setRoom,
  updateLocalState
} from '../state'

describe('bomb defuse room state mirror', () => {
  beforeEach(() => {
    resetLocalState()
  })

  it('stores and returns the host-authoritative room', () => {
    const room = createInitialRoom('p1', 'Host', 'ABC123')

    setRoom(room)

    expect(getRoom()).toBe(room)
  })

  it('mirrors waiting room data into reactive state', () => {
    const room = createInitialRoom('p1', 'Host', 'ABC123')
    gameState.playerId = 'p1'

    updateLocalState(room)

    expect(gameState.roomCode).toBe('ABC123')
    expect(gameState.isHost).toBe(true)
    expect(gameState.room.players).toHaveLength(1)
    expect(gameState.screen).toBe('menu')
  })

  it('moves to the game screen when the room starts playing', () => {
    const room = createInitialRoom('p1', 'Host', 'ABC123')
    room.players.push({
      id: 'p2',
      name: 'Guest',
      isHost: false,
      isOnline: true,
      order: 1,
      role: null
    })
    startGame(room, { seed: 'state-test' })

    gameState.playerId = 'p1'
    gameState.connected = true
    updateLocalState(room)

    expect(gameState.screen).toBe('game')
    expect(gameState.room.gameState.modules).toHaveLength(4)
  })

  it('moves to the result screen when the room has ended', () => {
    const room = createInitialRoom('p1', 'Host', 'ABC123')
    room.phase = 'exploded'
    room.status = 'exploded'
    room.gameState.result = 'exploded'

    updateLocalState(room)

    expect(gameState.screen).toBe('result')
    expect(gameState.room.gameState.result).toBe('exploded')
  })
})
