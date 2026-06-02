// ── Timers & Auto-Reconnect Engine ────────────────────────────────────────────
// 所有 setTimeout / setInterval 调度 + auto-reconnect 状态机。
// 与 codenames/src/stores/connection.js 的 auto-reconnect 块对齐。

import {
  GAME_PHASES, calculateScores, submitStorySelection, submitCard,
  nextRound
} from '../services/gameEngine';
import p2p from '../services/p2p';
import { createLogger } from '../services/logger';
import { MSG } from '../services/online';
import { gameState, getRoom } from './state';
// 循环 import（timers ↔ network ↔ gameStore），仅函数体内引用，ES module live binding 可容忍
import { broadcastState, sendJoinRequest, setupGuestHandlers } from './network';

const log = createLogger('GameStore');

// ── Timeout Constants ─────────────────────────────────────────────────────────

/** Auto-advance 15 seconds after scoring phase starts */
const SCORING_AUTO_ADVANCE_MS = 15000;

/** Auto-advance 60 seconds after storyteller picking phase starts (说书人出题) */
const PICKING_TIMEOUT_MS = 60000;

/** Auto-submit remaining non-storyteller cards after picking phase starts */
const OTHERS_PICKING_TIMEOUT_MS = 30000;

/** Auto-advance 30 seconds after voting phase starts (猜词/投票) */
const VOTING_TIMEOUT_MS = 30000;

/**
 * 玩家离线等待超时（按阶段分档）
 * - 大厅（WAITING）：对方在大厅就离线 = 基本是走了，30s 给个切后台的缓冲就行
 * - 游戏中（PLAYING/SCORING/...）：3 分钟，给真正网络抖动的玩家一个重连窗口
 */
const LOBBY_DISCONNECT_TIMEOUT_MS = 30 * 1000;
const GAME_DISCONNECT_TIMEOUT_MS = 3 * 60 * 1000;

/** 房间结束或无法恢复时，3 分钟后自动退出本地房间 */
const ROOM_AUTO_DESTROY_MS = 3 * 60 * 1000;

// ── Timer State ───────────────────────────────────────────────────────────────

let _joinTimeout = null;
let _joinRetryInterval = null;
let _scoringTimer = null;
let _pickingTimer = null;
let _othersPickingTimer = null;
let _votingTimer = null;
let _offlineTickTimer = null;
let _autoReconnectTimer = null;
let _iceCheckingTimer = null;
let _roomDestroyTimer = null;
let _reconnectAttempts = 0;

const MAX_RECONNECT_ATTEMPTS = 8;

// ── Offline Player Tick (unified) ─────────────────────────────────────────────
// 合并了原 cleanupDisconnectedPlayers + scheduleDisconnectedSkipCheck：
// Part A 按当前阶段代操作离线玩家；Part B 按超时移除离线玩家。

export function offlinePlayerTick() {
  const cachedRoom = getRoom();
  if (!cachedRoom) return;

  // ── Part A: 阶段内代操作（原 scheduleDisconnectedSkipCheck）──
  if (gameState.isHost) {
    const phase = cachedRoom.phase;

    if (phase === GAME_PHASES.STORYTELLER_PICKING) {
      const st = cachedRoom.players.find(p => p.id === cachedRoom.gameState.storytellerId);
      if (st && !st.isOnline) {
        log.info('Storyteller disconnected during picking phase, auto-skipping');
        if (_pickingTimer) { clearTimeout(_pickingTimer); _pickingTimer = null; }
        const result = submitStorySelection(cachedRoom, st.id, 0, `(离线自动出题)${st.hand?.[0]?.[0] || ''}有关的词`);
        if (!result.error) {
          broadcastState();
          if (cachedRoom.phase === GAME_PHASES.OTHERS_PICKING) scheduleOthersPickingTimeout();
        }
      }
    }

    if (phase === GAME_PHASES.OTHERS_PICKING) {
      const offlinePlayers = cachedRoom.players.filter(
        p => !p.isOnline && p.id !== cachedRoom.gameState.storytellerId
      );
      let skipped = false;
      offlinePlayers.forEach(p => {
        if (!cachedRoom.gameState.submittedCards.find(sc => sc.playerId === p.id)) {
          const result = submitCard(cachedRoom, p.id, 0);
          if (!result.error) skipped = true;
        }
      });
      if (skipped) broadcastState();
    }

    if (phase === GAME_PHASES.REVEALING) {
      const offlineVoters = cachedRoom.players.filter(
        p => !p.isOnline && p.id !== cachedRoom.gameState.storytellerId
      );
      let changed = false;
      offlineVoters.forEach(p => {
        if (!cachedRoom.gameState.votes.find(v => v.voterId === p.id)) {
          cachedRoom.gameState.votes.push({ voterId: p.id, votedCardId: -1 });
          changed = true;
        }
      });
      if (changed) broadcastState();
    }
  }

  // ── Part B: 超时移除（原 cleanupDisconnectedPlayers）──
  if (!cachedRoom.disconnectedPlayers || cachedRoom.disconnectedPlayers.length === 0) {
    return;
  }

  const isInLobby = cachedRoom.status === GAME_PHASES.WAITING;
  const timeoutMs = isInLobby ? LOBBY_DISCONNECT_TIMEOUT_MS : GAME_DISCONNECT_TIMEOUT_MS;

  const now = Date.now();
  const stalePlayers = cachedRoom.disconnectedPlayers.filter(
    p => now - p.disconnectedAt > timeoutMs
  );

  if (stalePlayers.length === 0) return;

  log.info('Removing stale disconnected players', {
    count: stalePlayers.length,
    phase: isInLobby ? 'lobby' : 'game',
    timeoutMs
  });

  stalePlayers.forEach(player => {
    cachedRoom.players = cachedRoom.players.filter(p => p.id !== player.id);
  });

  cachedRoom.disconnectedPlayers = cachedRoom.disconnectedPlayers.filter(
    p => !stalePlayers.find(sp => sp.id === p.id)
  );

  const onlineCount = cachedRoom.players.filter(p => p.isOnline).length;
  if (onlineCount < 3 && cachedRoom.status === GAME_PHASES.PLAYING) {
    log.warn('Not enough online players, ending game', { onlineCount });
    cachedRoom.status = GAME_PHASES.ENDED;
    cachedRoom.phase = GAME_PHASES.ENDED;
    cachedRoom.gameState.winner = null;
  }

  if (onlineCount <= 1) {
    scheduleRoomAutoDestroy('room_empty');
  }

  broadcastState();
}

function scheduleOfflineTick() {
  if (_offlineTickTimer) clearTimeout(_offlineTickTimer);
  _offlineTickTimer = setTimeout(() => {
    _offlineTickTimer = null;
    offlinePlayerTick();
    // 只要还有离线玩家或处于游戏中，就持续轮询
    const room = getRoom();
    if (room && (room.disconnectedPlayers?.length > 0 || room.status === GAME_PHASES.PLAYING)) {
      scheduleOfflineTick();
    }
  }, 5000);
}

function clearOfflineTickTimer() {
  if (_offlineTickTimer) {
    clearTimeout(_offlineTickTimer);
    _offlineTickTimer = null;
  }
}

// ── Phase-Specific Timeouts ───────────────────────────────────────────────────

function scheduleAutoAdvance() {
  if (_scoringTimer) clearTimeout(_scoringTimer);
  _scoringTimer = setTimeout(() => {
    _scoringTimer = null;
    const cachedRoom = getRoom();
    if (!cachedRoom || cachedRoom.status === GAME_PHASES.ENDED) return;
    const result = nextRound(cachedRoom);
    if (result.error) {
      log.warn('autoAdvance: nextRound failed', { error: result.error });
      return;
    }
    broadcastState();
    if (cachedRoom.phase === GAME_PHASES.STORYTELLER_PICKING) {
      schedulePickingTimeout();
    }
    p2p.broadcast(MSG.NEXT_ROUND, { playerId: gameState.playerId });
  }, SCORING_AUTO_ADVANCE_MS);
}

function clearScoringTimer() {
  if (_scoringTimer) {
    clearTimeout(_scoringTimer);
    _scoringTimer = null;
  }
}

function schedulePickingTimeout() {
  if (!gameState.isHost) return;
  if (_pickingTimer) clearTimeout(_pickingTimer);

  const cachedRoom = getRoom();
  const storyteller = cachedRoom?.players.find(p => p.id === cachedRoom.gameState.storytellerId);
  // 断开的说书人 3s 超时，正常说书人 60s
  const delay = (storyteller && !storyteller.isOnline) ? 3000 : PICKING_TIMEOUT_MS;

  _pickingTimer = setTimeout(() => {
    _pickingTimer = null;
    const room = getRoom();
    if (!room || room.phase !== GAME_PHASES.STORYTELLER_PICKING) return;

    const st = room.players.find(p => p.id === room.gameState.storytellerId);

    if (st && !st.isOnline) {
      // 断开的说书人 — 跳过
      log.info('Auto-skipping disconnected storyteller', { playerId: st.id });
      const result = submitStorySelection(room, st.id, 0, `(离线自动出题)${st.hand?.[0]?.[0] || ''}有关的词`);
      if (result.error) {
        log.warn('auto skip storyteller failed', { error: result.error });
        return;
      }
      broadcastState();
      scheduleOthersPickingTimeout();
      return;
    }

    if (!st || st.hand.length === 0) return;

    const randomCardIndex = Math.floor(Math.random() * st.hand.length);
    const randomWord = st.hand[randomCardIndex];
    const autoClue = generateAutoClue(randomWord);

    console.log('[GameStore] Picking timeout: auto-selecting random card', { randomCardIndex, randomWord, autoClue });

    const result = submitStorySelection(room, room.gameState.storytellerId, randomCardIndex, autoClue);
    if (result.error) {
      log.warn('auto picking failed', { error: result.error });
      return;
    }

    broadcastState();
    p2p.broadcast(MSG.SUBMIT_STORY, {
      playerId: room.gameState.storytellerId,
      cardIndex: randomCardIndex,
      clue: autoClue
    });
    scheduleOthersPickingTimeout();
  }, delay);
}

function clearPickingTimer() {
  if (_pickingTimer) {
    clearTimeout(_pickingTimer);
    _pickingTimer = null;
  }
}

function scheduleOthersPickingTimeout() {
  if (!gameState.isHost) return;
  if (_othersPickingTimer) clearTimeout(_othersPickingTimer);

  _othersPickingTimer = setTimeout(() => {
    _othersPickingTimer = null;
    const cachedRoom = getRoom();
    if (!cachedRoom || cachedRoom.phase !== GAME_PHASES.OTHERS_PICKING) return;

    const pendingPlayers = cachedRoom.players.filter(player =>
      player.id !== cachedRoom.gameState.storytellerId &&
      player.isOnline &&
      Array.isArray(player.hand) &&
      player.hand.length > 0 &&
      !cachedRoom.gameState.submittedCards.some(card => card.playerId === player.id)
    );

    if (pendingPlayers.length === 0) return;

    pendingPlayers.forEach(player => {
      const room = getRoom();
      if (!room || room.phase !== GAME_PHASES.OTHERS_PICKING) return;

      const randomCardIndex = Math.floor(Math.random() * player.hand.length);
      const result = submitCard(room, player.id, randomCardIndex);
      if (result.error) {
        log.warn('auto card submit failed', { playerId: player.id, error: result.error });
      }
    });

    const room = getRoom();
    broadcastState();
    if (room?.phase === GAME_PHASES.REVEALING) {
      scheduleVotingTimeout();
    }
  }, OTHERS_PICKING_TIMEOUT_MS);
}

function clearOthersPickingTimer() {
  if (_othersPickingTimer) {
    clearTimeout(_othersPickingTimer);
    _othersPickingTimer = null;
  }
}

function scheduleVotingTimeout() {
  if (!gameState.isHost) return;
  if (_votingTimer) clearTimeout(_votingTimer);

  _votingTimer = setTimeout(() => {
    _votingTimer = null;
    forceAdvanceVotingIfStalled(true);
  }, VOTING_TIMEOUT_MS);
}

function clearVotingTimer() {
  if (_votingTimer) {
    clearTimeout(_votingTimer);
    _votingTimer = null;
  }
}

/**
 * Advance out of REVEALING when voting has stalled.
 *
 * Counts only ONLINE eligible voters that have not yet voted. The previous
 * implementation compared total votes (which include the -1 votes auto-filled
 * for offline players by scheduleDisconnectedSkipCheck) against the count of
 * online eligible voters; offline auto-votes could inflate the total so that
 * `totalVotes >= onlineVoters` while a real online voter still hadn't voted,
 * causing the timeout to do nothing and the round to hang in REVEALING forever.
 * It also never handled the case where every online voter HAS voted but the
 * SCORING transition never fired (e.g. the final vote was an offline auto-vote,
 * which bypasses submitVote()'s all-voted check).
 *
 * @param {boolean} allowGrace - give still-pending online voters one more short
 *                               window before forcing scoring.
 */
function forceAdvanceVotingIfStalled(allowGrace) {
  const cachedRoom = getRoom();
  if (!cachedRoom || cachedRoom.phase !== GAME_PHASES.REVEALING) return;

  const eligibleVoters = cachedRoom.players.filter(
    p => p.id !== cachedRoom.gameState.storytellerId && p.isOnline
  );
  const votedIds = new Set(cachedRoom.gameState.votes.map(v => v.voterId));
  const pendingOnline = eligibleVoters.filter(p => !votedIds.has(p.id));

  if (pendingOnline.length > 0 && allowGrace) {
    log.warn('[GameStore] Voting timeout: online voters still pending, granting grace period', {
      pending: pendingOnline.length
    });
    if (_votingTimer) clearTimeout(_votingTimer);
    _votingTimer = setTimeout(() => {
      _votingTimer = null;
      forceAdvanceVotingIfStalled(false);
    }, 5000);
    return;
  }

  // Either the grace period elapsed, or every online voter has already voted but
  // the transition never fired — score with whatever votes we have.
  console.log('[GameStore] Forcing score calculation with', cachedRoom.gameState.votes.length, 'votes');
  const result = calculateScores(cachedRoom);
  if (result.error) {
    log.warn('Forced scoring failed', { error: result.error });
    return;
  }
  cachedRoom.phase = GAME_PHASES.SCORING;
  cachedRoom.updatedAt = Date.now();
  broadcastState();
  scheduleAutoAdvance();
}

function scheduleHostTimerForCurrentPhase() {
  if (!gameState.isHost) return;
  const cachedRoom = getRoom();
  if (!cachedRoom) return;

  clearOfflineTickTimer();
  scheduleOfflineTick();

  if (cachedRoom.phase === GAME_PHASES.STORYTELLER_PICKING) {
    schedulePickingTimeout();
  } else if (cachedRoom.phase === GAME_PHASES.OTHERS_PICKING) {
    scheduleOthersPickingTimeout();
  } else if (cachedRoom.phase === GAME_PHASES.REVEALING) {
    scheduleVotingTimeout();
  } else if (cachedRoom.phase === GAME_PHASES.SCORING) {
    scheduleAutoAdvance();
  }
}

function generateAutoClue(word) {
  const templates = [
    `和${word[0]}有关`,
    `包含${word.length}个字`,
    `${word[0]}开头的词`,
    `${word[word.length - 1]}结尾`,
    `日常常见的`,
  ];
  return templates[Math.floor(Math.random() * templates.length)];
}

// scheduleOfflineTick 和 scheduleOfflinePlayerCleanup 已合并为 offlinePlayerTick（见上方）

function scheduleRoomAutoDestroy(reason = 'room_inactive') {
  if (_roomDestroyTimer) return;
  _roomDestroyTimer = setTimeout(async () => {
    _roomDestroyTimer = null;
    log.info('Auto-destroying inactive room', { reason });
    // 动态 import 避免 timers ↔ gameStore 循环依赖（cleanup 在 gameStore.js）
    const { cleanup } = await import('./gameStore');
    cleanup({ forceStatusReset: true });
    gameState.screen = 'menu';
  }, ROOM_AUTO_DESTROY_MS);
}

function clearRoomAutoDestroyTimer() {
  if (_roomDestroyTimer) {
    clearTimeout(_roomDestroyTimer);
    _roomDestroyTimer = null;
  }
}

export function setConnectionStatus(status, message = '') {
  gameState.connectionStatus = status;
  gameState.connectionMessage = message;
  if (status === 'connected' || status === 'connecting') {
    clearRoomAutoDestroyTimer();
  } else if (
    (status === 'error' || status === 'disconnected') &&
    gameState.roomCode &&
    gameState.screen !== 'menu'
  ) {
    scheduleRoomAutoDestroy(status);
  }
}

// ── Join Retry / Timeout (used by joinRoom + reconnectRoomInternal) ───────────

export function stopJoinRetry() {
  if (_joinRetryInterval) {
    clearInterval(_joinRetryInterval);
    _joinRetryInterval = null;
  }
  if (_joinTimeout) {
    clearTimeout(_joinTimeout);
    _joinTimeout = null;
  }
}

export function startJoinRetryInterval(fn, intervalMs) {
  stopJoinRetry();
  _joinRetryInterval = setInterval(fn, intervalMs);
}

export function startJoinTimeout(fn, ms) {
  if (_joinTimeout) clearTimeout(_joinTimeout);
  _joinTimeout = setTimeout(fn, ms);
}

// ── Auto-Reconnect Engine ─────────────────────────────────────────────────────

export function registerAutoReconnectHandlers() {
  p2p.onConnectionStateChange = ({ peerId, iceConnectionState: iceState }) => {
    const hostPeerId = `catguess-${gameState.roomCode}`;

    if (iceState === 'disconnected' || iceState === 'failed') {
      if ((peerId === hostPeerId || gameState.isHost) && !_autoReconnectTimer) {
        setConnectionStatus('reconnecting', '检测到连接断开，正在自动重连...');
        startAutoReconnect();
      }
    } else if (iceState === 'connected' || iceState === 'completed') {
      cancelAutoReconnect();
      if (_iceCheckingTimer) { clearTimeout(_iceCheckingTimer); _iceCheckingTimer = null; }
      if (gameState.connectionStatus === 'reconnecting') {
        setConnectionStatus('connected', '已连接');
      }
      _reconnectAttempts = 0;
    } else if (iceState === 'checking') {
      // ICE checking 超时保护：如果持续 checking 超过 10s，触发重连
      if (_iceCheckingTimer) clearTimeout(_iceCheckingTimer);
      _iceCheckingTimer = setTimeout(() => {
        const state = p2p.getPeerConnectionState(hostPeerId);
        if (state?.iceConnectionState === 'checking' && !_autoReconnectTimer) {
          setConnectionStatus('reconnecting', '连接建立超时，正在重试...');
          startAutoReconnect();
        }
      }, 10000);
    }
  };
}

async function startAutoReconnect() {
  if (_reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    setConnectionStatus('error', '连接失败，请检查网络后手动重连');
    cancelAutoReconnect();
    return;
  }

  _reconnectAttempts++;

  // Exponential backoff: 1s, 2s, 4s, 8s, 16s, 32s (capped), with ±25% jitter
  const baseDelay = Math.min(1000 * Math.pow(2, _reconnectAttempts - 1), 32000);
  const jitter = baseDelay * (0.75 + Math.random() * 0.5);

  _autoReconnectTimer = setTimeout(async () => {
    _autoReconnectTimer = null;
    try {
      if (gameState.isHost) {
        const connectedPeers = p2p.getConnectedPeers();
        if (connectedPeers.length > 0) {
          cancelAutoReconnect();
          setConnectionStatus('connected', '已连接');
          _reconnectAttempts = 0;
          return;
        }
        startAutoReconnect();
      } else {
        const ok = await reconnectRoomInternal();
        if (!ok) {
          log.warn('Auto-reconnect attempt timed out', { attempt: _reconnectAttempts });
          startAutoReconnect();
        }
      }
    } catch (err) {
      log.warn('Auto-reconnect attempt failed', { attempt: _reconnectAttempts, error: err?.message });
      startAutoReconnect();
    }
  }, jitter);
}

export function cancelAutoReconnect() {
  if (_autoReconnectTimer) {
    clearTimeout(_autoReconnectTimer);
    _autoReconnectTimer = null;
  }
  if (_iceCheckingTimer) {
    clearTimeout(_iceCheckingTimer);
    _iceCheckingTimer = null;
  }
}

async function reconnectRoomInternal() {
  if (!gameState.roomCode || !gameState.playerName) return false;

  p2p.softDisconnect();
  gameState.connected = false;

  await p2p.joinRoom(gameState.roomCode, gameState.playerName);
  setupGuestHandlers();

  sendJoinRequest(gameState.playerId, gameState.playerName, true);

  // Send REQUEST_STATE to get full snapshot
  try { p2p.broadcast(MSG.REQUEST_STATE, { playerId: gameState.playerId }); } catch { /* ignore */ }

  // Wait up to 10s for connection to stabilize
  return new Promise((resolve) => {
    let settled = false;
    let timeout = null;
    let checkInterval = null;
    const finish = (ok) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      clearInterval(checkInterval);
      resolve(ok);
    };
    timeout = setTimeout(() => finish(false), 10000);
    checkInterval = setInterval(() => {
      if (gameState.connected) {
        finish(true);
      }
    }, 500);
  });
}

// ── Reset on cleanup ──────────────────────────────────────────────────────────

export function resetAllTimers() {
  clearScoringTimer();
  clearPickingTimer();
  clearOthersPickingTimer();
  clearVotingTimer();
  clearOfflineTickTimer();
  clearRoomAutoDestroyTimer();
  cancelAutoReconnect();
  stopJoinRetry();
  _reconnectAttempts = 0;
}

export const RECONNECT_METADATA = {
  get attempt() { return _reconnectAttempts; },
  MAX_ATTEMPTS: MAX_RECONNECT_ATTEMPTS
};

// 暴露给 network.js 在 setupHost/setupGuest 时调用，以及 gameStore.js 高层 API
export {
  scheduleHostTimerForCurrentPhase,
  scheduleOfflineTick,
  schedulePickingTimeout,
  scheduleVotingTimeout,
  scheduleAutoAdvance,
  scheduleOthersPickingTimeout,
  clearScoringTimer,
  clearPickingTimer,
  clearOthersPickingTimer,
  clearVotingTimer,
  clearOfflineTickTimer
};
