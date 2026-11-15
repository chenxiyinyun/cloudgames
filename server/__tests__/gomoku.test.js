import { describe, it, expect, beforeEach } from 'vitest';
import { createRoomManager } from '../roomManager.js';
import { getGameAdapter } from '../games/index.js';
import { C2S, S2C } from '../protocol.js';
import { GAME_AGENT_GUIDES, getAgentActions, validateAgentIntent } from '../agentProtocol.js';
import { projectRoom } from '../projectRoom.js';
import { BLACK, WHITE } from '../../games/gomoku/src/services/gameEngine.js';

let codeSeq;
function generateRoomCode() {
  codeSeq += 1;
  return `GOM${String(codeSeq).padStart(2, '0')}`;
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

describe('roomManager (gomoku, server-authoritative)', () => {
  // 两名玩家开局
  function createAndStart() {
    const manager = makeManager();
    const conns = {};
    const h = makeConn(); conns.h1 = h;
    manager.handleMessage(h, { type: C2S.CREATE, gameId: 'gomoku', playerId: 'h1', playerName: 'P1' });
    const roomCode = h.last().roomCode;
    const g = makeConn(); conns.g1 = g;
    manager.handleMessage(g, { type: C2S.JOIN, roomCode, playerId: 'g1', playerName: 'G1' });
    manager.handleMessage(h, { type: C2S.INTENT, action: 'START_GAME' });
    return { manager, conns, roomCode, host: h, guest: g };
  }

  it('registers the gomoku adapter', () => {
    expect(getGameAdapter('gomoku')).toBeTruthy();
  });

  it('two players start the game; host plays black and moves first', () => {
    const { host, guest } = createAndStart();
    const room = host.lastRoom();
    expect(room.status).toBe('playing');
    expect(room.phase).toBe('playing');
    expect(room.currentTurn).toBe('black');
    expect(room.players.find(p => p.id === 'h1').role).toBe('black');
    expect(room.players.find(p => p.id === 'g1').role).toBe('white');
    expect(room.turnDeadline).toBe(nowMs + 60_000);
    // 双方视角都能看到完整棋盘（五子棋无隐藏信息）
    expect(host.lastRoom().board).toHaveLength(15);
    expect(guest.lastRoom().board).toHaveLength(15);
  });

  it('rejects START_GAME with fewer than two players', () => {
    const manager = makeManager();
    const h = makeConn();
    manager.handleMessage(h, { type: C2S.CREATE, gameId: 'gomoku', playerId: 'h1', playerName: 'P1' });
    manager.handleMessage(h, { type: C2S.INTENT, action: 'START_GAME' });
    expect(h.last().type).toBe(S2C.ERROR);
    expect(h.lastRoom().phase).toBe('waiting');
  });

  it('host-only START_GAME is rejected from a guest', () => {
    const manager = makeManager();
    const h = makeConn();
    manager.handleMessage(h, { type: C2S.CREATE, gameId: 'gomoku', playerId: 'h1', playerName: 'P1' });
    const roomCode = h.last().roomCode;
    const g = makeConn();
    manager.handleMessage(g, { type: C2S.JOIN, roomCode, playerId: 'g1', playerName: 'G1' });
    manager.handleMessage(g, { type: C2S.INTENT, action: 'START_GAME' });
    expect(g.last().type).toBe(S2C.ERROR);
  });

  it('stones alternate turns and both clients see the update', () => {
    const { manager, host, guest, conns } = createAndStart();
    manager.handleMessage(conns.h1, { type: C2S.INTENT, action: 'PLACE_STONE', payload: { row: 7, col: 7 } });
    expect(host.lastRoom().board[7][7]).toBe(BLACK);
    expect(host.lastRoom().currentTurn).toBe('white');
    expect(guest.lastRoom().board[7][7]).toBe(BLACK);

    // 黑棋连下被拒
    manager.handleMessage(conns.h1, { type: C2S.INTENT, action: 'PLACE_STONE', payload: { row: 0, col: 0 } });
    expect(conns.h1.last().type).toBe(S2C.ERROR);

    // 白棋落子成功
    manager.handleMessage(conns.g1, { type: C2S.INTENT, action: 'PLACE_STONE', payload: { row: 7, col: 8 } });
    expect(guest.lastRoom().board[7][8]).toBe(WHITE);
    expect(host.lastRoom().moveHistory).toHaveLength(2);
  });

  it('five in a row ends the game and broadcasts the winning line', () => {
    const { manager, host, conns } = createAndStart();
    const moves = [
      ['h1', 7, 3], ['g1', 0, 0],
      ['h1', 7, 4], ['g1', 0, 1],
      ['h1', 7, 5], ['g1', 0, 2],
      ['h1', 7, 6], ['g1', 0, 3],
      ['h1', 7, 7]
    ];
    for (const [id, row, col] of moves) {
      manager.handleMessage(conns[id], { type: C2S.INTENT, action: 'PLACE_STONE', payload: { row, col } });
    }
    const room = host.lastRoom();
    expect(room.status).toBe('ended');
    expect(room.winner).toBe('black');
    expect(room.winningLine).toHaveLength(5);
    expect(room.turnDeadline).toBeNull();
  });

  it('turn timeout is enforced by tick and awards the opponent the win', () => {
    const { manager, host, roomCode } = createAndStart();
    expect(host.lastRoom().phase).toBe('playing');
    // 时间推进到黑棋回合超时
    nowMs += 60_001;
    manager.tickAll();
    const room = host.lastRoom();
    expect(room.phase).toBe('ended');
    expect(room.winner).toBe('white');
    expect(room.endReason).toBe('timeout');
    expect(manager.rooms.get(roomCode).state.winner).toBe('white');
  });

  it('resign ends the game with the opponent winning', () => {
    const { manager, conns, host } = createAndStart();
    manager.handleMessage(conns.g1, { type: C2S.INTENT, action: 'RESIGN' });
    expect(host.lastRoom().winner).toBe('black');
    expect(host.lastRoom().endReason).toBe('resign');
  });

  it('restart swaps colors and clears the board', () => {
    const { manager, conns, host } = createAndStart();
    manager.handleMessage(conns.h1, { type: C2S.INTENT, action: 'PLACE_STONE', payload: { row: 7, col: 7 } });
    manager.handleMessage(conns.g1, { type: C2S.INTENT, action: 'RESIGN' });
    expect(host.lastRoom().winner).toBe('black');

    manager.handleMessage(conns.h1, { type: C2S.INTENT, action: 'RESTART_GAME' });
    const room = host.lastRoom();
    expect(room.phase).toBe('playing');
    expect(room.board[7][7]).toBe(0);
    expect(room.players.find(p => p.id === 'h1').role).toBe('white');
    expect(room.players.find(p => p.id === 'g1').role).toBe('black');
    expect(room.currentTurn).toBe('black');
  });

  it('disconnect mid-game marks the player offline but keeps the room', () => {
    const { manager, conns, host, roomCode } = createAndStart();
    // 黑棋先走一步，回合轮到白棋（guest）
    manager.handleMessage(conns.h1, { type: C2S.INTENT, action: 'PLACE_STONE', payload: { row: 7, col: 7 } });
    manager.handleDisconnect(conns.g1);
    const room = host.lastRoom();
    expect(room.players.find(p => p.id === 'g1').isOnline).toBe(false);
    expect(room.phase).toBe('playing');
    // 轮到白棋（已离线）时超时 → 黑棋胜
    nowMs += 60_001;
    manager.tickAll();
    expect(host.lastRoom().winner).toBe('black');
    expect(manager.rooms.has(roomCode)).toBe(true);
  });

  it('reconnect restores the player online', () => {
    const { manager, conns, host, roomCode } = createAndStart();
    const seatToken = conns.g1.ofType(S2C.JOINED).at(-1).playerToken;
    manager.handleDisconnect(conns.g1);
    const g2 = makeConn();
    manager.handleMessage(g2, { type: C2S.JOIN, roomCode, playerId: 'g1', playerName: 'G1', playerToken: seatToken });
    expect(g2.last().type).toBe(S2C.JOINED);
    expect(host.lastRoom().players.find(p => p.id === 'g1').isOnline).toBe(true);
  });

  it('projectRoom exposes the full board to both observers', () => {
    const { manager, conns, roomCode } = createAndStart();
    manager.handleMessage(conns.h1, { type: C2S.INTENT, action: 'PLACE_STONE', payload: { row: 3, col: 4 } });
    const state = manager.rooms.get(roomCode).state;
    const blackView = projectRoom(state, 'h1', 'gomoku');
    const whiteView = projectRoom(state, 'g1', 'gomoku');
    expect(blackView.board[3][4]).toBe(BLACK);
    expect(whiteView.board[3][4]).toBe(BLACK);
    expect(blackView.currentTurn).toBe('white');
    expect(whiteView.moveHistory).toHaveLength(1);
  });
});

describe('gomoku agent protocol', () => {
  function createRoomWithAgent() {
    const manager = makeManager();
    const host = makeConn();
    manager.handleMessage(host, { type: C2S.CREATE, gameId: 'gomoku', playerId: 'human', playerName: '真人房主' });
    const roomCode = host.last().roomCode;
    manager.handleMessage(host, { type: 'AGENT_INVITE' });
    const invitation = host.last();
    const agent = makeConn();
    manager.handleMessage(agent, { type: 'AGENT_JOIN', roomCode, inviteToken: invitation.inviteToken, agentName: '测试 Agent' });
    return { manager, host, agent, roomCode };
  }

  it('agent can see only legal actions and place stones on its turn', () => {
    const { manager, host, agent, roomCode } = createRoomWithAgent();
    expect(agent.last().type).toBe('AGENT_JOINED');
    const agentId = agent.last().playerId;

    // Agent 不能开始（不是房主）
    let state = manager.rooms.get(roomCode).state;
    expect(getAgentActions(state, agentId, 'gomoku').map(a => a.action)).toEqual([]);

    // 房主开始 → Agent 执白
    manager.handleMessage(host, { type: C2S.INTENT, action: 'START_GAME' });
    state = manager.rooms.get(roomCode).state;
    expect(state.players.find(p => p.id === agentId).role).toBe('white');

    // 黑棋（房主）走一步后，Agent 的可用动作出现 PLACE_STONE
    manager.handleMessage(host, { type: C2S.INTENT, action: 'PLACE_STONE', payload: { row: 7, col: 7 } });
    state = manager.rooms.get(roomCode).state;
    const actions = getAgentActions(state, agentId, 'gomoku').map(a => a.action);
    expect(actions).toContain('PLACE_STONE');
    expect(actions).toContain('RESIGN');
    expect(actions).not.toContain('START_GAME');
    expect(actions).not.toContain('END_GAME');

    // Agent 提交合法落子
    manager.handleMessage(agent, { type: 'AGENT_INTENT', action: 'PLACE_STONE', payload: { row: 7, col: 8 }, requestId: 'req-gomoku-01' });
    expect(agent.last().type).toBe('AGENT_STATE');
    expect(agent.last().room.board[7][8]).toBe(WHITE);

    // 非法 payload 被拒绝
    const invalid = { type: 'AGENT_INTENT', action: 'PLACE_STONE', payload: { row: 99, col: 0 }, requestId: 'req-gomoku-02' };
    manager.handleMessage(agent, invalid);
    expect(agent.last().type).toBe('AGENT_ACTION_RESULT');
    expect(agent.last().accepted).toBe(false);
  });

  it('agent payload validation enforces row/col bounds', () => {
    expect(validateAgentIntent('gomoku', 'PLACE_STONE', { row: 0, col: 0 }).error).toBeUndefined();
    expect(validateAgentIntent('gomoku', 'PLACE_STONE', { row: 14, col: 14 }).error).toBeUndefined();
    expect(validateAgentIntent('gomoku', 'PLACE_STONE', { row: 15, col: 0 }).error).toContain('有效整数');
    expect(validateAgentIntent('gomoku', 'PLACE_STONE', { row: 0, col: -1 }).error).toContain('有效整数');
    expect(validateAgentIntent('gomoku', 'PLACE_STONE', { row: 0 }).error).toContain('缺少');
    expect(validateAgentIntent('gomoku', 'PLACE_STONE', { row: 0, col: 0, extra: 1 }).error).toContain('未定义字段');
  });

  it('exposes the gomoku guide through the agent discovery payload', () => {
    const guide = GAME_AGENT_GUIDES['gomoku'];
    expect(guide).toBeTruthy();
    expect(guide.name).toBe('五子棋');
    expect(guide.actions.map(a => a.action)).toEqual(['START_GAME', 'PLACE_STONE', 'RESIGN', 'RESTART_GAME', 'END_GAME']);
  });
});
