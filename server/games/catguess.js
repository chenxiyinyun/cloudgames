/**
 * catguess 服务器适配器（服务器权威）。
 *
 * 复用客户端纯函数引擎。catguess 的难点是原来 host 客户端用一堆 setTimeout 做
 * 阶段超时自动推进（说书人 60s / 出牌 30s / 投票 30s+宽限 / 计分 15s 后下一轮）。
 * 这里统一改成服务器 tick + 每房间一个 deadline：
 *   - deadline 存在适配器自己的 WeakMap 里（不污染下发给客户端的房间状态）；
 *   - 进入计时阶段时按阶段设定 deadline，tick 到点触发对应自动推进；
 *   - 引擎本身已用"仅在线玩家"判断阶段完成，所以离线的非说书人玩家天然不卡进度，
 *     只有离线"说书人"需要尽快自动出题（用 3s 的短 deadline 处理）。
 * 另含：长时间离线玩家清理 + 在线不足 3 人自动结束。
 */
import * as engine from '../../games/catguess/src/services/gameEngine.js';
import { DEFAULT_WORD_POOL } from '../../games/catguess/src/services/wordPool.js';

const P = engine.GAME_PHASES;

const PHASE_TIMEOUTS = {
  [P.STORYTELLER_PICKING]: 60_000,
  [P.OTHERS_PICKING]: 30_000,
  [P.REVEALING]: 30_000,
  [P.SCORING]: 15_000
};
const GAME_DISCONNECT_TIMEOUT_MS = 3 * 60_000;

// room -> { phase, at, graceGiven }（服务器侧计时，不下发）
const timers = new WeakMap();

function autoClue(word = '') {
  return `(自动出题)和「${word[0] || ''}」有关`;
}

/** 进入某个计时阶段时设定 deadline；离开计时阶段则清除。 */
function armIfNeeded(room, now) {
  const phase = room.phase;
  const ms = PHASE_TIMEOUTS[phase];
  const t = timers.get(room);
  if (ms == null) {
    if (t) timers.delete(room);
    return;
  }
  if (!t || t.phase !== phase) {
    let dur = ms;
    if (phase === P.STORYTELLER_PICKING) {
      const st = room.players.find(p => p.id === room.gameState.storytellerId);
      if (st && !st.isOnline) dur = 3000; // 离线说书人：尽快自动出题
    }
    timers.set(room, { phase, at: now + dur, graceGiven: false });
  }
}

/** deadline 到点：按当前阶段做权威自动推进。返回是否改了状态。 */
function fireDeadline(room, now) {
  const phase = room.phase;

  if (phase === P.STORYTELLER_PICKING) {
    const stId = room.gameState.storytellerId;
    const st = room.players.find(p => p.id === stId);
    if (!st || !st.hand?.length) return false;
    engine.submitStorySelection(room, stId, 0, autoClue(st.hand[0]));
    return true;
  }

  if (phase === P.OTHERS_PICKING) {
    // 给还没出牌的在线玩家随机补一张（离线玩家被引擎的在线判断排除，不卡进度）
    const pending = room.players.filter(p =>
      p.id !== room.gameState.storytellerId &&
      p.isOnline &&
      Array.isArray(p.hand) && p.hand.length > 0 &&
      !room.gameState.submittedCards.some(sc => sc.playerId === p.id)
    );
    pending.forEach(p => engine.submitCard(room, p.id, 0));
    return true;
  }

  if (phase === P.REVEALING) {
    const t = timers.get(room);
    const eligible = room.players.filter(p => p.id !== room.gameState.storytellerId && p.isOnline);
    const voted = new Set(room.gameState.votes.map(v => v.voterId));
    const pendingOnline = eligible.filter(p => !voted.has(p.id));
    if (pendingOnline.length > 0 && t && !t.graceGiven) {
      // 还有在线玩家没投票：给一次 5s 宽限
      t.graceGiven = true;
      t.at = now + 5000;
      return false;
    }
    engine.calculateScores(room);
    room.phase = P.SCORING;
    room.updatedAt = Date.now();
    return true;
  }

  if (phase === P.SCORING) {
    const result = engine.nextRound(room);
    if (result?.error) {
      // 在线不足以继续 → 结束
      room.status = P.ENDED;
      room.phase = P.ENDED;
      room.gameState.winner = null;
      room.updatedAt = Date.now();
    }
    return true;
  }

  return false;
}

/** 清理超时离线玩家 + 在线不足 3 人自动结束。返回是否改了状态。 */
function cleanupStale(room, now) {
  let changed = false;
  if (room.disconnectedPlayers?.length) {
    const staleIds = new Set(
      room.disconnectedPlayers
        .filter(p => now - p.disconnectedAt > GAME_DISCONNECT_TIMEOUT_MS)
        .map(p => p.id)
    );
    if (staleIds.size) {
      room.players = room.players.filter(p => !staleIds.has(p.id));
      room.disconnectedPlayers = room.disconnectedPlayers.filter(p => !staleIds.has(p.id));
      room.updatedAt = Date.now();
      changed = true;
    }
  }
  if (room.status === P.PLAYING && room.phase !== P.ENDED && engine.getOnlinePlayerCount(room) < 3) {
    room.status = P.ENDED;
    room.phase = P.ENDED;
    room.gameState.winner = null;
    room.updatedAt = Date.now();
    changed = true;
  }
  return changed;
}

export default {
  gameId: 'catguess',

  hostOnlyActions: ['START_GAME', 'NEXT_ROUND', 'END_GAME'],

  createRoom({ hostId, hostName, roomCode }) {
    return engine.createInitialRoom(hostId, hostName, roomCode, DEFAULT_WORD_POOL);
  },

  addPlayer(room, { playerId, playerName }) {
    return engine.addPlayerToRoom(room, playerName, playerId);
  },

  removePlayer(room, playerId) {
    return engine.removePlayerFromRoom(room, playerId);
  },

  applyIntent(room, { action, playerId, payload = {}, now: _now }) {
    switch (action) {
      case 'START_GAME':
        return engine.startGame(room);
      case 'SUBMIT_STORY':
        return engine.submitStorySelection(room, playerId, payload.cardIndex, payload.clue);
      case 'SUBMIT_CARD':
        return engine.submitCard(room, playerId, payload.cardIndex);
      case 'SUBMIT_VOTE':
        return engine.submitVote(room, playerId, payload.votedCardId);
      case 'NEXT_ROUND':
        // 结束后再点 = 重开一局；否则进入下一轮
        return room.status === P.ENDED ? engine.restartGame(room) : engine.nextRound(room);
      case 'END_GAME':
        room.status = P.ENDED;
        room.phase = P.ENDED;
        room.gameState.winner = null;
        room.updatedAt = Date.now();
        return { room };
      default:
        return { error: `未知意图：${action}` };
    }
  },

  tick(room, now) {
    if (room.status !== P.PLAYING) return false;
    let changed = cleanupStale(room, now);
    if (room.phase === P.ENDED) {
      timers.delete(room);
      return changed;
    }
    armIfNeeded(room, now);
    const t = timers.get(room);
    if (t && now >= t.at) {
      changed = fireDeadline(room, now) || changed;
      armIfNeeded(room, now); // 为（可能已切换的）新阶段重新计时
    }
    return changed;
  }
};
