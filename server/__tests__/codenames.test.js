import { describe, it, expect, beforeEach } from 'vitest';
import { createRoomManager } from '../roomManager.js';
import { getGameAdapter } from '../games/index.js';
import { C2S, S2C } from '../protocol.js';

let codeSeq;
function generateRoomCode() {
  codeSeq += 1;
  return `COD${String(codeSeq).padStart(2, '0')}`;
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

describe('roomManager (codenames, server-authoritative)', () => {
  // 4 名玩家（2v2）
  function createAndStart() {
    const manager = makeManager();
    const conns = {};
    const h = makeConn(); conns.h1 = h;
    manager.handleMessage(h, { type: C2S.CREATE, gameId: 'codenames', playerId: 'h1', playerName: 'P1' });
    const roomCode = h.last().roomCode;
    for (const id of ['g1', 'g2', 'g3']) {
      const c = makeConn(); conns[id] = c;
      manager.handleMessage(c, { type: C2S.JOIN, roomCode, playerId: id, playerName: id.toUpperCase() });
    }
    manager.handleMessage(h, { type: C2S.INTENT, action: 'START_GAME' });
    return { manager, conns, roomCode, host: h };
  }

  it('registers the codenames adapter', () => {
    expect(getGameAdapter('codenames')).toBeTruthy();
  });

  it('START_GAME with 4 players enters encrypting with split keywords', () => {
    const { host } = createAndStart();
    const room = host.lastRoom();
    expect(room.status).toBe('playing');
    expect(room.phase).toBe('encrypting');
    expect(room.whiteKeywords).toHaveLength(4);
    expect(room.blackKeywords).toHaveLength(4);
    expect(room.encryptor).toBeTruthy();
  });

  it('host-only START_GAME is rejected from a guest', () => {
    const manager = makeManager();
    const h = makeConn();
    manager.handleMessage(h, { type: C2S.CREATE, gameId: 'codenames', playerId: 'h1', playerName: 'P1' });
    const roomCode = h.last().roomCode;
    const g1 = makeConn();
    manager.handleMessage(g1, { type: C2S.JOIN, roomCode, playerId: 'g1', playerName: 'G1' });
    manager.handleMessage(g1, { type: C2S.INTENT, action: 'START_GAME' });
    expect(g1.last().type).toBe(S2C.ERROR);
  });

  it('the current encryptor can submit clues and advance to guessing', () => {
    const { manager, conns, host } = createAndStart();
    const encryptorId = host.lastRoom().encryptor;
    const encConn = conns[encryptorId];
    manager.handleMessage(encConn, {
      type: C2S.INTENT, action: 'SUBMIT_CLUES', payload: { clues: ['AAA', 'BBB', 'CCC'] }
    });
    expect(host.lastRoom().phase).toBe('guessing');
  });

  it('non-encryptor submitting clues gets an error', () => {
    const { manager, conns, host } = createAndStart();
    const encryptorId = host.lastRoom().encryptor;
    const otherId = ['h1', 'g1', 'g2', 'g3'].find(id => id !== encryptorId);
    manager.handleMessage(conns[otherId], {
      type: C2S.INTENT, action: 'SUBMIT_CLUES', payload: { clues: ['AAA', 'BBB', 'CCC'] }
    });
    expect(conns[otherId].last().type).toBe(S2C.ERROR);
  });

  it('disconnect mid-game pauses; reconnect resumes to the saved phase', () => {
    const { manager, conns, roomCode, host } = createAndStart();
    expect(host.lastRoom().phase).toBe('encrypting');

    // g3 掉线 → 房间暂停
    manager.handleDisconnect(conns.g3);
    expect(host.lastRoom().phase).toBe('paused');
    expect(host.lastRoom().savedPhase).toBe('encrypting');

    // g3 重连（同 playerId）→ 全员在线，恢复到原阶段
    const g3b = makeConn();
    manager.handleMessage(g3b, { type: C2S.JOIN, roomCode, playerId: 'g3', playerName: 'G3' });
    expect(host.lastRoom().phase).toBe('encrypting');
  });
});
