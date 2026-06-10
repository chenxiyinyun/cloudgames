import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createWebSocketService } from '../createWebSocketService'

// 极简假 WebSocket：测试手动驱动 open/message/drop。
class FakeWS {
  static instances = []
  constructor(url) {
    this.url = url
    this.readyState = 0 // CONNECTING
    this.sent = []
    FakeWS.instances.push(this)
  }
  send(data) { this.sent.push(JSON.parse(data)) }
  close() { this.readyState = 3; this.onclose?.({ code: 1000 }) }
  _open() { this.readyState = 1; this.onopen?.() }
  _message(obj) { this.onmessage?.({ data: JSON.stringify(obj) }) }
  _drop() { this.readyState = 3; this.onclose?.({ code: 1006 }) }
}

function makeService(extra = {}) {
  return createWebSocketService({
    url: 'wss://test/ws',
    gameId: 'bombdefuse',
    logger: { debug() {}, info() {}, warn() {}, error() {} },
    WebSocketImpl: FakeWS,
    ...extra
  })
}

describe('createWebSocketService', () => {
  beforeEach(() => { FakeWS.instances = [] })
  afterEach(() => { vi.useRealTimers() })

  it('create() opens a socket and sends CREATE on open', () => {
    const ws = makeService()
    ws.create('p1', 'Host')
    const sock = FakeWS.instances[0]
    expect(sock.url).toBe('wss://test/ws')
    sock._open()
    expect(sock.sent[0]).toEqual({ type: 'CREATE', gameId: 'bombdefuse', playerId: 'p1', playerName: 'Host' })
  })

  it('JOINED sets identity and fires onJoined + connected status', () => {
    const ws = makeService()
    const joined = vi.fn()
    const statuses = []
    ws.on({ onJoined: joined, onStatus: (s) => statuses.push(s) })
    ws.create('p1', 'Host')
    const sock = FakeWS.instances[0]
    sock._open()
    sock._message({ type: 'JOINED', playerId: 'p1', roomCode: 'ABC123', room: { code: 'ABC123' } })
    expect(joined).toHaveBeenCalledWith({ playerId: 'p1', roomCode: 'ABC123', room: { code: 'ABC123' } })
    expect(ws.getRoomCode()).toBe('ABC123')
    expect(statuses).toContain('connected')
  })

  it('STATE forwards the authoritative room', () => {
    const ws = makeService()
    const onState = vi.fn()
    ws.on({ onState })
    ws.create('p1', 'Host')
    FakeWS.instances[0]._open()
    FakeWS.instances[0]._message({ type: 'STATE', room: { code: 'ABC123', phase: 'playing' } })
    expect(onState).toHaveBeenCalledWith({ code: 'ABC123', phase: 'playing' })
  })

  it('join() sends JOIN and sendIntent sends INTENT when open', () => {
    const ws = makeService()
    ws.join('ABC123', 'g1', 'Guest')
    const sock = FakeWS.instances[0]
    sock._open()
    expect(sock.sent[0]).toEqual({ type: 'JOIN', roomCode: 'ABC123', playerId: 'g1', playerName: 'Guest' })
    ws.sendIntent('START_GAME')
    expect(sock.sent[1]).toEqual({ type: 'INTENT', action: 'START_GAME', payload: undefined })
  })

  it('fatal ERROR does not trigger auto-reconnect on subsequent close', () => {
    vi.useFakeTimers()
    const ws = makeService()
    const onError = vi.fn()
    ws.on({ onError })
    ws.join('NOPE', 'g1', 'Guest')
    const sock = FakeWS.instances[0]
    sock._open()
    sock._message({ type: 'ERROR', message: '房间不存在', fatal: true })
    expect(onError).toHaveBeenCalledWith({ message: '房间不存在', fatal: true })
    sock._drop()
    vi.advanceTimersByTime(20000)
    expect(FakeWS.instances).toHaveLength(1) // 没有新连接
  })

  it('auto-reconnects after unexpected drop and re-JOINs with stored identity', () => {
    vi.useFakeTimers()
    const ws = makeService()
    ws.create('p1', 'Host')
    const first = FakeWS.instances[0]
    first._open()
    first._message({ type: 'JOINED', playerId: 'p1', roomCode: 'ABC123', room: {} })
    first._drop()
    vi.advanceTimersByTime(2000)
    const second = FakeWS.instances[1]
    expect(second).toBeTruthy()
    second._open()
    // 重连用 JOIN（而不是 CREATE），带回原 roomCode/playerId/name
    expect(second.sent[0]).toEqual({ type: 'JOIN', roomCode: 'ABC123', playerId: 'p1', playerName: 'Host' })
  })

  it('leave() sends LEAVE, closes, and suppresses reconnect', () => {
    vi.useFakeTimers()
    const ws = makeService()
    ws.create('p1', 'Host')
    const sock = FakeWS.instances[0]
    sock._open()
    sock._message({ type: 'JOINED', playerId: 'p1', roomCode: 'ABC123', room: {} })
    ws.leave()
    expect(sock.sent.some(m => m.type === 'LEAVE')).toBe(true)
    vi.advanceTimersByTime(20000)
    expect(FakeWS.instances).toHaveLength(1)
  })
})
