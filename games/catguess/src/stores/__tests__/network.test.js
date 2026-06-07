import { beforeEach, describe, expect, it, vi } from 'vitest'

// ── Mocks ──────────────────────────────────────────────────────────────────────

const p2pMock = {
  generateRoomCode: vi.fn(() => 'CG456'),
  getHostPeerId: vi.fn(code => `catguess-${code}`),
  getConnectionDiagnostics: vi.fn(() => ({
    mode: 'direct-or-relay',
    hasTurnRelay: false,
    peers: {}
  })),
  getConnectedPeers: vi.fn(() => ['catguess-CG456']),
  getMyPeerId: vi.fn(() => 'local-peer'),
  createHost: vi.fn(() => Promise.resolve('catguess-CG456')),
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
  const { vi } = require('vitest')
  const { createHostMigrationHandler } = require('../../../../src/shared/online/useHostMigration')

  function createNetworkLayer(opts) {
    const hostMigrator = createHostMigrationHandler({ gameId: opts.gameId, p2p: opts.p2p, log: opts.log })

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
            enableWaitBranch: true
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
            enableWaitBranch: true
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
          opts.p2p.sendTo(peerId, opts.MSG.ROOM_STATE, { room: opts.deepClone ? opts.deepClone(room) : room, detail: opts.getRoomStateDedupeDetail(room) })
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
            if (opts.onRoomStateReceived) opts.onRoomStateReceived(payload)
            if (!opts.gameState.connected) {
              opts.gameState.connected = true
              if (opts.onGuestConnected) opts.onGuestConnected()
            }
          } else if (payload.delta) {
            const currentRoom = opts.getRoom()
            if (!currentRoom) return
            Object.keys(payload.delta).forEach(key => { currentRoom[key] = payload.delta[key] })
            opts.updateLocalState(currentRoom)
            if (opts.onRoomStateReceived) opts.onRoomStateReceived(payload)
          }
          break
        case opts.MSG.JOIN_RESPONSE:
          if (payload.success === false) {
            opts.gameState.connected = false
            opts.gameState.connecting = false
            opts.gameState.error = payload.error || '加入房间失败'
            opts.setConnectionStatus('error', payload.error || '加入房间失败')
            if (opts.onGuestJoinRejected) opts.onGuestJoinRejected(payload.error || '加入房间失败')
          } else {
            opts.gameState.connected = true
            opts.gameState.connecting = false
            opts.gameState.error = null
            opts.setConnectionStatus('connected', 'Mission joined.')
            if (payload.room) {
              opts.setRoom(payload.room)
              opts.updateLocalState(opts.getRoom())
            }
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
              try { await opts.p2p.connectToPeer(targetPeerId) } catch (err) { /* ignore */ }
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
      getHostPeerId: () => `${opts.gameId}-${opts.gameState.roomCode}`,
      dispatchHostMessage,
      dispatchGuestMessage
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

vi.mock('../components/ToastNotification.vue', () => ({
  showToast: vi.fn()
}))

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('catguess game store networking', () => {
  let store
  let state
  let network
  let timers

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.resetModules()
    store = await import('../gameStore')
    state = await import('../state')
    network = await import('../network')
    timers = await import('../timers')
  })

  it('creates a host room and installs host handlers', async () => {
    const created = await store.createRoom('Host')

    expect(created).toBe(true)
    expect(p2pMock.createHost).toHaveBeenCalledWith('CG456', 'Host')
    expect(store.gameState.isHost).toBe(true)
    expect(store.gameState.connected).toBe(true)
    expect(store.gameState.screen).toBe('lobby')
    expect(typeof p2pMock.onMessage).toBe('function')
  })

  it('accepts a join request and adds a new player', async () => {
    await store.createRoom('Host')

    network.handleHostMessage({
      type: 'JOIN_REQUEST',
      payload: {
        playerId: 'p2',
        playerName: 'Guest',
        originalPeerId: 'guest-peer'
      }
    }, 'guest-peer')

    const room = state.getRoom()
    expect(room.players.length).toBe(2)
    expect(room.players[1]._peerId).toBe('guest-peer')
    // CONNECT_TO_PEER is sent to other peers to connect to the new player
    expect(p2pMock.sendTo).toHaveBeenCalledWith(
      expect.any(String),
      'CONNECT_TO_PEER',
      { peerId: 'guest-peer' }
    )
  })

  it('rejects a join request when the game has already started', async () => {
    await store.createRoom('Host')
    const room = state.getRoom()
    room.status = 'PLAYING'
    room.phase = 'STORYTELLER_PICKING'

    network.handleHostMessage({
      type: 'JOIN_REQUEST',
      payload: {
        playerId: 'p2',
        playerName: 'LateGuest',
        originalPeerId: 'late-peer'
      }
    }, 'late-peer')

    expect(p2pMock.sendTo).toHaveBeenCalledWith('late-peer', 'JOIN_RESPONSE', {
      success: false,
      error: '游戏已经开始，无法加入房间'
    })
  })

  it('accepts a reconnect for an offline player by playerId', async () => {
    await store.createRoom('Host')

    // Add a player then mark them offline
    network.handleHostMessage({
      type: 'JOIN_REQUEST',
      payload: { playerId: 'p2', playerName: 'Guest', originalPeerId: 'guest-peer' }
    }, 'guest-peer')

    const room = state.getRoom()
    const guest = room.players.find(p => p.id === 'p2')
    guest.isOnline = false
    room.disconnectedPlayers = [{ id: 'p2', name: 'Guest', disconnectedAt: Date.now() }]

    // Reconnect
    network.handleHostMessage({
      type: 'JOIN_REQUEST',
      payload: { playerId: 'p2', playerName: 'Guest', originalPeerId: 'guest-peer', isReconnect: true }
    }, 'guest-peer')

    expect(guest.isOnline).toBe(true)
    expect(p2pMock.sendTo).toHaveBeenCalledWith('guest-peer', 'JOIN_RESPONSE', {
      success: true,
      reconnected: true,
      originalPlayerId: 'p2'
    })
  })

  it('applies ROOM_STATE on guests and sets connected', async () => {
    store.gameState.connected = false
    store.gameState.connecting = true

    network.handleGuestMessage({
      type: 'ROOM_STATE',
      payload: {
        room: {
          code: 'CG456',
          players: [{ id: 'p1', name: 'Host', isOnline: true }],
          status: 'WAITING',
          phase: 'WAITING',
          gameState: { round: 0 }
        }
      }
    })

    expect(store.gameState.connected).toBe(true)
    expect(store.gameState.screen).toBe('lobby')
  })

  it('surfaces rejected join responses and stops connecting', async () => {
    store.gameState.connecting = true
    store.gameState.connected = false
    timers.setConnectionStatus('connecting', 'Joining...')

    network.handleGuestMessage({
      type: 'JOIN_RESPONSE',
      payload: {
        success: false,
        error: '房间已满'
      }
    })

    expect(store.gameState.connected).toBe(false)
    expect(store.gameState.connecting).toBe(false)
    expect(store.gameState.error).toBe('房间已满')
    expect(store.gameState.connectionStatus).toBe('error')
  })

  it('clears stale errors on a successful JOIN_RESPONSE', async () => {
    store.gameState.error = 'Previous error'
    store.gameState.connectionStatus = 'error'

    network.handleGuestMessage({
      type: 'JOIN_RESPONSE',
      payload: {
        success: true,
        room: {
          code: 'CG456',
          players: [{ id: 'p1', name: 'Host' }],
          status: 'WAITING',
          phase: 'WAITING',
          gameState: { round: 0 }
        }
      }
    })

    expect(store.gameState.connected).toBe(true)
    expect(store.gameState.error).toBeNull()
  })

  it('falls back to peer-id reconnect when player is already online', async () => {
    await store.createRoom('Host')

    network.handleHostMessage({
      type: 'JOIN_REQUEST',
      payload: { playerId: 'p2', playerName: 'Guest', originalPeerId: 'guest-peer' }
    }, 'guest-peer')

    // Same player sends another join request while still online
    network.handleHostMessage({
      type: 'JOIN_REQUEST',
      payload: { playerId: 'p2', playerName: 'Guest', originalPeerId: 'guest-peer' }
    }, 'guest-peer')

    // Should send ROOM_STATE (not another JOIN_RESPONSE)
    expect(p2pMock.sendTo).toHaveBeenCalledWith('guest-peer', 'ROOM_STATE', expect.objectContaining({
      room: expect.any(Object)
    }))
  })

  it('RECONNECT_METADATA exposes attempt count and max attempts', async () => {
    const { RECONNECT_METADATA } = store
    expect(RECONNECT_METADATA.MAX_ATTEMPTS).toBe(8)
    expect(typeof RECONNECT_METADATA.attempt).toBe('number')
    expect(RECONNECT_METADATA.attempt).toBeGreaterThanOrEqual(0)
  })

  it('reconnectRoom is an exported async function', async () => {
    expect(typeof store.reconnectRoom).toBe('function')
  })

  it('leaveRoom is an exported async function', async () => {
    expect(typeof store.leaveRoom).toBe('function')
  })
})
