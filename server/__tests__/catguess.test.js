import { describe, it, expect, beforeEach } from 'vitest';
import { createRoomManager } from '../roomManager.js';
import { getGameAdapter } from '../games/index.js';
import { C2S, S2C } from '../protocol.js';

let codeSeq;
function generateRoomCode() {
  codeSeq += 1;
  return `CAT${String(codeSeq).padStart(2, '0')}`;
}

function makeConn() {
  const messages = [];
  return {
    roomCode: null,
    playerId: null,
    send: (obj) => messages.push(JSON.parse(JSON.stringify(obj))),
    messages,
    last() { return messages[messages.length - 1]; },
    ofType(type) { return messages.filter(m => m.type === type); },
    lastRoom() { const s = this.ofType(S2C.STATE).at(-1) || this.ofType(S2C.JOINED).at(-1); return s?.room; }
  };
}

let nowMs;
function makeManager() {
  return createRoomManager({ getGameAdapter, generateRoomCode, now: () => nowMs });
}

beforeEach(() => {
  codeSeq = 0;
  nowMs = 1_000_000;
});

describe('roomManager (catguess, server-authoritative)', () => {
  // 3 名玩家：h1（房主/首位说书人）、g1、g2
  function createAndStart() {
    const manager = makeManager();
    const h = makeConn();
    const g1 = makeConn();
    const g2 = makeConn();
    manager.handleMessage(h, { type: C2S.CREATE, gameId: 'catguess', playerId: 'h1', playerName: '阿狸' });
    const roomCode = h.last().roomCode;
    manager.handleMessage(g1, { type: C2S.JOIN, roomCode, playerId: 'g1', playerName: '小喵' });
    manager.handleMessage(g2, { type: C2S.JOIN, roomCode, playerId: 'g2', playerName: '团子' });
    manager.handleMessage(h, { type: C2S.INTENT, action: 'START_GAME' });
    return { manager, h, g1, g2, roomCode };
  }

  it('registers the catguess adapter', () => {
    expect(getGameAdapter('catguess')).toBeTruthy();
  });

  it('START_GAME deals hands and enters storyteller picking', () => {
    const { h } = createAndStart();
    const room = h.lastRoom();
    expect(room.phase).toBe('storyteller_picking');
    expect(room.gameState.storytellerId).toBe('h1');
    expect(room.players.every(p => p.hand.length === 5)).toBe(true);
  });

  it('rejects START_GAME with fewer than 3 players', () => {
    const manager = makeManager();
    const h = makeConn();
    const g1 = makeConn();
    manager.handleMessage(h, { type: C2S.CREATE, gameId: 'catguess', playerId: 'h1', playerName: '阿狸' });
    const roomCode = h.last().roomCode;
    manager.handleMessage(g1, { type: C2S.JOIN, roomCode, playerId: 'g1', playerName: '小喵' });
    manager.handleMessage(h, { type: C2S.INTENT, action: 'START_GAME' });
    expect(h.last().type).toBe(S2C.ERROR);
  });

  it('host-only START_GAME is rejected from a guest', () => {
    const manager = makeManager();
    const h = makeConn();
    const g1 = makeConn();
    manager.handleMessage(h, { type: C2S.CREATE, gameId: 'catguess', playerId: 'h1', playerName: '阿狸' });
    const roomCode = h.last().roomCode;
    manager.handleMessage(g1, { type: C2S.JOIN, roomCode, playerId: 'g1', playerName: '小喵' });
    manager.handleMessage(g1, { type: C2S.INTENT, action: 'START_GAME' });
    expect(g1.last().type).toBe(S2C.ERROR);
  });

  it('plays a full round through to scoring', () => {
    const { manager, h, g1, g2 } = createAndStart();
    // 说书人 h1 出题
    manager.handleMessage(h, { type: C2S.INTENT, action: 'SUBMIT_STORY', payload: { cardIndex: 0, clue: '毛茸茸的' } });
    expect(h.lastRoom().phase).toBe('others_picking');
    // 其他人出牌
    manager.handleMessage(g1, { type: C2S.INTENT, action: 'SUBMIT_CARD', payload: { cardIndex: 0 } });
    manager.handleMessage(g2, { type: C2S.INTENT, action: 'SUBMIT_CARD', payload: { cardIndex: 0 } });
    expect(h.lastRoom().phase).toBe('revealing');
    // 投票（投 0 号牌）
    manager.handleMessage(g1, { type: C2S.INTENT, action: 'SUBMIT_VOTE', payload: { votedCardId: 0 } });
    manager.handleMessage(g2, { type: C2S.INTENT, action: 'SUBMIT_VOTE', payload: { votedCardId: 0 } });
    expect(h.lastRoom().phase).toBe('scoring');
  });

  it('tick auto-advances storyteller picking after the deadline', () => {
    const { manager, h } = createAndStart();
    expect(h.lastRoom().phase).toBe('storyteller_picking');
    // 进入计时（首个 tick 设 deadline），再越过 60s
    nowMs += 1000; manager.tickAll();
    nowMs += 61_000; manager.tickAll();
    expect(h.lastRoom().phase).toBe('others_picking');
  });

  it('tick auto-advances scoring to the next round after the deadline', () => {
    const { manager, h, g1, g2 } = createAndStart();
    manager.handleMessage(h, { type: C2S.INTENT, action: 'SUBMIT_STORY', payload: { cardIndex: 0, clue: '毛茸茸的' } });
    manager.handleMessage(g1, { type: C2S.INTENT, action: 'SUBMIT_CARD', payload: { cardIndex: 0 } });
    manager.handleMessage(g2, { type: C2S.INTENT, action: 'SUBMIT_CARD', payload: { cardIndex: 0 } });
    manager.handleMessage(g1, { type: C2S.INTENT, action: 'SUBMIT_VOTE', payload: { votedCardId: 0 } });
    manager.handleMessage(g2, { type: C2S.INTENT, action: 'SUBMIT_VOTE', payload: { votedCardId: 0 } });
    expect(h.lastRoom().phase).toBe('scoring');
    const round = h.lastRoom().gameState.round;
    nowMs += 1000; manager.tickAll();
    nowMs += 16_000; manager.tickAll();
    const room = h.lastRoom();
    // 要么进入下一轮的说书人选择，要么（达到目标分）结束
    expect(['storyteller_picking', 'ended']).toContain(room.phase);
    if (room.phase === 'storyteller_picking') {
      expect(room.gameState.round).toBe(round + 1);
    }
  });
});
