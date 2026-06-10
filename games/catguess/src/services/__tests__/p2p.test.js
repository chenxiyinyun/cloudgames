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
  p2p.onConnectionStateChange = null
  p2p._heartbeatInterval = null
  p2p._peerLastSeen = new Map()
  p2p._missedHeartbeats = new Map()
  p2p._disconnectedPeers = new Set()
  p2p._recoveryAttempts = new Map()
  p2p._iceGuardTimers = new Map()
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
      hasTurnRelay: false,
      peers: {}
    })
  })

  it('disconnectPeer() removes only the targeted connection', () => {
    const connA = { peer: 'peer-A', open: true, close: vi.fn() }
    const connB = { peer: 'peer-B', open: true, close: vi.fn() }
    p2p.connections = [connA, connB]

    p2p.disconnectPeer('peer-A')

    // peer-A is closed and removed
    expect(connA.close).toHaveBeenCalled()
    expect(p2p.connections).not.toContain(connA)

    // peer-B is untouched
    expect(connB.close).not.toHaveBeenCalled()
    expect(p2p.connections).toContain(connB)
  })

  it('softDisconnect() closes and clears stale connections', () => {
    const conn = { peer: 'peer-A', open: true, close: vi.fn() }
    p2p.connections = [conn]
    p2p.isHost = true
    p2p.roomCode = 'ABCDEF'
    p2p.playerName = 'Tester'

    p2p.softDisconnect()

    // Peer destroyed, metadata reset
    expect(p2p.isHost).toBe(false)
    expect(p2p.roomCode).toBeNull()
    expect(p2p.playerName).toBeNull()

    expect(conn.close).toHaveBeenCalled()
    expect(p2p.connections.length).toBe(0)
  })

  it('getPeerConnectionState() returns state for specific peer', () => {
    p2p._connectionStates.set('peer-X', {
      mode: 'direct-or-relay',
      iceConnectionState: 'connected',
      connectionState: 'connected'
    })

    const state = p2p.getPeerConnectionState('peer-X')
    expect(state.iceConnectionState).toBe('connected')
  })

  it('getPeerConnectionState() returns default for unknown peer', () => {
    const state = p2p.getPeerConnectionState('unknown')
    expect(state.mode).toBe('direct-or-relay')
  })

  it('onConnectionStateChange defaults to null', () => {
    expect(p2p.onConnectionStateChange).toBeNull()
  })
})
