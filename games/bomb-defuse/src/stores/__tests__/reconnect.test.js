import { beforeEach, describe, expect, it, vi } from 'vitest'

const p2pMock = {
  generateRoomCode: vi.fn(() => 'ABC123'),
  getHostPeerId: vi.fn(code => `bombdefuse-${code}`),
  getConnectionDiagnostics: vi.fn(() => ({
    mode: 'direct-or-relay',
    hasTurnRelay: false,
    peers: {}
  })),
  getConnectedPeers: vi.fn(() => ['bombdefuse-ABC123']),
  getMyPeerId: vi.fn(() => 'local-peer'),
  createHost: vi.fn(() => Promise.resolve('bombdefuse-ABC123')),
  joinRoom: vi.fn(() => Promise.resolve('guest-peer')),
  sendTo: vi.fn(() => true),
  broadcast: vi.fn(() => true),
  disconnect: vi.fn(),
  softDisconnect: vi.fn(),
  stopHeartbeat: vi.fn(),
  onMessage: null,
  onPlayerDisconnected: null,
  onModeChange: null
}

vi.mock('../../services/p2p', () => ({
  default: p2pMock
}))

vi.mock('../../services/stateCache', () => ({
  saveStateToCache: vi.fn(),
  flushStateCache: vi.fn(),
  cancelPendingSave: vi.fn(),
  loadStateFromCache: vi.fn(() => null),
  clearStateCache: vi.fn(),
  hasCachedState: vi.fn(() => false)
}))

describe('bomb defuse game store networking', () => {
  let store
  let state
  let network

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.resetModules()
    store = await import('../gameStore')
    state = await import('../state')
    network = await import('../network')
    state.resetLocalState()
  })

  it('creates a host room and installs host handlers', async () => {
    const created = await store.createRoom('Host')

    expect(created).toBe(true)
    expect(p2pMock.createHost).toHaveBeenCalledWith('ABC123', 'Host')
    expect(store.gameState.isHost).toBe(true)
    expect(store.gameState.connected).toBe(true)
    expect(store.gameState.screen).toBe('lobby')
    expect(state.getRoom().players[0]._peerId).toBe('bombdefuse-ABC123')
    expect(p2pMock.onMessage).toBe(network.handleHostMessage)
  })

  it('starts the game as host and broadcasts room state', async () => {
    await store.createRoom('Host')
    network.handleHostMessage({
      type: 'JOIN_REQUEST',
      payload: {
        playerId: 'p2',
        playerName: 'Guest',
        originalPeerId: 'guest-peer'
      }
    }, 'guest-peer')

    const started = store.handleStartGame({ seed: 'network-test' })

    expect(started).toBe(true)
    expect(state.getRoom().phase).toBe('playing')
    expect(p2pMock.broadcast).toHaveBeenCalledWith('ROOM_STATE', expect.objectContaining({
      room: expect.objectContaining({ phase: 'playing' })
    }))
  })

  it('sends module actions to the host when current player is a guest', async () => {
    await store.joinRoom('Guest', 'ABC123')

    const sent = store.handleSubmitModuleAction('wires-1', {
      type: 'cut_wire',
      wireId: 'wire-1'
    })

    expect(sent).toBe(true)
    expect(p2pMock.broadcast).toHaveBeenCalledWith('SUBMIT_MODULE_ACTION', {
      roomCode: 'ABC123',
      playerId: store.gameState.playerId,
      moduleId: 'wires-1',
      action: {
        type: 'cut_wire',
        wireId: 'wire-1'
      }
    })
  })

  it('applies JOIN_RESPONSE room state on guests', () => {
    const room = {
      id: 'ABC123',
      code: 'ABC123',
      hostId: 'p1',
      players: [],
      phase: 'waiting',
      status: 'waiting',
      gameState: { modules: [], strikes: [], solvedModuleIds: [], actionLog: [] },
      disconnectedPlayers: []
    }

    network.handleGuestMessage({
      type: 'JOIN_RESPONSE',
      payload: {
        success: true,
        room
      }
    })

    expect(store.gameState.connected).toBe(true)
    expect(state.getRoom()).toEqual(room)
  })
})
