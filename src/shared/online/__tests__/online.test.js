import { describe, expect, it, vi } from 'vitest';
import {
  createJoinRequestSender,
  createMessageTypes,
  createOperationDeduper,
  createRoomBroadcaster,
  deepClone
} from '../index';
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

  it('elects the current player when they are the lowest-order online host candidate', async () => {
    const p2p = {
      getMyPeerId: vi.fn(() => 'game-guest-p1'),
      broadcast: vi.fn(),
      stopHeartbeat: vi.fn(),
      connections: [{ peer: 'game-ABCDEF' }]
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
  });
});
