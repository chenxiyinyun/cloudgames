import { describe, expect, it } from 'vitest';
import { GAME_ID, MSG, generateOpKey, getRoomStateDedupeDetail } from '../online';

describe('catguess online adapter', () => {
  it('namespaces the game and exposes message types', () => {
    expect(GAME_ID).toBe('catguess');
    expect(MSG.ROOM_STATE).toBe('ROOM_STATE');
    expect(MSG.SUBMIT_STORY).toBe('SUBMIT_STORY');
  });

  it('builds operation keys with catguess payload shape', () => {
    expect(generateOpKey(MSG.SUBMIT_STORY, {
      roomCode: 'ABCDEF',
      playerId: 'p1',
      cardIndex: 3,
      clue: 'dream'
    })).toBe('SUBMIT_STORY_ABCDEF_p1_3_dream');
  });

  it('includes round, phase, and updatedAt in room-state dedupe detail', () => {
    expect(getRoomStateDedupeDetail({
      gameState: {
        round: 4,
        storytellerId: 'p1',
        clue: 'dream',
        submittedCards: [{ playerId: 'p2' }],
        shuffledCards: [{ id: 0 }, { id: 1 }],
        votes: [{ voterId: 'p2' }],
        scores: { p1: 6, p2: 3 },
        roundScores: { p1: 3 }
      },
      phase: 'voting',
      updatedAt: 1234567890,
      players: [
        { id: 'p1', name: 'Cat', isOnline: true, hand: ['moon', 'forest'] },
        { id: 'p2', name: 'Fox', isOnline: false, hand: ['star'] }
      ]
    })).toBe('4_voting_1234567890');
  });

  it('changes dedupe detail when updatedAt changes (same phase and round)', () => {
    const base = {
      gameState: {
        round: 4, storytellerId: 'p1', clue: 'dream',
        submittedCards: [{ playerId: 'p2' }],
        shuffledCards: [{ id: 0 }, { id: 1 }],
        votes: [{ voterId: 'p2' }],
        scores: { p1: 6, p2: 3 }
      },
      phase: 'scoring',
      updatedAt: 1000,
      players: [{ id: 'p1', name: 'Cat', isOnline: true, hand: [] }]
    };
    const bumped = {
      ...base,
      updatedAt: 2000,
      gameState: { ...base.gameState, scores: { p1: 9, p2: 3 } }
    };
    expect(getRoomStateDedupeDetail(bumped)).not.toBe(getRoomStateDedupeDetail(base));
  });

  it('changes room-state dedupe detail when cards are dealt in the same phase (updatedAt differs)', () => {
    const emptyHands = getRoomStateDedupeDetail({
      gameState: { round: 1, storytellerId: 'p1' },
      phase: 'storyteller_picking',
      updatedAt: 1000,
      players: [{ id: 'p1', isOnline: true, hand: [] }]
    });
    const dealtHands = getRoomStateDedupeDetail({
      gameState: { round: 1, storytellerId: 'p1' },
      phase: 'storyteller_picking',
      updatedAt: 2000,
      players: [{ id: 'p1', isOnline: true, hand: ['moon'] }]
    });

    expect(dealtHands).not.toBe(emptyHands);
  });

  it('exposes REQUEST_STATE message type', () => {
    expect(MSG.REQUEST_STATE).toBe('REQUEST_STATE');
  });

  it('REQUEST_STATE op key is idempotent for same request', () => {
    const key1 = generateOpKey(MSG.REQUEST_STATE, {
      roomCode: 'ABCDEF',
      playerId: 'p1',
      requestFull: true
    });
    const key2 = generateOpKey(MSG.REQUEST_STATE, {
      roomCode: 'ABCDEF',
      playerId: 'p1',
      requestFull: false
    });
    // Same roomCode + playerId → same key (idempotent)
    expect(key1).toBe(key2);
  });

  it('REQUEST_STATE op key changes for different player', () => {
    const key1 = generateOpKey(MSG.REQUEST_STATE, {
      roomCode: 'ABCDEF',
      playerId: 'p1'
    });
    const key2 = generateOpKey(MSG.REQUEST_STATE, {
      roomCode: 'ABCDEF',
      playerId: 'p2'
    });
    expect(key1).not.toBe(key2);
  });
});
