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

  it('ignores remote start requests from guests', async () => {
    await store.createRoom('Host')
    network.handleHostMessage({
      type: 'JOIN_REQUEST',
      payload: {
        playerId: 'p2',
        playerName: 'Guest',
        originalPeerId: 'guest-peer'
      }
    }, 'guest-peer')

    network.handleHostMessage({
      type: 'START_GAME',
      payload: {
        roomCode: 'ABC123',
        playerId: 'p2',
        options: { seed: 'guest-forged-start' }
      }
    }, 'guest-peer')

    expect(state.getRoom().phase).toBe('waiting')
    expect(state.getRoom().gameState.modules).toEqual([])
    expect(p2pMock.broadcast).not.toHaveBeenCalledWith('START_GAME', expect.anything())
  })

  it('accepts a repeated join request for the same cached player id as a reconnect', async () => {
    await store.createRoom('Host')
    network.handleHostMessage({
      type: 'JOIN_REQUEST',
      payload: {
        playerId: 'p2',
        playerName: 'Guest',
        originalPeerId: 'guest-peer'
      }
    }, 'guest-peer')

    network.handleHostMessage({
      type: 'JOIN_REQUEST',
      payload: {
        playerId: 'p2',
        playerName: 'Guest Back',
        originalPeerId: 'guest-peer-reconnect',
        isReconnect: true
      }
    }, 'guest-peer-reconnect')

    expect(state.getRoom().players).toHaveLength(2)
    expect(state.getRoom().players[1]).toEqual(expect.objectContaining({
      id: 'p2',
      name: 'Guest Back',
      isOnline: true,
      _peerId: 'guest-peer-reconnect'
    }))
    expect(p2pMock.sendTo).toHaveBeenLastCalledWith('guest-peer-reconnect', 'JOIN_RESPONSE', {
      success: true,
      room: expect.objectContaining({
        players: expect.arrayContaining([
          expect.objectContaining({ id: 'p2', name: 'Guest Back' })
        ])
      })
    })
  })

  it('responds to repeated join retries without adding duplicate players', async () => {
    await store.createRoom('Host')
    const joinRequest = {
      type: 'JOIN_REQUEST',
      payload: {
        playerId: 'p2',
        playerName: 'Guest',
        originalPeerId: 'guest-peer'
      }
    }

    network.handleHostMessage(joinRequest, 'guest-peer')
    p2pMock.sendTo.mockClear()
    p2pMock.broadcast.mockClear()

    network.handleHostMessage(joinRequest, 'guest-peer')

    expect(state.getRoom().players).toHaveLength(2)
    expect(p2pMock.sendTo).toHaveBeenCalledWith('guest-peer', 'JOIN_RESPONSE', {
      success: true,
      room: expect.objectContaining({
        players: expect.arrayContaining([
          expect.objectContaining({ id: 'p2', name: 'Guest' })
        ])
      })
    })
    expect(p2pMock.broadcast).toHaveBeenCalledWith('ROOM_STATE', expect.objectContaining({
      room: expect.objectContaining({
        players: expect.arrayContaining([
          expect.objectContaining({ id: 'p2', name: 'Guest' })
        ])
      })
    }))
  })

  it('handles a remote defuser flow from strike to solved result and broadcasts updates', async () => {
    await store.createRoom('Host')
    network.handleHostMessage({
      type: 'JOIN_REQUEST',
      payload: {
        playerId: 'p2',
        playerName: 'Guest',
        originalPeerId: 'guest-peer'
      }
    }, 'guest-peer')

    const started = store.handleStartGame({
      seed: 'remote-flow',
      roleByPlayerId: {
        [store.gameState.playerId]: 'expert',
        p2: 'defuser'
      }
    })
    expect(started).toBe(true)

    network.handleHostMessage({
      type: 'SUBMIT_MODULE_ACTION',
      payload: {
        roomCode: 'ABC123',
        playerId: 'p2',
        moduleId: 'wires-1',
        action: {
          type: 'cut_wire',
          wireId: 'wrong-wire'
        }
      }
    }, 'guest-peer')

    expect(state.getRoom().gameState.strikes).toHaveLength(1)
    expect(state.getRoom().phase).toBe('playing')

    for (const module of state.getRoom().gameState.modules) {
      network.handleHostMessage({
        type: 'SUBMIT_MODULE_ACTION',
        payload: {
          roomCode: 'ABC123',
          playerId: 'p2',
          moduleId: module.id,
          action: module.solution.action
        }
      }, 'guest-peer')
    }

    expect(state.getRoom().phase).toBe('solved')
    expect(state.getRoom().gameState.result).toBe('solved')
    expect(state.getRoom().gameState.solvedModuleIds).toEqual(['wires-1', 'symbols-1', 'keypad-1'])
    expect(p2pMock.broadcast).toHaveBeenCalledWith('ROOM_STATE', expect.objectContaining({
      room: expect.objectContaining({ phase: 'solved' })
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
    expect(store.gameState.connecting).toBe(false)
    expect(store.gameState.connectionStatus).toBe('connected')
    expect(store.gameState.connectionMessage).toBe('Mission joined.')
    expect(state.getRoom()).toEqual(room)
  })

  it('surfaces rejected join responses and stops connecting', () => {
    store.gameState.connecting = true
    store.gameState.connected = false
    state.setConnectionStatus('connecting', 'Joining mission...')

    network.handleGuestMessage({
      type: 'JOIN_RESPONSE',
      payload: {
        success: false,
        error: '房间已满，需要刚好 2 名玩家'
      }
    })

    expect(store.gameState.connected).toBe(false)
    expect(store.gameState.connecting).toBe(false)
    expect(store.gameState.error).toBe('房间已满，需要刚好 2 名玩家')
    expect(store.gameState.connectionStatus).toBe('error')
    expect(store.gameState.connectionMessage).toBe('房间已满，需要刚好 2 名玩家')
  })
})
