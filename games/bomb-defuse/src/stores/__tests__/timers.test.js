import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { addPlayerToRoom, createInitialRoom, startGame } from '../../services/gameEngine'
import { gameState, resetLocalState, setRoom } from '../state'
import { resetAllTimers, startCountdownTimer } from '../timers'

function createPlayingRoom() {
  const room = createInitialRoom('p1', 'Host', 'ABC123')
  addPlayerToRoom(room, 'Guest', 'p2')
  startGame(room, {
    seed: 'timer-store-test',
    now: Date.now(),
    durationMs: 1000
  })
  return room
}

describe('bomb defuse countdown timer', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(1000)
    resetLocalState()
  })

  afterEach(() => {
    resetAllTimers()
    vi.useRealTimers()
  })

  it('explodes the room only when the deadline has passed', () => {
    const room = createPlayingRoom()
    const onExpired = vi.fn()
    gameState.playerId = 'p1'
    gameState.connected = true
    setRoom(room)

    startCountdownTimer(onExpired)

    vi.advanceTimersByTime(500)
    expect(room.phase).toBe('playing')
    expect(onExpired).not.toHaveBeenCalled()

    vi.advanceTimersByTime(500)
    expect(room.phase).toBe('exploded')
    expect(room.gameState.result).toBe('exploded')
    expect(onExpired).toHaveBeenCalledTimes(1)
  })
})
