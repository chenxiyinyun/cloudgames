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

  it('uses game round and phase for room-state dedupe detail', () => {
    expect(getRoomStateDedupeDetail({
      gameState: { round: 4 },
      phase: 'voting'
    })).toBe('4_voting');
  });
});
