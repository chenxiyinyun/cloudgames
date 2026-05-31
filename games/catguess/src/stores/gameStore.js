import { reactive, watch } from 'vue';
import p2p from '../services/p2p';
import { createLogger } from '../services/logger';
import {
  GAME_PHASES, generatePlayerId, createInitialRoom,
  addPlayerToRoom, startGame,
  submitStorySelection, submitCard, submitVote,
  nextRound, restartGame, calculateScores
} from '../services/gameEngine';
import { saveStateToCache, loadStateFromCache, clearStateCache, hasCachedState, flushStateCache, cancelPendingSave } from '../services/stateCache';
import { sanitizePlayerName, sanitizeRoomCode, sanitizeStoryClue } from '../services/sanitize';
import {
  MSG,
  cleanupOps,
  createJoinRequestSenderForGame,
  createRoomBroadcasterForGame,
  generateOpKey,
  getRoomStateDedupeDetail,
  isDuplicateOp,
  resetOps
} from '../services/online';
import { showToast } from '../components/ToastNotification.vue';
import { createHostMigrationHandler } from '../../../../src/shared/online/useHostMigration';

const log = createLogger('GameStore');

// 共享房主迁移处理器
const hostMigrator = createHostMigrationHandler({
  gameId: 'catguess',
  p2p,
  log
});

// ── Default Word Pool ──
const DEFAULT_WORD_POOL = [
  '苹果', '月亮', '彩虹', '沙滩', '森林', '海洋', '星空', '火焰', '冰山', '沙漠',
  '花园', '瀑布', '闪电', '雪花', '阳光', '影子', '迷宫', '城堡', '桥梁', '灯塔',
  '风筝', '气球', '帆船', '火箭', '面具', '钥匙', '时钟', '镜子', '蜡烛', '羽毛',
  '珍珠', '钻石', '琥珀', '翡翠', '宝剑', '盾牌', '皇冠', '魔杖', '书卷', '信封',
  '摇篮', '秋千', '滑梯', '旋转', '跳跃', '飞翔', '沉睡', '苏醒', '哭泣', '微笑',
  '拥抱', '亲吻', '告别', '重逢', '冒险', '旅行', '探索', '发现', '秘密', '宝藏',
  '梦想', '回忆', '思念', '期待', '自由', '孤独', '勇气', '温柔', '愤怒', '平静',
  '春天', '夏天', '秋天', '冬天', '黎明', '黄昏', '午夜', '午后', '清晨', '傍晚',
  '猫咪', '小狗', '兔子', '狐狸', '小鸟', '蝴蝶', '鲸鱼', '海豚', '狮子', '大象',
  '熊猫', '松鼠', '刺猬', '金鱼', '蜗牛', '蜻蜓', '蜜蜂', '蚂蚁', '蜘蛛', '螃蟹',
  '玫瑰', '百合', '雏菊', '樱花', '荷花', '向日葵', '蒲公英', '薰衣草', '仙人掌', '蘑菇',
  '吉他', '钢琴', '小提琴', '笛子', '鼓点', '旋律', '音符', '歌声', '舞蹈', '诗歌',
  '画笔', '颜料', '画布', '雕塑', '照片', '电影', '剧本', '魔术', '童话', '寓言',
  '咖啡', '奶茶', '巧克力', '冰淇淋', '蛋糕', '糖果', '面包', '米饭', '面条', '火锅',
  '日出', '日落', '潮汐', '极光', '流星', '彩虹', '暴风', '海啸', '火山', '地震',
  '友谊', '爱情', '亲情', '信任', '背叛', '谎言', '真相', '命运', '奇迹', '永恒',
  '瞬间', '无限', '轮回', '平行', '虚幻', '真实', '光明', '黑暗', '寂静', '喧嚣',
  '起点', '终点', '旅途', '归途', '远方', '故乡', '城市', '乡村', '街道', '家门'
];

export const gameState = reactive({
  screen: 'menu',
  playerId: null,
  playerName: '',
  isHost: false,
  roomCode: null,
  connected: false,
  connecting: false,
  error: null,
  connectionStatus: 'disconnected',
  connectionMessage: '',
  toast: null,

  room: {
    players: [],
    phase: GAME_PHASES.WAITING,
    status: GAME_PHASES.WAITING,
    gameState: {
      round: 0,
      storytellerId: null,
      clue: '',
      submittedCards: [],
      shuffledCards: [],
      votes: [],
      roundScores: {},
      scores: {},
      roundHistory: [],
      winner: null,
      secretCardId: null
    },
    disconnectedPlayers: [],
    savedPhase: null,
    savedStorytellerId: null
  }
});

let cachedRoom = null;
let _joinTimeout = null;
let _joinRetryInterval = null;
let _scoringTimer = null;
let _pickingTimer = null;
let _othersPickingTimer = null;
let _votingTimer = null;
let _offlinePlayerCleanupTimer = null;
let _autoReconnectTimer = null;
let _autoReconnectInterval = null;
let _reconnectAttempts = 0;
let _disconnectedSkipTimer = null;
let _roomDestroyTimer = null;
const MAX_RECONNECT_ATTEMPTS = 8;

/** Auto-advance 15 seconds after scoring phase starts */
const SCORING_AUTO_ADVANCE_MS = 15000;

/** Auto-advance 60 seconds after storyteller picking phase starts (说书人出题) */
const PICKING_TIMEOUT_MS = 60000;

/** Auto-submit remaining non-storyteller cards after picking phase starts */
const OTHERS_PICKING_TIMEOUT_MS = 30000;

/** Auto-advance 30 seconds after voting phase starts (猜词/投票) */
const VOTING_TIMEOUT_MS = 30000;

/** 玩家离线等待超时 (3分钟后若未重连则移除) */
const PLAYER_DISCONNECT_TIMEOUT_MS = 3 * 60 * 1000;

/** 房间结束或无法恢复时，3分钟后自动退出本地房间 */
const ROOM_AUTO_DESTROY_MS = 3 * 60 * 1000;

function cleanupDisconnectedPlayers() {
  if (!cachedRoom || !cachedRoom.disconnectedPlayers || cachedRoom.disconnectedPlayers.length === 0) {
    return;
  }

  const now = Date.now();
  const stalePlayers = cachedRoom.disconnectedPlayers.filter(
    p => now - p.disconnectedAt > PLAYER_DISCONNECT_TIMEOUT_MS
  );

  if (stalePlayers.length > 0) {
    log.info('Removing stale disconnected players', { count: stalePlayers.length });

    stalePlayers.forEach(player => {
      cachedRoom.players = cachedRoom.players.filter(p => p.id !== player.id);
    });

    cachedRoom.disconnectedPlayers = cachedRoom.disconnectedPlayers.filter(
      p => !stalePlayers.find(sp => sp.id === p.id)
    );

    if (cachedRoom.disconnectedPlayers.length === 0) {
      clearOfflinePlayerCleanupTimer();
    }

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
}

function scheduleOfflinePlayerCleanup() {
  if (_offlinePlayerCleanupTimer) clearTimeout(_offlinePlayerCleanupTimer);
  _offlinePlayerCleanupTimer = setTimeout(() => {
    cleanupDisconnectedPlayers();
    if (cachedRoom?.disconnectedPlayers?.length > 0) {
      scheduleOfflinePlayerCleanup();
    }
  }, 10000);
}

function clearOfflinePlayerCleanupTimer() {
  if (_offlinePlayerCleanupTimer) {
    clearTimeout(_offlinePlayerCleanupTimer);
    _offlinePlayerCleanupTimer = null;
  }
}

function scheduleAutoAdvance() {
  if (_scoringTimer) clearTimeout(_scoringTimer);
  _scoringTimer = setTimeout(() => {
    _scoringTimer = null;
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

  const storyteller = cachedRoom?.players.find(p => p.id === cachedRoom.gameState.storytellerId);
  // 断开的说书人 3s 超时，正常说书人 60s
  const delay = (storyteller && !storyteller.isOnline) ? 3000 : PICKING_TIMEOUT_MS;
  
  _pickingTimer = setTimeout(() => {
    _pickingTimer = null;
    if (!cachedRoom || cachedRoom.phase !== GAME_PHASES.STORYTELLER_PICKING) return;

    const st = cachedRoom.players.find(p => p.id === cachedRoom.gameState.storytellerId);

    if (st && !st.isOnline) {
      // 断开的说书人 — 跳过
      log.info('Auto-skipping disconnected storyteller', { playerId: st.id });
      const result = submitStorySelection(cachedRoom, st.id, 0, `(离线自动出题)${st.hand?.[0]?.[0] || ''}有关的词`);
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
    
    const result = submitStorySelection(cachedRoom, cachedRoom.gameState.storytellerId, randomCardIndex, autoClue);
    if (result.error) {
      log.warn('auto picking failed', { error: result.error });
      return;
    }
    
    broadcastState();
    p2p.broadcast(MSG.SUBMIT_STORY, {
      playerId: cachedRoom.gameState.storytellerId,
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
      if (cachedRoom.phase !== GAME_PHASES.OTHERS_PICKING) return;

      const randomCardIndex = Math.floor(Math.random() * player.hand.length);
      const result = submitCard(cachedRoom, player.id, randomCardIndex);
      if (result.error) {
        log.warn('auto card submit failed', { playerId: player.id, error: result.error });
      }
    });

    broadcastState();
    if (cachedRoom.phase === GAME_PHASES.REVEALING) {
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
    if (!cachedRoom || cachedRoom.phase !== GAME_PHASES.REVEALING) return;
    
    // If not all players have voted, force calculate scores with current votes
    const eligibleVoters = cachedRoom.players.filter(
      p => p.id !== cachedRoom.gameState.storytellerId && p.isOnline
    );
    const votedPlayerIds = cachedRoom.gameState.votes.map(v => v.voterId);
    
    // Only proceed if everyone has voted, otherwise we can't calculate scores fairly
    if (votedPlayerIds.length < eligibleVoters.length) {
      log.warn('[GameStore] Voting timeout: not all players voted, waiting...');
      // Schedule another check in 5 seconds
      _votingTimer = setTimeout(() => {
        if (!cachedRoom || cachedRoom.phase !== GAME_PHASES.REVEALING) return;
        if (cachedRoom.gameState.votes.length < eligibleVoters.length) {
          // Still not all voted, just advance with what we have
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
      }, 5000);
      return;
    }
  }, VOTING_TIMEOUT_MS);
}

function clearVotingTimer() {
  if (_votingTimer) {
    clearTimeout(_votingTimer);
    _votingTimer = null;
  }
}

function scheduleHostTimerForCurrentPhase() {
  if (!gameState.isHost || !cachedRoom) return;

  clearDisconnectedSkipTimer();
  scheduleDisconnectedSkipCheck();

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

const sendJoinRequest = createJoinRequestSenderForGame({
  p2p,
  getRoomCode: () => gameState.roomCode,
  logger: log
});

const roomBroadcaster = createRoomBroadcasterForGame({
  p2p,
  getRoom: () => cachedRoom,
  updateLocalState
});

watch(() => ({
  screen: gameState.screen,
  playerId: gameState.playerId,
  playerName: gameState.playerName,
  roomCode: gameState.roomCode,
  isHost: gameState.isHost,
  connectionStatus: gameState.connectionStatus,
  room: gameState.room
}), (newState) => {
  if (newState.screen === 'menu') {
    cancelPendingSave();
    return;
  }
  if (newState.playerId) {
    saveStateToCache(newState);
  }
}, { deep: true });

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    flushStateCache(gameState);
  });
}

// ── Auto-Reconnect Engine ────────────────────────────────────────────────────

function registerAutoReconnectHandlers() {
  p2p.onConnectionStateChange = ({ peerId, iceConnectionState: iceState }) => {
    const hostPeerId = `catguess-${gameState.roomCode}`;

    if (iceState === 'disconnected' || iceState === 'failed') {
      if ((peerId === hostPeerId || gameState.isHost) && !_autoReconnectTimer) {
        setConnectionStatus('reconnecting', '检测到连接断开，正在自动重连...');
        startAutoReconnect();
      }
    } else if (iceState === 'connected' || iceState === 'completed') {
      cancelAutoReconnect();
      if (gameState.connectionStatus === 'reconnecting') {
        setConnectionStatus('connected', '已连接');
      }
      _reconnectAttempts = 0;
    }
  };

  // Periodic connection quality check every 3s
  if (_autoReconnectInterval) return;
  _autoReconnectInterval = setInterval(() => {
    const hostPeerId = `catguess-${gameState.roomCode}`;
    const state = p2p.getPeerConnectionState(hostPeerId);
    if (state?.iceConnectionState === 'failed' && !_autoReconnectTimer) {
      startAutoReconnect();
    }
  }, 3000);
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

function cancelAutoReconnect() {
  if (_autoReconnectTimer) {
    clearTimeout(_autoReconnectTimer);
    _autoReconnectTimer = null;
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

// ── Disconnected Player Skip ──────────────────────────────────────────────────

function scheduleDisconnectedSkipCheck() {
  if (!gameState.isHost || !cachedRoom) return;

  const phase = cachedRoom.phase;

  if (phase === GAME_PHASES.STORYTELLER_PICKING) {
    const st = cachedRoom.players.find(p => p.id === cachedRoom.gameState.storytellerId);
    if (st && !st.isOnline) {
      log.info('Storyteller disconnected during picking phase, auto-skipping');
      // Force auto-pick for disconnected storyteller
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

  _disconnectedSkipTimer = setTimeout(scheduleDisconnectedSkipCheck, 5000);
}

function clearDisconnectedSkipTimer() {
  if (_disconnectedSkipTimer) {
    clearTimeout(_disconnectedSkipTimer);
    _disconnectedSkipTimer = null;
  }
}

function scheduleRoomAutoDestroy(reason = 'room_inactive') {
  if (_roomDestroyTimer) return;
  _roomDestroyTimer = setTimeout(() => {
    _roomDestroyTimer = null;
    log.info('Auto-destroying inactive room', { reason });
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

function setConnectionStatus(status, message = '') {
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

function stopJoinRetry() {
  if (_joinRetryInterval) {
    clearInterval(_joinRetryInterval);
    _joinRetryInterval = null;
  }
  if (_joinTimeout) {
    clearTimeout(_joinTimeout);
    _joinTimeout = null;
  }
}

export function restoreFromCache() {
  const cache = loadStateFromCache();
  if (!cache) return false;

  console.log('[GameStore] Restoring state from cache...');

  if (cache.state) {
    gameState.playerId = cache.state.playerId || null;
    gameState.playerName = cache.state.playerName || '';
    gameState.roomCode = cache.state.roomCode || null;
    gameState.isHost = cache.state.isHost || false;
    gameState.screen = cache.state.screen || 'menu';
    gameState.connectionStatus = cache.state.connectionStatus || 'disconnected';
  }

  if (cache.room) {
    Object.assign(gameState.room, cache.room);
  }

  if (gameState.roomCode && gameState.playerId) {
    cachedRoom = {
      ...gameState.room,
      code: gameState.roomCode,
      hostId: gameState.isHost ? gameState.playerId : null
    };
  }

  if (cachedRoom) {
    updateLocalState(cachedRoom);
    scheduleHostTimerForCurrentPhase();
  }

  console.log('[GameStore] State restored from cache');
  return true;
}

export function hasRestoreableState() {
  return hasCachedState();
}

export async function createRoom(name) {
  try {
    const { value: sanitizedName, error: nameError } = sanitizePlayerName(name);
    if (nameError) {
      showToast(nameError, 'warning');
      return false;
    }

    setConnectionStatus('connecting', '正在创建任务...');
    gameState.connecting = true;
    gameState.error = null;  // Clear previous error
    const playerId = generatePlayerId();
    const roomCode = p2p.generateRoomCode();
    const wordPool = [...DEFAULT_WORD_POOL];

    gameState.playerId = playerId;
    gameState.playerName = sanitizedName;
    gameState.roomCode = roomCode;
    gameState.isHost = true;

    cachedRoom = createInitialRoom(playerId, sanitizedName, roomCode, wordPool);
    const hostPlayer = cachedRoom.players.find(p => p.id === playerId);
    if (hostPlayer) hostPlayer._peerId = `catguess-${roomCode}`;

    await p2p.createHost(roomCode, sanitizedName);

    setupHostHandlers();

    updateLocalState(cachedRoom);

    gameState.connected = true;
    gameState.connecting = false;
    setConnectionStatus('connected', '任务创建成功');
    gameState.screen = 'lobby';
    return true;
  } catch (error) {
    console.error('Create room error:', error);
    const msg = error.message || '创建房间失败';
    gameState.error = msg;
    gameState.connecting = false;
    showToast(`创建房间失败：${msg}`, 'error');
    cleanup();
    return false;
  }
}

export async function joinRoom(name, code) {
  try {
    const { value: sanitizedName, error: nameError } = sanitizePlayerName(name);
    if (nameError) {
      showToast(nameError, 'warning');
      return false;
    }
    const { value: sanitizedCode, error: codeError } = sanitizeRoomCode(code);
    if (codeError) {
      showToast(codeError, 'warning');
      return false;
    }

    setConnectionStatus('connecting', '正在连接任务...');
    gameState.connecting = true;
    gameState.error = null;  // Clear previous error

    // 复用缓存的 playerId，避免以新身份加入同一房间
    const cache = loadStateFromCache();
    let playerId;
    if (cache?.state?.playerId && cache?.state?.roomCode === sanitizedCode) {
      playerId = cache.state.playerId;
      console.log('[GameStore] Reusing cached playerId for room', sanitizedCode, ':', playerId);
    } else {
      playerId = generatePlayerId();
    }

    gameState.playerId = playerId;
    gameState.playerName = sanitizedName;
    gameState.roomCode = sanitizedCode;
    gameState.isHost = false;

    await p2p.joinRoom(sanitizedCode, sanitizedName);

    setupGuestHandlers();

    sendJoinRequest(playerId, sanitizedName);
    _joinRetryInterval = setInterval(() => {
      if (gameState.connected || gameState.screen !== 'menu') {
        stopJoinRetry();
        return;
      }
      sendJoinRequest(playerId, sanitizedName);
    }, 2000);

    // Set a timeout — if no ROOM_STATE or JOIN_RESPONSE arrives within 15s, show error
    _joinTimeout = setTimeout(() => {
      if (!gameState.connected || gameState.screen === 'menu') {
        const errMsg = '连接超时：房主未响应，请确认房间号正确或重试';
        console.warn('[GameStore] Join timeout: no response from host');
        gameState.error = errMsg;
        setConnectionStatus('error', errMsg);
        showToast(errMsg, 'error');
        stopJoinRetry();
        cleanup();
        gameState.screen = 'menu';
      }
    }, 15000);

    gameState.connecting = false;
    setConnectionStatus('connected', '已加入任务');
    return true;
  } catch (error) {
    console.error('Join room error:', error);
    const msg = error.message || '加入房间失败';
    gameState.error = msg;
    gameState.connecting = false;
    showToast(`加入房间失败：${msg}`, 'error');
    cleanup();
    return false;
  }
}

export async function reconnectRoom() {
  if (!gameState.roomCode || !gameState.playerName) {
    setConnectionStatus('error', '无法重连：缺少房间信息');
    return false;
  }

  try {
    setConnectionStatus('reconnecting', '正在重新连接...');
    gameState.connecting = true;
    // 连接已被拆除，重置为未连接，确保重发循环/超时在会话内重连时也生效
    gameState.connected = false;

    p2p.softDisconnect();

    if (gameState.isHost) {
      // 房主用同一 peerId 重新注册，createHost 成功即重连完成
      await p2p.createHost(gameState.roomCode, gameState.playerName);
      setupHostHandlers();
      gameState.connected = true;
      gameState.connecting = false;
      setConnectionStatus('connected', '重连成功');
      return true;
    }

    // 访客：建连后反复发送重连请求，由 ROOM_STATE / JOIN_RESPONSE 确认成功
    await p2p.joinRoom(gameState.roomCode, gameState.playerName);
    setupGuestHandlers();

    sendJoinRequest(gameState.playerId, gameState.playerName, true);
    _joinRetryInterval = setInterval(() => {
      if (gameState.connected) {
        stopJoinRetry();
        return;
      }
      sendJoinRequest(gameState.playerId, gameState.playerName, true);
    }, 2000);

    // 总超时兜底：避免房主已离线时无限重试、永远停在"重连中"
    _joinTimeout = setTimeout(() => {
      if (!gameState.connected) {
        const errMsg = '重连超时：房主可能已离线，请稍后重试或重新加入房间';
        log.warn('Reconnect timeout: no response from host');
        stopJoinRetry();
        gameState.error = errMsg;
        gameState.connecting = false;
        setConnectionStatus('error', errMsg);
        showToast(errMsg, 'error');
      }
    }, 25000);

    // 连接尚未确认，保持"重连中"状态，成功由消息处理回调切换
    gameState.connecting = false;
    return true;
  } catch (error) {
    console.error('Reconnect error:', error);
    stopJoinRetry();
    gameState.error = error.message || '重连失败';
    gameState.connecting = false;
    setConnectionStatus('error', error.message || '重连失败');
    return false;
  }
}

function setupHostHandlers() {
  p2p.onPlayerConnected = (conn) => {
    console.log('Player connected:', conn.peer);
    // DO NOT send ROOM_STATE here — the JOIN_REQUEST handler broadcasts it after processing.
    // Sending ROOM_STATE before JOIN_REQUEST is processed includes stale state (without the new player),
    // and the subsequent broadcastState() ROOM_STATE gets wrongly rejected by idempotency (same round/phase key).
    if (cachedRoom) {
      setTimeout(() => {
        const otherPeers = p2p.getConnectedPeers().filter(id => id !== conn.peer);
        if (otherPeers.length > 0) {
          p2p.sendTo(conn.peer, MSG.PEER_LIST, { peers: otherPeers });
        }
      }, 500);
    }
  };

  p2p.onPlayerDisconnected = (peerId) => {
    console.log('Player disconnected:', peerId);
    const playerToMark = cachedRoom?.players.find(p => p._peerId === peerId);
    if (playerToMark && cachedRoom) {
      // 标记为离线而非永久移除，允许重连恢复
      playerToMark.isOnline = false;
      if (!cachedRoom.disconnectedPlayers) {
        cachedRoom.disconnectedPlayers = [];
      }
      if (!cachedRoom.disconnectedPlayers.find(p => p.id === playerToMark.id)) {
        cachedRoom.disconnectedPlayers.push({
          id: playerToMark.id,
          name: playerToMark.name,
          disconnectedAt: Date.now()
        });
      }
      scheduleOfflinePlayerCleanup();
      broadcastState();
    }
  };

  p2p.onMessage = (data, peerId) => {
    handleHostMessage(data, peerId);
  };

  p2p.onError = (err) => {
    console.error('Host error:', err);
    gameState.error = err.message;
    setConnectionStatus('error', err.message);
  };

  p2p.startHeartbeat(10000);
  p2p.onDeadPeer = (peerId) => {
    log.warn('Host detected dead peer', { peerId });
    const playerToMark = cachedRoom?.players.find(p => p._peerId === peerId);
    if (playerToMark && cachedRoom) {
      playerToMark.isOnline = false;
      if (!cachedRoom.disconnectedPlayers) {
        cachedRoom.disconnectedPlayers = [];
      }
      if (!cachedRoom.disconnectedPlayers.find(p => p.id === playerToMark.id)) {
        cachedRoom.disconnectedPlayers.push({
          id: playerToMark.id,
          name: playerToMark.name,
          disconnectedAt: Date.now()
        });
      }
      scheduleOfflinePlayerCleanup();
      broadcastState();
    }
  };

  registerAutoReconnectHandlers();
}

function setupGuestHandlers() {
  p2p.onPlayerDisconnected = (peerId) => {
    console.log('Guest disconnected from peer:', peerId);

    const hostPeerId = `catguess-${gameState.roomCode}`;
    if (peerId === hostPeerId) {
      if (hostMigrator.isMigrationInProgress()) {
        log.info('onPlayerDisconnected: migration already in progress, skipping');
        return;
      }
      console.log('Host disconnected! Attempting migration...');
      _doHostMigrate();
    }
  };

  p2p.onMessage = (data, peerId) => {
    handleGuestMessage(data, peerId);
  };

  p2p.onError = (err) => {
    console.error('Guest error:', err);
    gameState.error = err.message;
    setConnectionStatus('error', err.message);
  };

  p2p.startHeartbeat(10000);
  p2p.onDeadPeer = (peerId) => {
    log.warn('Guest detected dead peer', { peerId });
    const hostPeerId = `catguess-${gameState.roomCode}`;
    if (peerId === hostPeerId) {
      if (hostMigrator.isMigrationInProgress()) {
        log.info('onDeadPeer: migration already in progress, skipping');
        return;
      }
      log.warn('Host is dead, triggering migration');
      _doHostMigrate();
    }
  };

  registerAutoReconnectHandlers();
}

/**
 * 房主迁移 — 委托给共享迁移处理器。
 * 猫猜启用 enableWaitBranch：高 order 的访客等待新房主自动接管。
 */
async function _doHostMigrate() {
  await hostMigrator.handleHostDisconnect(cachedRoom, gameState, {
    broadcastState,
    setupHostHandlers,
    setConnectionStatus,
    enableWaitBranch: true,
    onBecomeHost: scheduleHostTimerForCurrentPhase
  });
}

function handleHostMessage(data, peerId) {
  try {
    switch (data.type) {
    case MSG.JOIN_REQUEST: {
      try {
        const { playerId, playerName, originalPeerId, isReconnect } = data.payload;
        console.log('Join request from:', playerName, isReconnect ? '(reconnect)' : '');

        // 1. 先按 playerId 查找已有玩家
        const existingByPlayerId = cachedRoom?.players.find(p => p.id === playerId);

        if (existingByPlayerId && !existingByPlayerId.isOnline) {
          // playerId 匹配到离线玩家 → 重连
          existingByPlayerId.isOnline = true;
          existingByPlayerId._peerId = originalPeerId || peerId;
          if (cachedRoom.disconnectedPlayers) {
            cachedRoom.disconnectedPlayers = cachedRoom.disconnectedPlayers.filter(p => p.id !== playerId);
          }
          broadcastState();
          p2p.sendTo(peerId, MSG.JOIN_RESPONSE, { success: true, reconnected: true, originalPlayerId: playerId });
          return;
        }

        if (existingByPlayerId && existingByPlayerId.isOnline) {
          // playerId 匹配到在线玩家 → 可能是重复请求
          p2p.sendTo(peerId, MSG.ROOM_STATE, { room: cachedRoom });
          return;
        }

        // 2. playerId 未匹配，按 playerName 查找已有玩家（处理缓存丢失后以新 playerId 重新加入的情况）
        const existingByName = cachedRoom?.players.find(
          p => p.name === playerName && !p.isOnline
        );

        if (existingByName) {
          // 名字匹配到离线玩家 → 视为重连，恢复原身份
          existingByName.isOnline = true;
          existingByName._peerId = originalPeerId || peerId;
          if (cachedRoom.disconnectedPlayers) {
            cachedRoom.disconnectedPlayers = cachedRoom.disconnectedPlayers.filter(p => p.id !== existingByName.id);
          }
          broadcastState();
          p2p.sendTo(peerId, MSG.JOIN_RESPONSE, { success: true, reconnected: true, originalPlayerId: existingByName.id });
          return;
        }

        const existingOnlineByName = cachedRoom?.players.find(
          p => p.name === playerName && p.isOnline
        );
        if (existingOnlineByName) {
          p2p.sendTo(peerId, MSG.JOIN_RESPONSE, { success: false, error: '该名字的玩家已在线' });
          return;
        }

        // 3. 完全没有匹配 → 这是新玩家
        // 游戏已开始则拒绝新玩家加入
        if (cachedRoom && cachedRoom.status !== GAME_PHASES.WAITING && cachedRoom.phase !== GAME_PHASES.WAITING) {
          const errMsg = '游戏已经开始，无法加入房间';
          console.warn('[GameStore] Rejecting join: game already started');
          p2p.sendTo(peerId, MSG.JOIN_RESPONSE, { success: false, error: errMsg });
          return;
        }

        // 游戏未开始，允许新玩家加入
        const joinKey = generateOpKey(MSG.JOIN_REQUEST, { playerId, roomCode: cachedRoom?.code, isReconnect });
        if (isDuplicateOp(joinKey)) {
          log.debug('Duplicate JOIN_REQUEST ignored', { key: joinKey });
          p2p.sendTo(peerId, MSG.ROOM_STATE, { room: cachedRoom });
          return;
        }

        const result = addPlayerToRoom(cachedRoom, playerName, playerId);
        if (result.error) {
          p2p.sendTo(peerId, MSG.JOIN_RESPONSE, { success: false, error: result.error });
          return;
        }
        const player = cachedRoom.players.find(p => p.id === playerId);
        if (player) {
          player._peerId = originalPeerId || peerId;
        }
        broadcastState();

        const otherPeers = p2p.getConnectedPeers().filter(id => id !== peerId);
        otherPeers.forEach(otherPeerId => {
          p2p.sendTo(otherPeerId, MSG.CONNECT_TO_PEER, { peerId: originalPeerId || peerId });
        });

        break;
      } catch (err) {
        log.error('handleHostMessage:JOIN_REQUEST error', { type: data?.type, peerId, error: err });
        break;
      }
    }

    case MSG.SUBMIT_STORY: {
      try {
        const submitStoryKey = generateOpKey(MSG.SUBMIT_STORY, {
          playerId: data.payload.playerId,
          roomCode: cachedRoom?.code,
          cardIndex: data.payload.cardIndex,
          clue: data.payload.clue
        });
        if (isDuplicateOp(submitStoryKey)) {
          log.debug('Duplicate SUBMIT_STORY ignored', { key: submitStoryKey });
          p2p.sendTo(peerId, MSG.ROOM_STATE, { room: cachedRoom, error: '请勿重复提交' });
          return;
        }
        clearPickingTimer();
        const result = submitStorySelection(cachedRoom, data.payload.playerId, data.payload.cardIndex, data.payload.clue);
        if (result.error) {
          p2p.sendTo(peerId, MSG.ROOM_STATE, { room: cachedRoom, error: result.error });
          return;
        }
        broadcastState();
        scheduleOthersPickingTimeout();
        break;
      } catch (err) {
        log.error('handleHostMessage:SUBMIT_STORY error', { type: data?.type, peerId, error: err });
        break;
      }
    }

    case MSG.SUBMIT_CARD: {
      try {
        const submitCardKey = generateOpKey(MSG.SUBMIT_CARD, {
          playerId: data.payload.playerId,
          roomCode: cachedRoom?.code,
          cardIndex: data.payload.cardIndex
        });
        if (isDuplicateOp(submitCardKey)) {
          log.debug('Duplicate SUBMIT_CARD ignored', { key: submitCardKey });
          p2p.sendTo(peerId, MSG.ROOM_STATE, { room: cachedRoom, error: '请勿重复提交' });
          return;
        }
        const result = submitCard(cachedRoom, data.payload.playerId, data.payload.cardIndex);
        if (result.error) {
          p2p.sendTo(peerId, MSG.ROOM_STATE, { room: cachedRoom, error: result.error });
          return;
        }
        broadcastState();
        // 如果进入投票阶段，启动投票超时定时器
        if (cachedRoom.phase === GAME_PHASES.REVEALING) {
          clearOthersPickingTimer();
          scheduleVotingTimeout();
        }
        break;
      } catch (err) {
        log.error('handleHostMessage:SUBMIT_CARD error', { type: data?.type, peerId, error: err });
        break;
      }
    }

    case MSG.SUBMIT_VOTE: {
      try {
        const submitVoteKey = generateOpKey(MSG.SUBMIT_VOTE, {
          playerId: data.payload.playerId,
          roomCode: cachedRoom?.code,
          votedCardId: data.payload.votedCardId
        });
        if (isDuplicateOp(submitVoteKey)) {
          log.debug('Duplicate SUBMIT_VOTE ignored', { key: submitVoteKey });
          p2p.sendTo(peerId, MSG.ROOM_STATE, { room: cachedRoom, error: '请勿重复投票' });
          return;
        }
        clearVotingTimer();
        const result = submitVote(cachedRoom, data.payload.playerId, data.payload.votedCardId);
        if (result.error) {
          p2p.sendTo(peerId, MSG.ROOM_STATE, { room: cachedRoom, error: result.error });
          return;
        }
        broadcastState();
        if (cachedRoom.phase === GAME_PHASES.SCORING) {
          scheduleAutoAdvance();
        }
        break;
      } catch (err) {
        log.error('handleHostMessage:SUBMIT_VOTE error', { type: data?.type, peerId, error: err });
        break;
      }
    }

    case MSG.NEXT_ROUND: {
      try {
        if (data.payload.playerId !== cachedRoom.hostId) return;
        const nextRoundKey = generateOpKey(MSG.NEXT_ROUND, { playerId: data.payload.playerId, roomCode: cachedRoom?.code });
        if (isDuplicateOp(nextRoundKey)) {
          log.debug('Duplicate NEXT_ROUND ignored', { key: nextRoundKey });
          broadcastState();
          return;
        }
        clearScoringTimer();
        if (cachedRoom.status === GAME_PHASES.ENDED) {
          restartGame(cachedRoom);
        } else {
          const result = nextRound(cachedRoom);
          if (result.error) {
            log.warn('Host received NEXT_ROUND but nextRound failed', { error: result.error });
            break;
          }
        }
        broadcastState();
        if (cachedRoom.phase === GAME_PHASES.STORYTELLER_PICKING) {
          schedulePickingTimeout();
        }
        break;
      } catch (err) {
        log.error('handleHostMessage:NEXT_ROUND error', { type: data?.type, peerId, error: err });
        break;
      }
    }

    case MSG.REQUEST_STATE: {
      try {
        if (!cachedRoom) break;
        const requestKey = generateOpKey(MSG.REQUEST_STATE, {
          playerId: data.payload.playerId,
          roomCode: cachedRoom?.code
        });
        if (isDuplicateOp(requestKey)) break;
        // Force send full state snapshot to the requesting peer
        p2p.sendTo(peerId, MSG.ROOM_STATE, { room: cachedRoom });
        break;
      } catch (err) {
        log.error('handleHostMessage:REQUEST_STATE error', { type: data?.type, peerId, error: err });
        break;
      }
    }
  }
  } catch (err) {
    log.error('handleHostMessage error', { type: data?.type, peerId, error: err });
  }
}

function handleGuestMessage(data, peerId) {
  try {
    switch (data.type) {
    case MSG.ROOM_STATE: {
      try {
        if (data.payload.room) {
          const room = data.payload.room;
          const roomStateKey = generateOpKey(MSG.ROOM_STATE, { roomCode: room.code, detail: getRoomStateDedupeDetail(room) });
          if (isDuplicateOp(roomStateKey)) {
            log.debug('Duplicate ROOM_STATE ignored', { key: roomStateKey });
            break;
          }
          
          cachedRoom = data.payload.room;
          updateLocalState(cachedRoom);
          stopJoinRetry();
          if (_joinTimeout) {
            clearTimeout(_joinTimeout);
            _joinTimeout = null;
          }
          if (data.payload.error) {
            showToast(data.payload.error, 'warning');
          }
          if (!gameState.connected) {
            gameState.connected = true;
            if (gameState.connectionStatus === 'reconnecting') {
              cancelAutoReconnect();
              _reconnectAttempts = 0;
              setConnectionStatus('connected', '重连成功，状态已恢复');
            } else {
              setConnectionStatus('connected', '已连接');
            }
            gameState.screen = 'lobby';
          }
        } else if (data.payload.delta) {
          const delta = data.payload.delta;
          if (!cachedRoom) {
            log.warn('Delta received but no cachedRoom', { peerId });
            break;
          }

          // ── Preserve shuffledCards order ──────────────────────────────────
          // shuffledCards is created ONCE in submitCard() when entering REVEALING
          // phase and never modified after that. However, computeRoomDiff sends
          // the entire gameState as a single field whenever any subfield changes
          // (votes, roundScores, etc.), which can replace shuffledCards with a
          // differently-ordered copy. We keep the existing shuffledCards to
          // prevent cards from visually reordering during voting.
          const existingShuffledCards =
            delta.gameState && cachedRoom.gameState
              ? cachedRoom.gameState.shuffledCards
              : null;

          Object.keys(delta).forEach(key => {
            cachedRoom[key] = delta[key];
          });

          // Restore the original shuffledCards if the delta replaced gameState
          if (existingShuffledCards && cachedRoom.gameState) {
            cachedRoom.gameState.shuffledCards = existingShuffledCards;
          }

          updateLocalState(cachedRoom);
        }
        break;
      } catch (err) {
        log.error('handleGuestMessage:ROOM_STATE error', { type: data?.type, peerId, error: err });
        break;
      }
    }

    case MSG.JOIN_RESPONSE: {
      try {
        if (data.payload.success === false) {
          const errMsg = data.payload.error || '加入房间失败';
          gameState.error = errMsg;
          setConnectionStatus('error', errMsg);
          showToast(errMsg, 'error');
          stopJoinRetry();
          cleanup();
          gameState.screen = 'menu';
        } else if (data.payload.reconnected) {
          // 房主返回了原始 playerId，更新本地身份
          if (data.payload.originalPlayerId && data.payload.originalPlayerId !== gameState.playerId) {
            console.log('[GameStore] Restoring original playerId:', data.payload.originalPlayerId);
            gameState.playerId = data.payload.originalPlayerId;
          }
          stopJoinRetry();
          gameState.connected = true;
          setConnectionStatus('connected', '重连成功');
        }
        break;
      } catch (err) {
        log.error('handleGuestMessage:JOIN_RESPONSE error', { type: data?.type, peerId, error: err });
        break;
      }
    }

    case MSG.RECONNECTED:
      break;

    case MSG.PEER_LIST: {
      try {
        const { peers } = data.payload;
        console.log('Received peer list:', peers);
        if (peers && peers.length > 0) {
          peers.forEach(async (peerId) => {
            try {
              await p2p.connectToPeer(peerId);
              console.log('Connected to peer:', peerId);
            } catch (err) {
              console.error('Failed to connect to peer:', peerId, err);
            }
          });
        }
        break;
      } catch (err) {
        log.error('handleGuestMessage:PEER_LIST error', { type: data?.type, peerId, error: err });
        break;
      }
    }

    case MSG.HOST_MIGRATION: {
      try {
        const { newHostId, newHostPeerId, room } = data.payload;
        console.log('Host migration to:', newHostId);

        if (newHostId === gameState.playerId) {
          break;
        }

        hostMigrator.resetMigrationMutex();
        log.info('Host migration resolved by peer', { newHostId });

        cachedRoom = room;
        updateLocalState(cachedRoom);

        p2p.connectToPeer(newHostPeerId).then(() => {
          setConnectionStatus('connected', '已连接到新房主');
          gameState.connected = true;
        }).catch((err) => {
          console.error('Failed to connect to new host:', err);
        });
        break;
      } catch (err) {
        log.error('handleGuestMessage:HOST_MIGRATION error', { type: data?.type, peerId, error: err });
        break;
      }
    }

    case MSG.CONNECT_TO_PEER: {
      try {
        const { peerId: targetPeerId } = data.payload;
        p2p.connectToPeer(targetPeerId).catch((err) => {
          console.error('Failed to connect to peer:', targetPeerId, err);
        });
        break;
      } catch (err) {
        log.error('handleGuestMessage:CONNECT_TO_PEER error', { type: data?.type, peerId, error: err });
        break;
      }
    }
  }
  } catch (err) {
    log.error('handleGuestMessage error', { type: data?.type, peerId, error: err });
  }
}

function broadcastState() {
  if (!cachedRoom) return;
  cleanupOps();
  roomBroadcaster.broadcastState();
}

function updateLocalState(room) {
  if (!room) return;

  gameState.roomCode = room.code;
  gameState.isHost = room.hostId === gameState.playerId;

  gameState.room = {
    players: (room.players || []).map(p => ({ ...p })),
    phase: room.phase || GAME_PHASES.WAITING,
    status: room.status || GAME_PHASES.WAITING,
    gameState: room.gameState ? {
      round: room.gameState.round || 0,
      storytellerId: room.gameState.storytellerId || null,
      clue: room.gameState.clue || '',
      submittedCards: room.gameState.submittedCards ? [...room.gameState.submittedCards] : [],
      shuffledCards: sanitizeShuffledCardsForClient(room.gameState, room.phase),
      votes: room.gameState.votes ? [...room.gameState.votes] : [],
      roundScores: room.gameState.roundScores ? { ...room.gameState.roundScores } : {},
      scores: room.gameState.scores ? { ...room.gameState.scores } : {},
      roundHistory: room.gameState.roundHistory ? [...room.gameState.roundHistory] : [],
      winner: room.gameState.winner || null,
      secretCardId: room.gameState.secretCardId != null ? room.gameState.secretCardId : null
    } : {
      round: 0,
      storytellerId: null,
      clue: '',
      submittedCards: [],
      shuffledCards: [],
      votes: [],
      roundScores: {},
      scores: {},
      roundHistory: [],
      winner: null,
      secretCardId: null
    },
    hostId: room.hostId || null,
    disconnectedPlayers: room.disconnectedPlayers ? [...room.disconnectedPlayers] : [],
    savedPhase: room.savedPhase || null,
    savedStorytellerId: room.savedStorytellerId || null
  };

  syncScreenToPhase(room);
}

function sanitizeShuffledCardsForClient(gameState, phase) {
  if (!gameState.shuffledCards) return [];

  if (phase === GAME_PHASES.SCORING || phase === GAME_PHASES.ENDED) {
    return [...gameState.shuffledCards];
  }

  return gameState.shuffledCards.map(card => ({
    id: card.id,
    word: card.word,
    submitterId: card.submitterId
  }));
}

function syncScreenToPhase(room) {
  if (room.status === GAME_PHASES.PLAYING && gameState.screen === 'lobby') {
    gameState.screen = 'game';
  }
  if (room.status === GAME_PHASES.ENDED && gameState.screen !== 'result') {
    cancelAutoReconnect();
    setConnectionStatus('connected', '');
    scheduleRoomAutoDestroy('room_ended');
    gameState.screen = 'result';
  }
}

export function handleStartGame() {
  if (!gameState.isHost) return;
  startGame(cachedRoom);
  schedulePickingTimeout();
  broadcastState();
  p2p.broadcast(MSG.SUBMIT_STORY, { playerId: gameState.playerId });
}

export function handleSubmitStorySelection(cardIndex, clue) {
  clearPickingTimer();
  const { value: sanitizedClue, error: clueError } = sanitizeStoryClue(clue);
  if (clueError) {
    showToast(clueError, 'warning');
    return false;
  }
  const result = submitStorySelection(cachedRoom, gameState.playerId, cardIndex, sanitizedClue);
  if (result.error) {
    showToast(result.error, 'warning');
    return false;
  }
  broadcastState();
  p2p.broadcast(MSG.SUBMIT_STORY, {
    playerId: gameState.playerId,
    cardIndex,
    clue: sanitizedClue
  });
  scheduleOthersPickingTimeout();
  return true;
}

export function handleSubmitCard(cardIndex) {
  const result = submitCard(cachedRoom, gameState.playerId, cardIndex);
  if (result.error) {
    showToast(result.error, 'warning');
    return false;
  }
  broadcastState();
  p2p.broadcast(MSG.SUBMIT_CARD, {
    playerId: gameState.playerId,
    cardIndex
  });
  if (cachedRoom.phase === GAME_PHASES.REVEALING) {
    clearOthersPickingTimer();
    scheduleVotingTimeout();
  }
  return true;
}

export function handleSubmitVote(votedCardId) {
  const result = submitVote(cachedRoom, gameState.playerId, votedCardId);
  if (result.error) {
    showToast(result.error, 'warning');
    return false;
  }
  broadcastState();
  p2p.broadcast(MSG.SUBMIT_VOTE, {
    playerId: gameState.playerId,
    votedCardId
  });
  return true;
}

export function handleNextRound() {
  if (!gameState.isHost) return;
  clearScoringTimer();
  if (cachedRoom.status === GAME_PHASES.ENDED) {
    restartGame(cachedRoom);
  } else {
    const result = nextRound(cachedRoom);
    if (result.error) {
      showToast(result.error, 'warning');
      return;
    }
  }
  broadcastState();
  if (cachedRoom.phase === GAME_PHASES.STORYTELLER_PICKING) {
    schedulePickingTimeout();
  }
  p2p.broadcast(MSG.NEXT_ROUND, { playerId: gameState.playerId });
}

export function handleEndGame() {
  if (!gameState.isHost) return;
  clearScoringTimer();
  clearPickingTimer();
  clearOthersPickingTimer();
  clearVotingTimer();
  clearOfflinePlayerCleanupTimer();
  cachedRoom.gameState.winner = null;
  cachedRoom.status = GAME_PHASES.ENDED;
  cachedRoom.phase = GAME_PHASES.ENDED;
  cachedRoom.updatedAt = Date.now();
  broadcastState();
}

export async function leaveRoom() {
  cleanup({ forceStatusReset: true });
  gameState.screen = 'menu';
}

function cleanup({ forceStatusReset = false } = {}) {
  flushStateCache(gameState);
  p2p.stopHeartbeat();
  p2p.disconnect();
  hostMigrator.resetMigrationMutex();
  clearScoringTimer();
  clearPickingTimer();
  clearOthersPickingTimer();
  clearVotingTimer();
  clearOfflinePlayerCleanupTimer();
  clearDisconnectedSkipTimer();
  clearRoomAutoDestroyTimer();
  cancelAutoReconnect();
  _reconnectAttempts = 0;
  if (_autoReconnectInterval) { clearInterval(_autoReconnectInterval); _autoReconnectInterval = null; }
  cachedRoom = null;
  roomBroadcaster.resetBroadcastState();
  resetOps();
  if (_joinTimeout) {
    clearTimeout(_joinTimeout);
    _joinTimeout = null;
  }
  stopJoinRetry();
  gameState.connected = false;
  gameState.connecting = false;
  // Keep gameState.error — it contains the last error message for display.
  // It will be cleared when user retries createRoom/joinRoom.
  gameState.playerId = null;
  gameState.playerName = '';
  gameState.roomCode = null;
  gameState.isHost = false;
  // User-initiated leaves must always dismiss connection overlays.
  if (forceStatusReset || gameState.connectionStatus !== 'error') {
    setConnectionStatus('disconnected', '');
  }

  gameState.room = {
    players: [],
    phase: GAME_PHASES.WAITING,
    status: GAME_PHASES.WAITING,
    gameState: {
      round: 0,
      storytellerId: null,
      clue: '',
      submittedCards: [],
      shuffledCards: [],
      votes: [],
      roundScores: {},
      scores: {},
      roundHistory: [],
      winner: null,
      secretCardId: null
    },
    disconnectedPlayers: [],
    savedPhase: null,
    savedStorytellerId: null
  };

  clearStateCache();
}

export const RECONNECT_METADATA = {
  get attempt() { return _reconnectAttempts; },
  MAX_ATTEMPTS: MAX_RECONNECT_ATTEMPTS
};

export { GAME_PHASES };
