import { describe, it, expect, beforeEach } from 'vitest';
import { createRoomManager } from '../roomManager.js';
import { getGameAdapter } from '../games/index.js';
import { C2S, S2C } from '../protocol.js';

// 确定性房间号，避免依赖 crypto 随机
let codeSeq;
function generateRoomCode() {
  codeSeq += 1;
  return `ROOM${String(codeSeq).padStart(2, '0')}`;
}

// 假连接：把收到的消息以 JSON 快照存下（模拟上线序列化，避免后续 mutation 影响断言）
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
  return createRoomManager({
    getGameAdapter,
    generateRoomCode,
    now: () => nowMs
  });
}

beforeEach(() => {
  codeSeq = 0;
  nowMs = 1_000_000;
});

describe('roomManager (bomb-defuse, server-authoritative)', () => {
  function createAndJoin() {
    const manager = makeManager();
    const host = makeConn();
    const guest = makeConn();
    manager.handleMessage(host, { type: C2S.CREATE, gameId: 'bombdefuse', playerId: 'h1', playerName: '阿狸' });
    const roomCode = host.last().roomCode;
    manager.handleMessage(guest, { type: C2S.JOIN, roomCode, playerId: 'g1', playerName: '小喵' });
    return { manager, host, guest, roomCode };
  }

  it('CREATE registers a room with the creator as host', () => {
    const manager = makeManager();
    const host = makeConn();
    manager.handleMessage(host, { type: C2S.CREATE, gameId: 'bombdefuse', playerId: 'h1', playerName: '阿狸' });

    const joined = host.last();
    expect(joined.type).toBe(S2C.JOINED);
    expect(joined.roomCode).toBe('ROOM01');
    expect(joined.room.hostId).toBe('h1');
    expect(joined.room.players).toHaveLength(1);
    expect(manager.rooms.has('ROOM01')).toBe(true);
  });

  it('rejects CREATE for an unknown game', () => {
    const manager = makeManager();
    const conn = makeConn();
    manager.handleMessage(conn, { type: C2S.CREATE, gameId: 'nope', playerId: 'h1', playerName: 'x' });
    expect(conn.last()).toMatchObject({ type: S2C.ERROR, fatal: true });
    expect(manager.rooms.size).toBe(0);
  });

  it('JOIN adds a guest, assigns roles, and broadcasts to all', () => {
    const { host, guest } = createAndJoin();

    expect(guest.last().type).toBe(S2C.JOINED);
    // host received a STATE broadcast when guest joined
    const hostState = host.ofType(S2C.STATE).pop();
    expect(hostState.room.players).toHaveLength(2);
    expect(hostState.room.players.every(p => p.role)).toBe(true);
  });

  it('JOIN to a missing room returns a fatal error', () => {
    const manager = makeManager();
    const conn = makeConn();
    manager.handleMessage(conn, { type: C2S.JOIN, roomCode: 'ZZZZZZ', playerId: 'g1', playerName: 'x' });
    expect(conn.last()).toMatchObject({ type: S2C.ERROR, fatal: true });
  });

  it('START_GAME from host starts the game; from a non-host it is rejected', () => {
    const { manager, host, guest, roomCode } = createAndJoin();

    // 访客无权开始
    manager.handleMessage(guest, { type: C2S.INTENT, action: 'START_GAME' });
    expect(guest.last()).toMatchObject({ type: S2C.ERROR });
    expect(manager.rooms.get(roomCode).state.phase).toBe('waiting');

    // 房主开始
    manager.handleMessage(host, { type: C2S.INTENT, action: 'START_GAME' });
    expect(manager.rooms.get(roomCode).state.phase).toBe('playing');
    // 双方都收到了 playing 状态
    expect(host.ofType(S2C.STATE).pop().room.phase).toBe('playing');
    expect(guest.ofType(S2C.STATE).pop().room.phase).toBe('playing');
  });

  it('an invalid intent errors back to the sender only (no broadcast)', () => {
    const { manager, host, guest, roomCode } = createAndJoin();
    manager.handleMessage(host, { type: C2S.INTENT, action: 'START_GAME' });

    const guestStatesBefore = guest.ofType(S2C.STATE).length;
    // 不存在的模块 → 引擎返回 error
    manager.handleMessage(guest, {
      type: C2S.INTENT,
      action: 'SUBMIT_MODULE_ACTION',
      payload: { moduleId: 'does-not-exist', action: {} }
    });
    expect(guest.last()).toMatchObject({ type: S2C.ERROR });
    // 出错不广播：访客没有收到新的 STATE
    expect(guest.ofType(S2C.STATE).length).toBe(guestStatesBefore);
    expect(manager.rooms.get(roomCode).state.phase).toBe('playing');
  });

  it('server tick detonates the bomb past the deadline and broadcasts the phase change', () => {
    const { manager, host, guest, roomCode } = createAndJoin();
    manager.handleMessage(host, { type: C2S.INTENT, action: 'START_GAME' });

    const room = manager.rooms.get(roomCode);
    room.state.gameState.deadlineAt = nowMs + 5000;

    // 截止前 tick：无变化、不广播
    const before = guest.ofType(S2C.STATE).length;
    manager.tickAll();
    expect(guest.ofType(S2C.STATE).length).toBe(before);
    expect(room.state.phase).toBe('playing');

    // 越过截止时间 tick：爆炸 + 广播
    nowMs += 6000;
    manager.tickAll();
    expect(room.state.phase).toBe('exploded');
    expect(guest.ofType(S2C.STATE).pop().room.phase).toBe('exploded');
  });

  it('disconnect in lobby removes the player and reassigns host if needed', () => {
    const { manager, host, roomCode } = createAndJoin();

    manager.handleDisconnect(host);
    const room = manager.rooms.get(roomCode);
    expect(room).toBeDefined();
    expect(room.state.players.find(p => p.id === 'h1')).toBeUndefined();
    // host 迁移到剩下的玩家（游戏规则层面，连接不受影响）
    expect(room.state.hostId).toBe('g1');
  });

  it('reconnect with the same playerId during play marks the player back online', () => {
    const { manager, host, guest, roomCode } = createAndJoin();
    manager.handleMessage(host, { type: C2S.INTENT, action: 'START_GAME' });

    // 游戏中访客掉线 → 标记离线、保留在房
    manager.handleDisconnect(guest);
    const room = manager.rooms.get(roomCode);
    expect(room.state.players.find(p => p.id === 'g1').isOnline).toBe(false);

    // 同 playerId 重新 JOIN → 重新上线
    const guest2 = makeConn();
    manager.handleMessage(guest2, { type: C2S.JOIN, roomCode, playerId: 'g1', playerName: '小喵' });
    expect(guest2.last().type).toBe(S2C.JOINED);
    expect(room.state.players.find(p => p.id === 'g1').isOnline).toBe(true);
  });

  it('removes the room once the last connection leaves', () => {
    const { manager, host, guest, roomCode } = createAndJoin();
    manager.handleDisconnect(host);
    manager.handleDisconnect(guest);
    expect(manager.rooms.has(roomCode)).toBe(false);
  });
});
