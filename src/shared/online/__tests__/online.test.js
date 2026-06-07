import { describe, expect, it, vi } from 'vitest';
import {
  createJoinRequestSender,
  createMessageTypes,
  createOperationDeduper,
  createRoomBroadcaster,
  deepClone
} from '../index';
import { createNetworkLayer } from '../createNetworkLayer';
import { createHostMigrationHandler } from '../useHostMigration';

describe('shared online foundation', () => {
  it('merges shared and game message types', () => {
    const MSG = createMessageTypes({ START_GAME: 'START_GAME' });

    expect(MSG.ROOM_STATE).toBe('ROOM_STATE');
    expect(MSG.START_GAME).toBe('START_GAME');
  });

  it('deduplicates operations inside the ttl window', () => {
    let now = 1000;
    const deduper = createOperationDeduper({
      clock: () => now,
      makeKey: (type, payload, roomCode) => `${type}:${roomCode}:${payload.playerId}`
    });

    const key = deduper.generateOpKey('JOIN_REQUEST', { playerId: 'p1' }, 'ABCDEF');
    expect(deduper.isDuplicateOp(key)).toBe(false);
    expect(deduper.isDuplicateOp(key)).toBe(true);

    now += 10001;
    expect(deduper.isDuplicateOp(key)).toBe(false);
  });

  it('sends join requests to the connected host when present', () => {
    const p2p = {
      peer: { id: 'guest-1' },
      getHostPeerId: vi.fn(() => 'game-ABCDEF'),
      getConnectedPeers: vi.fn(() => ['other-peer', 'game-ABCDEF']),
      sendTo: vi.fn(() => true)
    };

    const sendJoinRequest = createJoinRequestSender({
      p2p,
      gameId: 'game',
      getRoomCode: () => 'ABCDEF'
    });

    expect(sendJoinRequest('player-1', 'Ada')).toBe(true);
    expect(p2p.sendTo).toHaveBeenCalledWith('game-ABCDEF', 'JOIN_REQUEST', {
      playerId: 'player-1',
      playerName: 'Ada',
      originalPeerId: 'guest-1',
      isReconnect: false
    });
  });

  it('broadcasts full state first and deltas later', () => {
    const room = { code: 'ABCDEF', phase: 'waiting', count: 1 };
    const p2p = { broadcast: vi.fn() };
    const updateLocalState = vi.fn();
    const sync = createRoomBroadcaster({
      p2p,
      getRoom: () => room,
      updateLocalState,
      getDeltaMeta: currentRoom => ({ phase: currentRoom.phase })
    });

    sync.broadcastState();
    room.count = 2;
    sync.broadcastState();

    expect(p2p.broadcast.mock.calls[0][1]).toEqual({ room });
    expect(p2p.broadcast.mock.calls[1][1]).toEqual({ delta: { count: 2 }, phase: 'waiting' });
    expect(updateLocalState).toHaveBeenCalledTimes(2);
  });

  it('deepClone strips Vue reactive internals', () => {
    expect(deepClone({ a: 1, __v_isRef: true, nested: { _value: 2, b: 3 } })).toEqual({
      a: 1,
      nested: { b: 3 }
    });
  });

  it('responds to REQUEST_STATE with a cloned room snapshot', () => {
    const MSG = createMessageTypes({ REQUEST_STATE: 'REQUEST_STATE' });
    const room = {
      code: 'ABCDEF',
      phase: 'waiting',
      players: [{ id: 'p1', name: 'Host', _peerId: 'game-ABCDEF' }],
      nested: { value: 1 }
    };
    const p2p = {
      sendTo: vi.fn(),
      startHeartbeat: vi.fn(),
      getConnectedPeers: vi.fn(() => []),
      getPeerConnectionState: vi.fn(() => null),
      getMyPeerId: vi.fn(() => 'game-ABCDEF')
    };

    const net = createNetworkLayer({
      gameId: 'game',
      p2p,
      log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
      getRoom: () => room,
      setRoom: vi.fn(),
      updateLocalState: vi.fn(),
      setConnectionStatus: vi.fn(),
      gameState: { roomCode: 'ABCDEF', isHost: true },
      roomBroadcaster: { broadcastState: vi.fn(), resetBroadcastState: vi.fn() },
      sendJoinRequestBase: vi.fn(),
      generateOpKey: vi.fn((type, payload) => `${type}:${payload.roomCode || payload.playerId || ''}`),
      isDuplicateOp: vi.fn(() => false),
      cleanupOps: vi.fn(),
      resetOps: vi.fn(),
      getRoomStateDedupeDetail: vi.fn(() => 'detail-1'),
      MSG,
      deepClone,
      removePlayerFromRoom: vi.fn()
    });

    net.dispatchHostMessage({
      type: MSG.REQUEST_STATE,
      payload: { playerId: 'guest-1', roomCode: 'ABCDEF' }
    }, 'guest-peer');

    expect(p2p.sendTo).toHaveBeenCalledWith('guest-peer', MSG.ROOM_STATE, {
      room: expect.objectContaining({
        code: 'ABCDEF',
        nested: { value: 1 }
      }),
      detail: 'detail-1'
    });
    expect(p2p.sendTo.mock.calls[0][2].room).not.toBe(room);
  });

  it('elects the current player when they are the lowest-order online host candidate', async () => {
    const p2p = {
      getMyPeerId: vi.fn(() => 'game-guest-p1'),
      broadcast: vi.fn(),
      stopHeartbeat: vi.fn(),
      disconnectPeer: vi.fn()
    };
    const handler = createHostMigrationHandler({
      gameId: 'game',
      p2p,
      log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
    });
    const room = {
      code: 'ABCDEF',
      hostId: 'old-host',
      players: [
        { id: 'old-host', name: 'Host', order: 0, isOnline: true },
        { id: 'p1', name: 'Ada', order: 1, isOnline: true },
        { id: 'p2', name: 'Ben', order: 2, isOnline: true }
      ]
    };
    const gameState = { playerId: 'p1', roomCode: 'ABCDEF', isHost: false };
    const broadcastState = vi.fn();
    const setupHostHandlers = vi.fn();

    const result = await handler.handleHostDisconnect(room, gameState, {
      broadcastState,
      setupHostHandlers
    });

    expect(result).toEqual({ action: 'became_host' });
    expect(room.hostId).toBe('p1');
    expect(gameState.isHost).toBe(true);
    expect(p2p.broadcast).toHaveBeenCalledWith('HOST_MIGRATION', expect.objectContaining({ newHostId: 'p1' }));
    expect(setupHostHandlers).toHaveBeenCalled();
    expect(broadcastState).toHaveBeenCalled();
    // 通过 P2PService 公共方法移除旧房主连接，而非直接改写内部 connections
    expect(p2p.disconnectPeer).toHaveBeenCalledWith('game-ABCDEF');
  });

  it('closes the room when no online candidate remains besides the host', async () => {
    const p2p = {
      getMyPeerId: vi.fn(() => 'game-guest-p1'),
      broadcast: vi.fn(),
      stopHeartbeat: vi.fn(),
      disconnectPeer: vi.fn()
    };
    const handler = createHostMigrationHandler({
      gameId: 'game',
      p2p,
      log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
    });
    const room = {
      code: 'ABCDEF',
      hostId: 'old-host',
      players: [
        { id: 'old-host', name: 'Host', order: 0, isOnline: true },
        { id: 'p1', name: 'Ada', order: 1, isOnline: false }
      ]
    };
    const gameState = { playerId: 'p1', roomCode: 'ABCDEF', isHost: false };
    const setConnectionStatus = vi.fn();

    const result = await handler.handleHostDisconnect(room, gameState, {
      broadcastState: vi.fn(),
      setupHostHandlers: vi.fn(),
      setConnectionStatus
    });

    expect(result).toEqual({ action: 'room_closed' });
    expect(gameState.connected).toBe(false);
    expect(setConnectionStatus).toHaveBeenCalledWith('error', expect.any(String));
    expect(p2p.broadcast).not.toHaveBeenCalled();
  });

  it('excludes the old host from candidates even if still marked online', async () => {
    // 房主骤断、isOnline 尚未翻转时，候选过滤仍应排除旧 hostId，
    // 从而由下一位 order 的在线访客接管（共享 handler 的正确行为）。
    const p2p = {
      getMyPeerId: vi.fn(() => 'game-guest-p1'),
      broadcast: vi.fn(),
      stopHeartbeat: vi.fn(),
      disconnectPeer: vi.fn()
    };
    const handler = createHostMigrationHandler({
      gameId: 'game',
      p2p,
      log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
    });
    const room = {
      code: 'ABCDEF',
      hostId: 'old-host',
      players: [
        { id: 'old-host', name: 'Host', order: 0, isOnline: true },
        { id: 'p1', name: 'Ada', order: 1, isOnline: true }
      ]
    };
    const gameState = { playerId: 'p1', roomCode: 'ABCDEF', isHost: false };

    const result = await handler.handleHostDisconnect(room, gameState, {
      broadcastState: vi.fn(),
      setupHostHandlers: vi.fn()
    });

    // p1（order 1）接管，而非 order 0 的旧房主
    expect(result).toEqual({ action: 'became_host' });
    expect(room.hostId).toBe('p1');
  });
});
