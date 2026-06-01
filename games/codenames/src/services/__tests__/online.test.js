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

  it('includes round and phase in room-state dedupe detail', () => {
    const detail = getRoomStateDedupeDetail({ currentRound: 2, phase: 'guessing' });
    expect(detail.startsWith('2_guessing_')).toBe(true);
  });

  it('produces different detail when a player goes offline within the same round/phase', () => {
    const base = {
      currentRound: 1,
      phase: 'guessing',
      players: [
        { id: 'p1', isOnline: true, team: 'white' },
        { id: 'p2', isOnline: true, team: 'black' }
      ]
    };
    const afterDisconnect = {
      ...base,
      players: [
        { id: 'p1', isOnline: true, team: 'white' },
        { id: 'p2', isOnline: false, team: 'black' }
      ],
      disconnectedPlayers: [{ id: 'p2' }]
    };
    expect(getRoomStateDedupeDetail(base)).not.toBe(getRoomStateDedupeDetail(afterDisconnect));
  });

  it('produces different detail when votes advance within the same round/phase', () => {
    const base = {
      currentRound: 1,
      phase: 'team_voting',
      teamVotes: { white: { finalGuess: null }, black: { finalGuess: null } }
    };
    const afterVote = {
      currentRound: 1,
      phase: 'team_voting',
      teamVotes: { white: { finalGuess: [1, 2, 3] }, black: { finalGuess: null } }
    };
    expect(getRoomStateDedupeDetail(base)).not.toBe(getRoomStateDedupeDetail(afterVote));
  });

  it('produces a stable detail for identical room snapshots', () => {
    const room = {
      currentRound: 3,
      phase: 'guessing',
      players: [{ id: 'p1', isOnline: true, team: 'white' }],
      clues: ['a', 'b']
    };
    expect(getRoomStateDedupeDetail({ ...room })).toBe(getRoomStateDedupeDetail({ ...room }));
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
