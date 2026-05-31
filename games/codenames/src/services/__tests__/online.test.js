import { describe, expect, it, vi } from 'vitest';
import {
  GAME_ID,
  MSG,
  createJoinRequestSenderForGame,
  generateOpKey,
  getRoomStateDedupeDetail
} from '../online';

describe('codenames online adapter', () => {
  it('namespaces the game and exposes message types', () => {
    expect(GAME_ID).toBe('codenames');
    expect(MSG.ROOM_STATE).toBe('ROOM_STATE');
    expect(MSG.SUBMIT_CLUES).toBe('SUBMIT_CLUES');
  });

  it('builds operation keys with codenames payload shape', () => {
    expect(generateOpKey(MSG.SUBMIT_CLUES, {
      roomCode: 'ABCDEF',
      playerId: 'p1',
      clues: ['red', 'moon']
    })).toBe('SUBMIT_CLUES_ABCDEF_p1_red,moon');
  });

  it('uses round and phase for room-state dedupe detail', () => {
    expect(getRoomStateDedupeDetail({ currentRound: 2, phase: 'guessing' })).toBe('2_guessing');
  });

  it('creates a codenames join sender', () => {
    const p2p = {
      getHostPeerId: roomCode => `codenames-${roomCode}`,
      getConnectedPeers: () => ['codenames-ABCDEF'],
      getMyPeerId: () => 'guest-1',
      sendTo: vi.fn(() => true)
    };

    const sendJoinRequest = createJoinRequestSenderForGame({
      p2p,
      getRoomCode: () => 'ABCDEF'
    });

    expect(sendJoinRequest('p1', 'Ada')).toBe(true);
    expect(p2p.sendTo).toHaveBeenCalledWith('codenames-ABCDEF', MSG.JOIN_REQUEST, {
      playerId: 'p1',
      playerName: 'Ada',
      originalPeerId: 'guest-1',
      isReconnect: false
    });
  });
});
