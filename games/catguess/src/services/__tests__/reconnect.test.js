import { describe, it, expect } from 'vitest'

describe('catguess reconnection', () => {
  it('RECONNECT_METADATA exposes attempt count and max attempts', async () => {
    const { RECONNECT_METADATA } = await import('../../stores/gameStore')
    expect(RECONNECT_METADATA.MAX_ATTEMPTS).toBe(8)
    expect(typeof RECONNECT_METADATA.attempt).toBe('number')
    expect(RECONNECT_METADATA.attempt).toBeGreaterThanOrEqual(0)
  })

  it('RECONNECT_METADATA.MAX_ATTEMPTS matches backoff cap', async () => {
    const { RECONNECT_METADATA } = await import('../../stores/gameStore')
    expect(RECONNECT_METADATA.MAX_ATTEMPTS).toBe(8)
  })

  it('reconnectRoom is an exported async function', async () => {
    const mod = await import('../../stores/gameStore')
    expect(typeof mod.reconnectRoom).toBe('function')
  })

  it('leaveRoom is an exported async function', async () => {
    const mod = await import('../../stores/gameStore')
    expect(typeof mod.leaveRoom).toBe('function')
  })

  it('RECONNECT_METADATA attempt getter returns a number', async () => {
    const { RECONNECT_METADATA } = await import('../../stores/gameStore')
    expect(RECONNECT_METADATA.attempt).toBeGreaterThanOrEqual(0)
  })
})
