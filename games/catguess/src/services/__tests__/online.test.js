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

  it('includes UI-critical state in room-state dedupe detail', () => {
    expect(getRoomStateDedupeDetail({
      gameState: {
        round: 4,
        storytellerId: 'p1',
        clue: 'dream',
        submittedCards: [{ playerId: 'p2' }],
        shuffledCards: [{ id: 0 }, { id: 1 }],
        votes: [{ voterId: 'p2' }]
      },
      phase: 'voting',
      players: [
        { id: 'p1', isOnline: true, hand: ['moon', 'forest'] },
        { id: 'p2', isOnline: false, hand: ['star'] }
      ]
    })).toBe('4_voting_p1_p1:1:2,p2:0:1_dream_1_2_1');
  });

  it('changes room-state dedupe detail when cards are dealt in the same phase', () => {
    const emptyHands = getRoomStateDedupeDetail({
      gameState: { round: 1, storytellerId: 'p1' },
      phase: 'storyteller_picking',
      players: [{ id: 'p1', isOnline: true, hand: [] }]
    });
    const dealtHands = getRoomStateDedupeDetail({
      gameState: { round: 1, storytellerId: 'p1' },
      phase: 'storyteller_picking',
      players: [{ id: 'p1', isOnline: true, hand: ['moon'] }]
    });

    expect(dealtHands).not.toBe(emptyHands);
  });
});
