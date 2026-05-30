import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('peerjs', () => ({
  default: vi.fn()
}))

vi.mock('../logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  })
}))

import p2p from '../p2p'

function resetP2PState() {
  p2p.peer = null
  p2p.connections = []
  p2p.isHost = false
  p2p.roomCode = null
  p2p.playerName = null
  p2p.onMessage = null
  p2p.onPlayerConnected = null
  p2p.onPlayerDisconnected = null
  p2p.onError = null
  p2p.onDeadPeer = null
  p2p._heartbeatInterval = null
  p2p._peerLastSeen = new Map()
  p2p._missedHeartbeats = new Map()
  p2p._disconnectedPeers = new Set()
  p2p._retryQueue = []
  p2p._retryTimer = null
}

describe('catguess P2P adapter', () => {
  beforeEach(() => {
    resetP2PState()
  })

  it('uses the catguess prefix for host peers', () => {
    expect(p2p.getHostPeerId('ABCDEF')).toBe('catguess-ABCDEF')
  })

  it('uses the catguess guest prefix for guest peers', () => {
    expect(p2p.getGuestPeerId()).toMatch(/^catguess-guest-\d+-[a-z0-9]{6}$/)
  })

  it('retains shared sendTo behavior', () => {
    const mockConn = { peer: 'target', open: true, send: vi.fn() }
    p2p.connections = [mockConn]

    expect(p2p.sendTo('target', 'PRIVATE', { key: 'val' })).toBe(true)
    expect(mockConn.send).toHaveBeenCalled()
  })

  it('exposes connection diagnostics', () => {
    expect(p2p.getConnectionDiagnostics()).toMatchObject({
      mode: 'direct-or-relay',
      hasMeteredTurn: false,
      peers: {}
    })
  })
})
