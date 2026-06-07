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
  startHeartbeat: vi.fn(),
  onDeadPeer: null,
  onMessage: null,
  onPlayerConnected: null,
  onPlayerDisconnected: null,
  onModeChange: null,
  onConnectionStateChange: null,
  onError: null,
  connectToPeer: vi.fn(() => Promise.resolve()),
  getPeerConnectionState: vi.fn(() => null)
}

vi.mock('../../services/p2p', () => ({
  default: p2pMock
}))

vi.mock('../../../../src/shared/online/useHostMigration', () => ({
  createHostMigrationHandler: vi.fn(() => ({
    handleHostDisconnect: vi.fn(() => Promise.resolve()),
    isMigrationInProgress: vi.fn(() => false),
    resetMigrationMutex: vi.fn()
  }))
}))

vi.mock('../../../../src/shared/online/dedupeHandler', () => ({
  createDedupeHandler: vi.fn(() => vi.fn())
}))

vi.mock('../../../../src/shared/online/createNetworkLayer', () => {
  // createNetworkLayer 需要真正执行，但内部依赖的 createHostMigrationHandler 已被 mock
  // 所以我们提供一个简化版的 createNetworkLayer，只 mock auto-reconnect 和 offline manager
  function createNetworkLayer(opts) {
    const hostMigrator = {
      handleHostDisconnect: () => Promise.resolve(),
      isMigrationInProgress: () => false,
      resetMigrationMutex: () => {}
    }

    function setupHostHandlers() {
      opts.p2p.onPlayerConnected = (conn) => {
        if (opts.getRoom()) {
          setTimeout(() => {
            const otherPeers = opts.p2p.getConnectedPeers().filter(id => id !== conn.peer)
            if (otherPeers.length > 0) {
              opts.p2p.sendTo(conn.peer, opts.MSG.PEER_LIST, { peers: otherPeers })
            }
          }, 500)
        }
      }
      opts.p2p.onPlayerDisconnected = (peerId) => { opts.log.info('Player disconnected:', { peerId }) }
      opts.p2p.onMessage = (data, peerId) => { dispatchHostMessage(data, peerId) }
      opts.p2p.onError = (err) => { opts.log.error('Host error:', { error: err }) }
      opts.p2p.startHeartbeat(10000)
      opts.p2p.onDeadPeer = (peerId) => { opts.log.warn('Host detected dead peer', { peerId }) }
    }

    function setupGuestHandlers() {
      opts.p2p.onPlayerDisconnected = (peerId) => {
        const hostPeerId = `${opts.gameId}-${opts.gameState.roomCode}`
        if (peerId === hostPeerId) {
          if (hostMigrator.isMigrationInProgress()) return
          hostMigrator.handleHostDisconnect(opts.getRoom(), opts.gameState, {
            broadcastState,
            setupHostHandlers,
            setConnectionStatus: opts.setConnectionStatus,
            enableWaitBranch: false
          })
        }
      }
      opts.p2p.onMessage = (data, peerId) => { dispatchGuestMessage(data, peerId) }
      opts.p2p.onError = (err) => { opts.log.error('Guest error:', { error: err }) }
      opts.p2p.startHeartbeat(10000)
      opts.p2p.onDeadPeer = (peerId) => {
        const hostPeerId = `${opts.gameId}-${opts.gameState.roomCode}`
        if (peerId === hostPeerId) {
          if (hostMigrator.isMigrationInProgress()) return
          hostMigrator.handleHostDisconnect(opts.getRoom(), opts.gameState, {
            broadcastState,
            setupHostHandlers,
            setConnectionStatus: opts.setConnectionStatus,
            enableWaitBranch: false
          })
        }
      }
    }

    function broadcastState(options = {}) {
      const room = opts.getRoom()
      if (!room) return null
      if (opts.cleanupOps) opts.cleanupOps()
      return opts.roomBroadcaster.broadcastState({
        forceFull: options.forceFull ?? false,
        error: options.error || null
      })
    }

    function resetBroadcastState() {
      opts.roomBroadcaster.resetBroadcastState()
    }

    function dispatchHostMessage(data, peerId) {
      const type = data?.type
      const payload = data?.payload || {}
      const room = opts.getRoom()
      if (!room) return

      switch (type) {
        case opts.MSG.JOIN_REQUEST:
          if (opts.handleJoinRequest) opts.handleJoinRequest(payload, peerId, { room, p2p: opts.p2p, MSG: opts.MSG, deepClone: opts.deepClone, broadcastState, generateOpKey: opts.generateOpKey, isDuplicateOp: opts.isDuplicateOp, getRoom: opts.getRoom, log: opts.log })
          break
        case opts.MSG.REQUEST_STATE:
          if (opts.isDuplicateOp(type, payload, room.code)) return
          opts.p2p.sendTo(peerId, opts.MSG.ROOM_STATE, { room: opts.deepClone(room), detail: opts.getRoomStateDedupeDetail(room) })
          break
        default:
          if (opts.handleHostBusinessMessage) opts.handleHostBusinessMessage(type, payload, peerId, { room, p2p: opts.p2p, MSG: opts.MSG, deepClone: opts.deepClone, broadcastState, generateOpKey: opts.generateOpKey, isDuplicateOp: opts.isDuplicateOp, getRoom: opts.getRoom, log: opts.log })
      }
    }

    function dispatchGuestMessage(data, peerId) {
      const type = data?.type
      const payload = data?.payload || {}

      switch (type) {
        case opts.MSG.ROOM_STATE:
          if (payload.room) {
            opts.setRoom(payload.room)
            opts.updateLocalState(opts.getRoom())
          } else if (payload.delta) {
            const currentRoom = opts.getRoom()
            if (!currentRoom) return
            Object.keys(payload.delta).forEach(key => { currentRoom[key] = payload.delta[key] })
            opts.updateLocalState(currentRoom)
          }
          break
        case opts.MSG.JOIN_RESPONSE:
          if (payload.success === false) {
            if (opts.onGuestJoinRejected) opts.onGuestJoinRejected(payload.error)
          } else {
            if (opts.onGuestJoinAccepted) opts.onGuestJoinAccepted(payload)
          }
          break
        case opts.MSG.HOST_MIGRATION: {
          const { newHostId, newHostPeerId, room } = payload
          if (newHostId === opts.gameState.playerId) break
          hostMigrator.resetMigrationMutex()
          opts.setRoom(room)
          opts.updateLocalState(opts.getRoom())
          opts.p2p.connectToPeer(newHostPeerId).catch(() => {})
          break
        }
        case opts.MSG.PEER_LIST: {
          const { peers } = payload
          if (peers && peers.length > 0) {
            peers.forEach(async (targetPeerId) => {
              try { await opts.p2p.connectToPeer(targetPeerId) } catch { /* ignore */ }
            })
          }
          break
        }
        case opts.MSG.CONNECT_TO_PEER: {
          const { peerId: targetPeerId } = payload
          opts.p2p.connectToPeer(targetPeerId).catch(() => {})
          break
        }
        default:
          if (opts.handleGuestBusinessMessage) opts.handleGuestBusinessMessage(type, payload, peerId, { p2p: opts.p2p, MSG: opts.MSG, getRoom: opts.getRoom, setRoom: opts.setRoom, updateLocalState: opts.updateLocalState, gameState: opts.gameState, setConnectionStatus: opts.setConnectionStatus, log: opts.log })
      }
    }

    function cleanupNetwork() {
      hostMigrator.resetMigrationMutex()
      if (opts.resetOps) opts.resetOps()
      if (opts.cleanupExtra) opts.cleanupExtra()
    }

    return {
      setupHostHandlers,
      setupGuestHandlers,
      broadcastState,
      resetBroadcastState,
      cleanupNetwork,
      hostMigrator,
      RECONNECT_METADATA: { get attempt() { return 0 }, MAX_ATTEMPTS: 8 },
      getHostPeerId: () => `${opts.gameId}-${opts.gameState.roomCode}`
    }
  }

  return { createNetworkLayer }
})

vi.mock('../../services/logger', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }))
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
    expect(typeof p2pMock.onMessage).toBe('function')
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
    expect(state.getRoom().gameState.solvedModuleIds).toEqual(['wires-1', 'symbols-1', 'keypad-1', 'password-1'])
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
    expect(p2pMock.sendTo).toHaveBeenCalledWith('bombdefuse-ABC123', 'SUBMIT_MODULE_ACTION', {
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

  it('clears stale errors on a successful JOIN_RESPONSE', () => {
    store.gameState.error = 'Player name was empty; using Player.'
    store.gameState.connectionStatus = 'error'
    store.gameState.connectionMessage = 'Player name was empty; using Player.'

    network.handleGuestMessage({
      type: 'JOIN_RESPONSE',
      payload: {
        success: true,
        room: {
          id: 'ABC123',
          code: 'ABC123',
          hostId: 'p1',
          players: [],
          phase: 'waiting',
          status: 'waiting',
          gameState: { modules: [], strikes: [], solvedModuleIds: [], actionLog: [] },
          disconnectedPlayers: []
        }
      }
    })

    expect(store.gameState.error).toBe(null)
    expect(store.gameState.connectionStatus).toBe('connected')
  })

  it('falls back to peer-id reconnect when the room is already full', async () => {
    await store.createRoom('Host')
    // First guest joins via a peer
    network.handleHostMessage({
      type: 'JOIN_REQUEST',
      payload: {
        playerId: 'p2',
        playerName: 'Guest',
        originalPeerId: 'guest-peer-original'
      }
    }, 'guest-peer-original')

    // Host starts the game
    expect(store.handleStartGame({ seed: 'reconnect-by-peer' })).toBe(true)

    // A second join attempt arrives with a different playerId but the same
    // peer (e.g. flaky reconnect that regenerated the id locally) — should be
    // accepted as a reconnect instead of being rejected with "room full".
    p2pMock.sendTo.mockClear()
    p2pMock.broadcast.mockClear()

    network.handleHostMessage({
      type: 'JOIN_REQUEST',
      payload: {
        playerId: 'p2-regenerated',
        playerName: 'Guest',
        originalPeerId: 'guest-peer-original',
        isReconnect: true
      }
    }, 'guest-peer-original')

    expect(p2pMock.sendTo).toHaveBeenCalledWith('guest-peer-original', 'JOIN_RESPONSE', {
      success: true,
      room: expect.objectContaining({
        players: expect.arrayContaining([
          expect.objectContaining({ id: 'p2', isOnline: true })
        ])
      })
    })
    expect(p2pMock.sendTo).not.toHaveBeenCalledWith('guest-peer-original', 'JOIN_RESPONSE', expect.objectContaining({
      success: false
    }))
  })

  it('clears a stale error when joinRoom is called with a valid name', async () => {
    store.gameState.error = 'Player name was empty; using Player.'

    const joined = await store.joinRoom('moyu', 'ABC123')

    expect(joined).toBe(true)
    expect(store.gameState.error).toBe(null)
    expect(store.gameState.playerName).toBe('moyu')
  })

  it('clears a stale error when createRoom is called with a valid name', async () => {
    store.gameState.error = 'Player name was empty; using Player.'

    const created = await store.createRoom('Host')

    expect(created).toBe(true)
    expect(store.gameState.error).toBe(null)
    expect(store.gameState.playerName).toBe('Host')
  })
})
