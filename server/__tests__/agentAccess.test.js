import { describe, it, expect, beforeEach } from 'vitest';
import { createRoomManager } from '../roomManager.js';
import { getGameAdapter } from '../games/index.js';
import { projectRoom } from '../projectRoom.js';
import { createInitialRoom as createCodenames, startGame as startCodenames } from '../../games/codenames/src/services/gameEngine.js';
import { createInitialRoom as createCatguess, startGame as startCatguess } from '../../games/catguess/src/services/gameEngine.js';
import { DEFAULT_WORD_POOL } from '../../games/catguess/src/services/wordPool.js';
import { createInitialRoom as createBomb, addPlayerToRoom as addBombPlayer, startGame as startBomb } from '../../games/bomb-defuse/src/services/gameEngine.js';

let clock;
let code = 0;
const manager = () => createRoomManager({ getGameAdapter, generateRoomCode: () => `AGENT${String(++code).padStart(2, '0')}`.slice(-6), now: () => clock });
function conn() {
  return { roomCode: null, playerId: null, messages: [], send(message) { this.messages.push(JSON.parse(JSON.stringify(message))); }, last() { return this.messages.at(-1); } };
}
function hostRoom(gameId = 'bombdefuse') {
  const roomManager = manager();
  const host = conn();
  roomManager.handleMessage(host, { type: 'CREATE', gameId, playerId: 'human', playerName: '真人房主' });
  const roomCode = host.last().roomCode;
  return { roomManager, host, roomCode };
}
function issue(roomManager, host) {
  roomManager.handleMessage(host, { type: 'AGENT_INVITE' });
  return host.last();
}
function joinAgent(roomManager, invitation, agentName = '测试 Agent') {
  const agent = conn();
  roomManager.handleMessage(agent, { type: 'AGENT_JOIN', roomCode: invitation.roomCode, inviteToken: invitation.inviteToken, agentName });
  return agent;
}

beforeEach(() => { clock = 1_000_000; code = 0; });

describe('Agent 身份、邀请与动作', () => {
  it('真人协议不能伪造 Agent 身份，Agent 标签由服务端生成', () => {
    const { roomManager, host, roomCode } = hostRoom();
    const fake = conn();
    roomManager.handleMessage(fake, { type: 'JOIN', roomCode, playerId: 'agent_fake', playerName: '伪 Agent' });
    expect(fake.last().type).toBe('ERROR');
    const invitation = issue(roomManager, host);
    const agent = joinAgent(roomManager, invitation);
    expect(agent.last().type).toBe('AGENT_JOINED');
    expect(agent.last().playerType).toBe('agent');
    expect(agent.last().agentToken).toHaveLength(43);
    expect(host.last().room.players.find(player => player.id === agent.last().playerId).type).toBe('agent');
    expect(JSON.stringify(roomManager.rooms.get(roomCode))).not.toContain(invitation.inviteToken);
    expect(JSON.stringify(roomManager.rooms.get(roomCode))).not.toContain(agent.last().agentToken);
  });

  it('邀请不能跨房间、过期后失效，非房主不能签发', () => {
    const { roomManager, host, roomCode } = hostRoom();
    const invitation = issue(roomManager, host);
    expect(invitation.expiresAt - clock).toBe(30 * 60_000);
    const missing = conn();
    roomManager.handleMessage(missing, { type: 'AGENT_JOIN', roomCode: 'ZZZZZZ', inviteToken: invitation.inviteToken });
    expect(missing.last().code).toBe('ROOM_NOT_FOUND');
    clock += 30 * 60_000 + 1;
    const late = joinAgent(roomManager, invitation);
    expect(late.last().code).toBe('INVITE_INVALID');
    const guest = conn();
    roomManager.handleMessage(guest, { type: 'JOIN', roomCode, playerId: 'guest', playerName: '真人' });
    roomManager.handleMessage(guest, { type: 'AGENT_INVITE' });
    expect(guest.last().message).toContain('只有房主');
  });

  it('Agent 可重连，非法 token 不能读取或行动', () => {
    const { roomManager, host } = hostRoom();
    const agent = joinAgent(roomManager, issue(roomManager, host));
    const { playerId, agentToken, roomCode } = agent.last();
    const restored = conn();
    roomManager.handleMessage(restored, { type: 'AGENT_JOIN', roomCode, playerId, agentToken });
    expect(restored.last().type).toBe('AGENT_JOINED');
    expect(restored.last().agentToken).toBeUndefined();
    const attacker = conn();
    roomManager.handleMessage(attacker, { type: 'AGENT_JOIN', roomCode, playerId, agentToken: 'wrong' });
    expect(attacker.last().code).toBe('AGENT_AUTH_FAILED');
    roomManager.handleMessage(restored, { type: 'AGENT_INTENT', action: 'START_GAME', payload: {}, requestId: 'request-001' });
    expect(restored.last().type).toBe('AGENT_ACTION_RESULT');
    expect(restored.last().accepted).toBe(false);
    expect(restored.last().reason).toContain('只有房主');
  });

  it('Agent 非法 payload 被拒绝，requestId 重试不会重复行动', () => {
    const { roomManager, host, roomCode } = hostRoom();
    const agent = joinAgent(roomManager, issue(roomManager, host));
    expect(agent.last().type, JSON.stringify(agent.last())).toBe('AGENT_JOINED');
    const agentId = agent.last().playerId;
    const state = roomManager.rooms.get(roomCode).state;
    roomManager.handleMessage(host, { type: 'INTENT', action: 'ASSIGN_ROLES', payload: { roleByPlayerId: { human: 'expert', [agentId]: 'defuser' } } });
    roomManager.handleMessage(host, { type: 'INTENT', action: 'START_GAME', payload: {} });
    const invalid = { type: 'AGENT_INTENT', action: 'SUBMIT_MODULE_ACTION', payload: { moduleId: 'x', action: { type: 'cut_wire' } }, requestId: 'request-002' };
    roomManager.handleMessage(agent, invalid);
    expect(agent.last().type, JSON.stringify(agent.last())).toBe('AGENT_ACTION_RESULT');
    expect(agent.last().accepted).toBe(false);
    expect(agent.last().reason).toContain('模块不存在');
    const module = state.gameState.modules.find(item => item.type === 'wires');
    const action = { type: 'cut_wire', wireId: module.bombView.wires[0].id };
    const message = { type: 'AGENT_INTENT', action: 'SUBMIT_MODULE_ACTION', payload: { moduleId: module.id, action }, requestId: 'request-003' };
    roomManager.handleMessage(agent, message);
    const first = agent.last();
    expect(['AGENT_STATE', 'AGENT_ACTION_RESULT']).toContain(first.type);
    expect(first.requestId).toBe('request-003');
    const logLength = state.gameState.actionLog.length;
    roomManager.handleMessage(agent, message);
    expect(state.gameState.actionLog.length).toBe(logLength);
    expect(state.players.find(player => player.id === agentId).role).toBe('defuser');
  });

  it('HTTP 轮询操作复用相同鉴权与状态投影', () => {
    const { roomManager, host } = hostRoom();
    const invitation = issue(roomManager, host);
    const http = conn();
    roomManager.handleMessage(http, { type: 'AGENT_JOIN', roomCode: invitation.roomCode, inviteToken: invitation.inviteToken, agentName: 'HTTP Agent' });
    const { playerId, agentToken, roomCode } = http.last();
    const state = conn();
    roomManager.handleMessage(state, { type: 'AGENT_HTTP', operation: 'state', roomCode, playerId, agentToken });
    expect(state.last().type).toBe('AGENT_STATE');
    expect(state.last().playerId).toBe(playerId);
    expect(roomManager.rooms.get(roomCode).conns.size).toBe(2);
  });
});

describe('按玩家隐私状态投影', () => {
  it('截码战关键词和密码仅当前情报官可见', () => {
    const room = createCodenames('h1', '一', 'SECRET');
    for (const [id, name] of [['h2', '二'], ['h3', '三'], ['h4', '四']]) room.players.push({ id, name, isOnline: true, order: room.players.length });
    startCodenames(room);
    const encryptor = projectRoom(room, room.encryptor, 'codenames');
    const observer = projectRoom(room, room.players.find(player => player.id !== room.encryptor).id, 'codenames');
    expect(encryptor.currentCode).toHaveLength(3);
    expect(observer.currentCode).toEqual([]);
    expect(observer.whiteKeywords).toEqual([]);
    expect(observer.blackKeywords).toEqual([]);
    const ownKeywords = room[`${room.players.find(player => player.id === room.encryptor).team}Keywords`];
    expect(JSON.stringify(observer)).not.toContain(JSON.stringify(ownKeywords));
    expect(observer.players.every(player => player.type === 'human')).toBe(true);
  });

  it('喵喵猜词不泄露他人手牌、牌库、谜底和未公开投票归属', () => {
    const room = createCatguess('h1', '一', 'SECRET', DEFAULT_WORD_POOL);
    for (const [id, name] of [['h2', '二'], ['h3', '三']]) room.players.push({ id, name, isOnline: true, order: room.players.length, hand: [] });
    startCatguess(room);
    const view = projectRoom(room, 'h2', 'catguess');
    expect(view.wordPool).toBeUndefined();
    expect(view.players.find(player => player.id === 'h2').hand).toHaveLength(5);
    expect(view.players.find(player => player.id === 'h1').hand).toBeUndefined();
    expect(view.gameState.secretCardId).toBeNull();
    expect(view.gameState.secretWord).toBeUndefined();
    expect(JSON.stringify(view)).not.toContain('isSecret');
  });

  it('拆弹员只看炸弹，专家只看说明书，双方均收不到答案', () => {
    const room = createBomb('h1', '拆弹员', 'SECRET');
    addBombPlayer(room, '专家', 'h2');
    startBomb(room, { seed: 'agent-privacy-test' });
    const defuser = projectRoom(room, 'h1', 'bombdefuse');
    const expert = projectRoom(room, 'h2', 'bombdefuse');
    expect(defuser.gameState.modules[0].bombView).toBeDefined();
    expect(defuser.gameState.modules[0].manualView).toBeUndefined();
    expect(expert.gameState.modules[0].manualView).toBeDefined();
    expect(expert.gameState.modules[0].bombView).toBeUndefined();
    expect(JSON.stringify(defuser)).not.toContain('solution');
    expect(JSON.stringify(expert)).not.toContain('solution');
    expect(defuser.gameState.seed).toBeUndefined();
  });
});

describe('Agent 会话生命周期', () => {
  it('主动 leave 会移除玩家并释放席位', async () => {
    const { roomManager, host, roomCode } = hostRoom('codenames');
    const agent = joinAgent(roomManager, issue(roomManager, host));
    const { playerId, agentToken } = agent.last();
    expect(roomManager.rooms.get(roomCode).state.players).toHaveLength(2);
    const http = conn();
    roomManager.handleMessage(http, { type: 'AGENT_HTTP', operation: 'leave', roomCode, playerId, agentToken });
    expect(http.last().type).toBe('AGENT_LEFT');
    expect(roomManager.rooms.get(roomCode).state.players.map(p => p.id)).not.toContain(playerId);
  });

  it('心跳可让 Agent 保持在线，超时后自动离线并释放席位', () => {
    const { roomManager, host, roomCode } = hostRoom('catguess');
    const invite = issue(roomManager, host);
    const a = joinAgent(roomManager, invite, 'Agent A');
    const b = joinAgent(roomManager, invite, 'Agent B');
    const aJoined = a.messages.find(m => m.type === 'AGENT_JOINED');
    const bJoined = b.messages.find(m => m.type === 'AGENT_JOINED');
    expect(aJoined && bJoined).toBeTruthy();
    expect(roomManager.rooms.get(roomCode).state.players).toHaveLength(3);
    const beatBoth = () => {
      for (const participant of [aJoined, bJoined]) {
        const beat = conn();
        roomManager.handleMessage(beat, {
          type: 'AGENT_HTTP', operation: 'state', roomCode,
          playerId: participant.playerId, agentToken: participant.agentToken
        });
        expect(beat.last().type).toBe('AGENT_STATE');
        expect(beat.last().session.offlineAfterMs).toBe(90_000);
      }
    };
    // A、B 同时心跳 5 轮（每轮 20s，远小于 90s TTL）
    for (let i = 0; i < 5; i++) {
      clock += 20_000;
      beatBoth();
    }
    expect(roomManager.rooms.get(roomCode).state.players.map(p => p.id)).toContain(aJoined.playerId);
    // B 继续心跳，A 停止超过 TTL → 只有 A 被回收
    for (let i = 0; i < 5; i++) {
      clock += 20_000;
      const beat = conn();
      roomManager.handleMessage(beat, {
        type: 'AGENT_HTTP', operation: 'state', roomCode,
        playerId: bJoined.playerId, agentToken: bJoined.agentToken
      });
      expect(beat.last().type).toBe('AGENT_STATE');
    }
    // 再推进 95s，但让 B 在此期间保持心跳，使 A 超时而 B 存活
    for (let i = 0; i < 4; i++) {
      clock += 20_000;
      const beat = conn();
      roomManager.handleMessage(beat, {
        type: 'AGENT_HTTP', operation: 'state', roomCode,
        playerId: bJoined.playerId, agentToken: bJoined.agentToken
      });
    }
    clock += 15_000;
    roomManager.tickAll();
    const ids = roomManager.rooms.get(roomCode).state.players.map(p => p.id);
    expect(ids).not.toContain(aJoined.playerId);
    expect(ids).toContain(bJoined.playerId);
  });
});
