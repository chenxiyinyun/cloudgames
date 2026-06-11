import { describe, it, expect, beforeEach } from 'vitest';
import { createRoomManager } from '../roomManager.js';
import { getGameAdapter } from '../games/index.js';
import { C2S, S2C } from '../protocol.js';

// 确定性房间号
let codeSeq;
function generateRoomCode() {
  codeSeq += 1;
  return `TER${String(codeSeq).padStart(2, '0')}`;
}

function makeConn() {
  const messages = [];
  return {
    roomCode: null,
    playerId: null,
    send: (obj) => messages.push(JSON.parse(JSON.stringify(obj))),
    messages,
    last() { return messages[messages.length - 1]; },
    ofType(type) { return messages.filter(m => m.type === type); }
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

describe('roomManager (territory-control, server-authoritative)', () => {
  function createAndStart() {
    const manager = makeManager();
    const host = makeConn();
    const guest = makeConn();
    manager.handleMessage(host, { type: C2S.CREATE, gameId: 'territory', playerId: 'h1', playerName: '阿狸' });
    const roomCode = host.last().roomCode;
    manager.handleMessage(guest, { type: C2S.JOIN, roomCode, playerId: 'g1', playerName: '小喵' });
    manager.handleMessage(host, { type: C2S.INTENT, action: 'START_GAME' });
    return { manager, host, guest, roomCode };
  }

  it('registers the territory adapter', () => {
    expect(getGameAdapter('territory')).toBeTruthy();
  });

  it('START_GAME moves the room to playing and deals a map to both clients', () => {
    const { host, guest } = createAndStart();
    const hostState = host.ofType(S2C.STATE).at(-1);
    const guestState = guest.ofType(S2C.STATE).at(-1);
    expect(hostState.room.phase).toBe('playing');
    expect(guestState.room.phase).toBe('playing');
    expect(hostState.room.gameState.territories.length).toBeGreaterThan(0);
  });

  it('host-only intents are rejected from a guest', () => {
    const { manager, guest } = createAndStart();
    manager.handleMessage(guest, { type: C2S.INTENT, action: 'END_GAME' });
    expect(guest.last().type).toBe(S2C.ERROR);
  });

  it('tick broadcasts every tick while playing (production keeps state flowing)', () => {
    const { manager, host } = createAndStart();
    const before = host.ofType(S2C.STATE).length;
    nowMs += 1000;
    manager.tickAll();
    nowMs += 1000;
    manager.tickAll();
    const after = host.ofType(S2C.STATE).length;
    // 进行中每个 tick 都应广播（adapter.tick 返回 true）
    expect(after).toBe(before + 2);
  });

  it('does not broadcast on tick once the game has ended', () => {
    const { manager, host } = createAndStart();
    manager.handleMessage(host, { type: C2S.INTENT, action: 'END_GAME' });
    const before = host.ofType(S2C.STATE).length;
    nowMs += 1000;
    manager.tickAll();
    expect(host.ofType(S2C.STATE).length).toBe(before); // ENDED 后不再广播
  });
});
