import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock PeerJS before importing the service
vi.mock('peerjs', () => ({
  default: vi.fn()
}))

// Mock the logger
vi.mock('../logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }),
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}))

import p2p from '../p2p'

// Reset shared singleton state between test suites
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

describe('P2PService', () => {
  // ════════════════════════════════════════════════════════
  //  generateRoomCode
  // ════════════════════════════════════════════════════════
  describe('generateRoomCode', () => {
    it('returns a 6-character string', () => {
      const code = p2p.generateRoomCode()
      expect(code).toBeTypeOf('string')
      expect(code).toHaveLength(6)
    })

    it('only contains valid characters (no confusing ones)', () => {
      const allowed = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
      for (let i = 0; i < 20; i++) {
        const code = p2p.generateRoomCode()
        for (const char of code) {
          expect(allowed).toContain(char)
        }
      }
    })

    it('generates uppercase letters and numbers only', () => {
      const code = p2p.generateRoomCode()
      expect(code).toMatch(/^[A-Z0-9]+$/)
    })

    it('does NOT contain ambiguous characters (0, 1, I, O)', () => {
      for (let i = 0; i < 50; i++) {
        const code = p2p.generateRoomCode()
        expect(code).not.toContain('0')
        expect(code).not.toContain('1')
        expect(code).not.toContain('I')
        expect(code).not.toContain('O')
      }
    })

    it('generates unique codes most of the time', () => {
      const codes = new Set()
      for (let i = 0; i < 30; i++) {
        codes.add(p2p.generateRoomCode())
      }
      expect(codes.size).toBe(30)
    })
  })

  // ════════════════════════════════════════════════════════
  //  Constructor / Initial State
  // ════════════════════════════════════════════════════════
  describe('peer id namespace', () => {
    beforeEach(() => {
      resetP2PState()
    })

    it('uses the codenames prefix for host peers', () => {
      expect(p2p.getHostPeerId('ABCDEF')).toBe('codenames-ABCDEF')
    })

    it('uses the codenames guest prefix for guest peers', () => {
      expect(p2p.getGuestPeerId()).toMatch(/^codenames-guest-\d+-[a-z0-9]{6}$/)
    })
  })

  describe('initial state', () => {
    beforeEach(() => {
      resetP2PState()
    })

    it('peer is null initially', () => {
      expect(p2p.peer).toBeNull()
    })

    it('connections is empty array', () => {
      expect(p2p.connections).toEqual([])
    })

    it('isHost is false', () => {
      expect(p2p.isHost).toBe(false)
    })

    it('roomCode is null', () => {
      expect(p2p.roomCode).toBeNull()
    })

    it('playerName is null', () => {
      expect(p2p.playerName).toBeNull()
    })

    it('callback handlers are null', () => {
      expect(p2p.onMessage).toBeNull()
      expect(p2p.onPlayerConnected).toBeNull()
      expect(p2p.onPlayerDisconnected).toBeNull()
      expect(p2p.onError).toBeNull()
      expect(p2p.onDeadPeer).toBeNull()
    })

    it('internal structures are initialized', () => {
      expect(p2p._peerLastSeen).toBeDefined()
      expect(p2p._missedHeartbeats).toBeDefined()
      expect(p2p._disconnectedPeers).toBeDefined()
      expect(p2p._retryQueue).toEqual([])
      expect(p2p._retryTimer).toBeNull()
      expect(p2p._heartbeatInterval).toBeNull()
    })
  })

  // ════════════════════════════════════════════════════════
  //  getConnectedPeers
  // ════════════════════════════════════════════════════════
  describe('getConnectedPeers', () => {
    beforeEach(() => {
      resetP2PState()
    })

    it('returns empty array with no connections', () => {
      expect(p2p.getConnectedPeers()).toEqual([])
    })

    it('returns only open connection peer IDs', () => {
      p2p.connections = [
        { peer: 'peer-abc', open: true }
      ]
      expect(p2p.getConnectedPeers()).toEqual(['peer-abc'])
    })

    it('filters out closed connections', () => {
      p2p.connections = [
        { peer: 'peer-1', open: true },
        { peer: 'peer-2', open: false },
        { peer: 'peer-3', open: true }
      ]
      expect(p2p.getConnectedPeers()).toEqual(['peer-1', 'peer-3'])
    })
  })

  // ════════════════════════════════════════════════════════
  //  getMyPeerId
  // ════════════════════════════════════════════════════════
  describe('getMyPeerId', () => {
    beforeEach(() => {
      resetP2PState()
    })

    it('returns undefined when peer is null', () => {
      expect(p2p.getMyPeerId()).toBeUndefined()
    })

    it('returns peer id when peer exists', () => {
      p2p.peer = { id: 'my-test-peer-id', destroy: vi.fn() }
      expect(p2p.getMyPeerId()).toBe('my-test-peer-id')
    })
  })

  // ════════════════════════════════════════════════════════
  //  Heartbeat methods
  // ════════════════════════════════════════════════════════
  describe('heartbeat', () => {
    beforeEach(() => {
      resetP2PState()
    })

    it('startHeartbeat does not throw', () => {
      expect(() => p2p.startHeartbeat(5000)).not.toThrow()
      p2p.stopHeartbeat()
    })

    it('stopHeartbeat does not throw when no heartbeat is running', () => {
      expect(() => p2p.stopHeartbeat()).not.toThrow()
    })

    it('startHeartbeat then stopHeartbeat clears interval', () => {
      p2p.startHeartbeat(5000)
      expect(p2p._heartbeatInterval).not.toBeNull()
      p2p.stopHeartbeat()
      expect(p2p._heartbeatInterval).toBeNull()
    })

    it('calling startHeartbeat twice replaces the interval', () => {
      p2p.startHeartbeat(5000)
      const firstInterval = p2p._heartbeatInterval
      p2p.startHeartbeat(3000)
      expect(p2p._heartbeatInterval).not.toBe(firstInterval)
      p2p.stopHeartbeat()
    })

    it('stopHeartbeat is idempotent', () => {
      p2p.stopHeartbeat()
      p2p.stopHeartbeat()
      p2p.stopHeartbeat()
      expect(p2p._heartbeatInterval).toBeNull()
    })
  })

  // ════════════════════════════════════════════════════════
  //  handleHeartbeat
  // ════════════════════════════════════════════════════════
  describe('handleHeartbeat', () => {
    beforeEach(() => {
      resetP2PState()
    })

    it('HEARTBEAT triggers an ACK response', () => {
      const mockConn = { peer: 'peer-hb', open: true, send: vi.fn() }
      p2p.connections.push(mockConn)

      p2p.handleHeartbeat(
        { type: 'HEARTBEAT', payload: { timestamp: 12345 } },
        'peer-hb'
      )

      expect(mockConn.send).toHaveBeenCalled()
      const sentMsg = mockConn.send.mock.calls[0][0]
      expect(sentMsg.type).toBe('HEARTBEAT_ACK')
      expect(sentMsg.payload.timestamp).toBe(12345)
    })

    it('HEARTBEAT_ACK updates peer last seen and resets missed count', () => {
      p2p._missedHeartbeats.set('peer-ack', 5)
      p2p._peerLastSeen.set('peer-ack', 0)

      p2p.handleHeartbeat(
        { type: 'HEARTBEAT_ACK', payload: { timestamp: 99999 } },
        'peer-ack'
      )

      expect(p2p._peerLastSeen.get('peer-ack')).toBeGreaterThan(0)
      expect(p2p._missedHeartbeats.get('peer-ack')).toBe(0)
    })
  })

  // ════════════════════════════════════════════════════════
  //  checkDeadPeers
  // ════════════════════════════════════════════════════════
  describe('checkDeadPeers', () => {
    beforeEach(() => {
      resetP2PState()
    })

    it('does not throw with no connections', () => {
      expect(() => p2p.checkDeadPeers()).not.toThrow()
    })

    it('increments missed count for open connections', () => {
      const mockConn = { peer: 'peer-d1', open: true, close: vi.fn() }
      p2p.connections.push(mockConn)
      p2p._missedHeartbeats.set('peer-d1', 1)

      p2p.checkDeadPeers(30000, 3)

      expect(p2p._missedHeartbeats.get('peer-d1')).toBe(2)
    })

    it('does not increment missed count for closed connections', () => {
      const mockConn = { peer: 'peer-closed', open: false, close: vi.fn() }
      p2p.connections.push(mockConn)
      p2p._missedHeartbeats.set('peer-closed', 1)

      p2p.checkDeadPeers(30000, 3)

      expect(p2p._missedHeartbeats.get('peer-closed')).toBe(1)
    })

    it('detects dead peer after exceeding threshold', () => {
      const mockConn = { peer: 'peer-dead', open: true, close: vi.fn() }
      p2p.connections.push(mockConn)
      p2p._missedHeartbeats.set('peer-dead', 4)

      const onDeadPeer = vi.fn()
      p2p.onDeadPeer = onDeadPeer

      p2p.checkDeadPeers(30000, 3)

      expect(onDeadPeer).toHaveBeenCalledWith('peer-dead')
      p2p.onDeadPeer = null
    })

    it('removes dead peer from connections', () => {
      const mockConn = { peer: 'peer-remove', open: true, close: vi.fn() }
      p2p.connections.push(mockConn)
      p2p._missedHeartbeats.set('peer-remove', 5)

      p2p.checkDeadPeers(30000, 3)

      expect(p2p.connections).toHaveLength(0)
    })
  })

  // ════════════════════════════════════════════════════════
  //  broadcast
  // ════════════════════════════════════════════════════════
  describe('broadcast', () => {
    beforeEach(() => {
      resetP2PState()
    })

    it('does not throw with no connections', () => {
      expect(() => p2p.broadcast('TEST', { data: 'hello' })).not.toThrow()
    })

    it('sends message to all open connections', () => {
      const mockConn1 = { peer: 'p1', open: true, send: vi.fn() }
      const mockConn2 = { peer: 'p2', open: true, send: vi.fn() }
      p2p.connections = [mockConn1, mockConn2]

      p2p.broadcast('GAME_STATE', { room: 'test' })

      expect(mockConn1.send).toHaveBeenCalled()
      expect(mockConn2.send).toHaveBeenCalled()

      const msg1 = mockConn1.send.mock.calls[0][0]
      expect(msg1.type).toBe('GAME_STATE')
      expect(msg1.payload.room).toBe('test')
      expect(msg1.timestamp).toBeDefined()
    })

    it('skips closed connections', () => {
      const mockConn1 = { peer: 'p1', open: true, send: vi.fn() }
      const mockConn2 = { peer: 'p2', open: false, send: vi.fn() }
      p2p.connections = [mockConn1, mockConn2]

      p2p.broadcast('TEST', {})

      expect(mockConn1.send).toHaveBeenCalled()
      expect(mockConn2.send).not.toHaveBeenCalled()
    })

    it('enqueues for retry when send throws', () => {
      const badConn = { peer: 'bad-bcast', open: true, send: () => { throw new Error('fail') } }
      p2p.connections = [badConn]

      expect(() => p2p.broadcast('TEST', {})).not.toThrow()
      expect(p2p._retryQueue.length).toBeGreaterThan(0)
      const entry = p2p._retryQueue[0]
      expect(entry.peerId).toBe('bad-bcast')
      expect(entry.type).toBe('TEST')
    })
  })

  // ════════════════════════════════════════════════════════
  //  sendTo
  // ════════════════════════════════════════════════════════
  describe('sendTo', () => {
    beforeEach(() => {
      resetP2PState()
    })

    it('does not throw without matching connection', () => {
      expect(() => p2p.sendTo('no-peer', 'TEST', {})).not.toThrow()
    })

    it('sends to specific peer', () => {
      const mockConn = { peer: 'target', open: true, send: vi.fn() }
      p2p.connections = [mockConn]

      p2p.sendTo('target', 'PRIVATE', { key: 'val' })

      expect(mockConn.send).toHaveBeenCalled()
      const msg = mockConn.send.mock.calls[0][0]
      expect(msg.type).toBe('PRIVATE')
      expect(msg.payload.key).toBe('val')
    })

    it('skips when connection is closed', () => {
      const mockConn = { peer: 'target', open: false, send: vi.fn() }
      p2p.connections = [mockConn]

      p2p.sendTo('target', 'TEST', {})

      expect(mockConn.send).not.toHaveBeenCalled()
    })

    it('enqueues for retry when send throws', () => {
      const badConn = { peer: 'sendto-bad', open: true, send: () => { throw new Error('fail') } }
      p2p.connections = [badConn]

      p2p.sendTo('sendto-bad', 'TEST', {})

      expect(p2p._retryQueue.length).toBeGreaterThan(0)
      expect(p2p._retryQueue[0].peerId).toBe('sendto-bad')
    })
  })

  // ════════════════════════════════════════════════════════
  //  disconnect
  // ════════════════════════════════════════════════════════
  describe('disconnect', () => {
    beforeEach(() => {
      resetP2PState()
    })

    it('cleans up all state', () => {
      p2p.peer = { id: 'test', destroy: vi.fn() }
      p2p.connections = [
        { peer: 'p1', open: true, close: vi.fn() },
        { peer: 'p2', open: false, close: vi.fn() }
      ]
      p2p.isHost = true
      p2p.roomCode = 'ABCDEF'
      p2p.playerName = 'Test'
      p2p._missedHeartbeats.set('p1', 3)
      p2p._peerLastSeen.set('p1', Date.now())
      p2p._disconnectedPeers.add('p1')
      p2p._retryQueue = [{ peerId: 'p1', type: 'X', payload: {}, attempts: 0, nextRetry: 0 }]
      p2p._heartbeatInterval = setInterval(() => {}, 99999)
      p2p._retryTimer = setInterval(() => {}, 99999)

      p2p.disconnect()

      expect(p2p.peer).toBeNull()
      expect(p2p.connections).toEqual([])
      expect(p2p.isHost).toBe(false)
      expect(p2p.roomCode).toBeNull()
      expect(p2p.playerName).toBeNull()
      expect(p2p._missedHeartbeats.size).toBe(0)
      expect(p2p._peerLastSeen.size).toBe(0)
      expect(p2p._disconnectedPeers.size).toBe(0)
      expect(p2p._retryQueue).toEqual([])
      expect(p2p._heartbeatInterval).toBeNull()
      expect(p2p._retryTimer).toBeNull()
    })

    it('handles disconnect when peer is null', () => {
      p2p.connections = []
      expect(() => p2p.disconnect()).not.toThrow()
    })
  })

  // ════════════════════════════════════════════════════════
  //  Retry queue
  // ════════════════════════════════════════════════════════
  describe('retry queue', () => {
    beforeEach(() => {
      resetP2PState()
    })

    it('_enqueueRetry adds to queue', () => {
      p2p._enqueueRetry('peer-r1', 'MSG', { data: 1 })
      expect(p2p._retryQueue).toHaveLength(1)
      expect(p2p._retryQueue[0].peerId).toBe('peer-r1')
      expect(p2p._retryQueue[0].type).toBe('MSG')
      expect(p2p._retryQueue[0].attempts).toBe(0)
    })

    it('_enqueueRetry starts retry timer', () => {
      expect(p2p._retryTimer).toBeNull()
      p2p._enqueueRetry('peer-r2', 'MSG', {})
      expect(p2p._retryTimer).not.toBeNull()
      p2p._stopRetryTimer()
    })

    it('_processRetryQueue retries sends', () => {
      const mockConn = { peer: 'peer-r3', open: true, send: vi.fn() }
      p2p.connections.push(mockConn)
      p2p._retryQueue.push({
        peerId: 'peer-r3',
        type: 'RETRY_MSG',
        payload: { retry: true },
        attempts: 0,
        nextRetry: 0
      })

      p2p._processRetryQueue()

      expect(mockConn.send).toHaveBeenCalled()
      expect(p2p._retryQueue).toHaveLength(0)
    })

    it('_processRetryQueue drops after 3 failed attempts', () => {
      const mockConn = { peer: 'peer-r4', open: true, send: () => { throw new Error('fail') } }
      p2p.connections.push(mockConn)
      p2p._retryQueue.push({
        peerId: 'peer-r4',
        type: 'FAILING',
        payload: {},
        attempts: 3,
        nextRetry: 0
      })

      p2p._processRetryQueue()

      expect(p2p._retryQueue).toHaveLength(0)
    })

    it('_processRetryQueue increments attempts on failure', () => {
      const mockConn = { peer: 'peer-r5', open: true, send: () => { throw new Error('fail') } }
      p2p.connections.push(mockConn)
      p2p._retryQueue.push({
        peerId: 'peer-r5',
        type: 'FAILING',
        payload: {},
        attempts: 0,
        nextRetry: 0
      })

      p2p._processRetryQueue()

      expect(p2p._retryQueue).toHaveLength(1)
      expect(p2p._retryQueue[0].attempts).toBe(1)
    })
  })

  // ════════════════════════════════════════════════════════
  //  Callback assignments
  // ════════════════════════════════════════════════════════
  describe('callback properties', () => {
    beforeEach(() => {
      resetP2PState()
    })

    it('supports assigning and reading callbacks', () => {
      const fn = vi.fn()

      p2p.onMessage = fn
      expect(p2p.onMessage).toBe(fn)

      p2p.onPlayerConnected = fn
      expect(p2p.onPlayerConnected).toBe(fn)

      p2p.onPlayerDisconnected = fn
      expect(p2p.onPlayerDisconnected).toBe(fn)

      p2p.onError = fn
      expect(p2p.onError).toBe(fn)

      p2p.onDeadPeer = fn
      expect(p2p.onDeadPeer).toBe(fn)
    })
  })
})
