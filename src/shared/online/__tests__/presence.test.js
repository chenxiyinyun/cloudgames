import { describe, it, expect } from 'vitest';
import { markPlayerOnline } from '../presence';

describe('markPlayerOnline', () => {
  it('sets isOnline and refreshes peerId', () => {
    const player = { id: 'p1', isOnline: false, _peerId: 'old' };
    const room = { players: [player] };
    markPlayerOnline(room, player, 'new-peer');
    expect(player.isOnline).toBe(true);
    expect(player._peerId).toBe('new-peer');
  });

  it('removes the player from disconnectedPlayers by id', () => {
    const player = { id: 'p1', isOnline: false };
    const room = {
      disconnectedPlayers: [
        { id: 'p1', name: 'A' },
        { id: 'p2', name: 'B' }
      ]
    };
    markPlayerOnline(room, player, 'peer1');
    expect(room.disconnectedPlayers).toEqual([{ id: 'p2', name: 'B' }]);
  });

  it('is a no-op on disconnectedPlayers when the list is absent', () => {
    const player = { id: 'p1' };
    const room = {};
    expect(() => markPlayerOnline(room, player, 'peer1')).not.toThrow();
    expect(player.isOnline).toBe(true);
    expect(room.disconnectedPlayers).toBeUndefined();
  });

  it('does not touch player.name', () => {
    const player = { id: 'p1', name: 'Original' };
    const room = { disconnectedPlayers: [] };
    markPlayerOnline(room, player, 'peer1');
    expect(player.name).toBe('Original');
  });
});
