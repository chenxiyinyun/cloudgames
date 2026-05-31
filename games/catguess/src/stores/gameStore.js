import { reactive, watch } from 'vue';
import p2p from '../services/p2p';
import { createLogger } from '../services/logger';
import {
  GAME_PHASES, generatePlayerId, createInitialRoom,
  addPlayerToRoom, removePlayerFromRoom, startGame,
  submitStorySelection, submitCard, submitVote,
  nextRound, checkWinCondition
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

const log = createLogger('GameStore');

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
let _migrationInProgress = false;
let _joinTimeout = null;
let _joinRetryInterval = null;

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

window.addEventListener('beforeunload', () => {
  flushStateCache(gameState);
});

function setConnectionStatus(status, message = '') {
  gameState.connectionStatus = status;
  gameState.connectionMessage = message;
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
    const playerId = generatePlayerId();

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

    p2p.disconnect();

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
    const playerToRemove = cachedRoom?.players.find(p => p._peerId === peerId);
    if (playerToRemove && cachedRoom) {
      removePlayerFromRoom(cachedRoom, playerToRemove.id);
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
        cachedRoom.disconnectedPlayers.push(playerToMark);
      }
      broadcastState();
    }
  };
}

function setupGuestHandlers() {
  p2p.onPlayerDisconnected = (peerId) => {
    console.log('Guest disconnected from peer:', peerId);

    const hostPeerId = `catguess-${gameState.roomCode}`;
    if (peerId === hostPeerId) {
      if (_migrationInProgress) {
        log.info('onPlayerDisconnected: migration already in progress, skipping');
        return;
      }
      console.log('Host disconnected! Attempting migration...');
      handleHostDisconnect();
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
      if (_migrationInProgress) {
        log.info('onDeadPeer: migration already in progress, skipping');
        return;
      }
      log.warn('Host is dead, triggering migration');
      handleHostDisconnect();
    }
  };
}

async function handleHostDisconnect() {
  if (!cachedRoom) return;

  if (_migrationInProgress) {
    log.info('Host migration already in progress, skipping');
    return;
  }
  _migrationInProgress = true;

  const safetyTimer = setTimeout(() => {
    if (_migrationInProgress) {
      log.warn('Host migration safety timeout triggered, resetting mutex');
      _migrationInProgress = false;
    }
  }, 5000);

  const otherPlayers = cachedRoom.players.filter(p =>
    p.id !== gameState.playerId && p.isOnline !== false
  );

  if (otherPlayers.length === 0) {
    clearTimeout(safetyTimer);
    _migrationInProgress = false;
    setConnectionStatus('error', '房主已断开，房间关闭');
    gameState.error = '房主已断开，房间关闭';
    gameState.connected = false;
    return;
  }

  const candidates = cachedRoom.players
    .filter(p => p.isOnline !== false)
    .sort((a, b) => a.order - b.order);

  const newHost = candidates[0];

  if (newHost.id === gameState.playerId) {
    console.log('I am the new host!');
    await becomeNewHost();
    clearTimeout(safetyTimer);
  } else {
    console.log('Waiting for new host:', newHost.name);
    setConnectionStatus('reconnecting', '房主已断开，正在重新组织连接...');

    const newHostPeerId = newHost._peerId || `catguess-guest-${newHost.id}`;
    try {
      await p2p.connectToPeer(newHostPeerId);
      setConnectionStatus('connected', '已连接到新房主');
      clearTimeout(safetyTimer);
      _migrationInProgress = false;
    } catch (err) {
      console.error('Failed to connect to new host:', err);
      clearTimeout(safetyTimer);
      _migrationInProgress = false;
      becomeNewHost();
    }
  }
}

async function becomeNewHost() {
  if (!cachedRoom) return;

  cachedRoom.hostId = gameState.playerId;
  gameState.isHost = true;

  const me = cachedRoom.players.find(p => p.id === gameState.playerId);
  if (me) {
    me.isHost = true;
    me._peerId = p2p.getMyPeerId();
  }

  const oldHostPeerId = `catguess-${gameState.roomCode}`;
  p2p.connections = p2p.connections.filter(c => c.peer !== oldHostPeerId);

  setConnectionStatus('connected', '你已成为新房主');
  gameState.connected = true;

  try {
    p2p.broadcast(MSG.HOST_MIGRATION, {
      newHostId: gameState.playerId,
      newHostPeerId: p2p.getMyPeerId(),
      room: cachedRoom
    });
  } catch (err) {
    log.error('Failed to broadcast HOST_MIGRATION', { error: err });
  }

  _migrationInProgress = false;

  p2p.stopHeartbeat();
  setupHostHandlers();

  broadcastState();
}

function handleHostMessage(data, peerId) {
  try {
    switch (data.type) {
    case MSG.JOIN_REQUEST: {
      try {
        const { playerId, playerName, originalPeerId, isReconnect } = data.payload;
        console.log('Join request from:', playerName, isReconnect ? '(reconnect)' : '');

        const joinKey = generateOpKey(MSG.JOIN_REQUEST, { playerId, roomCode: cachedRoom?.code, isReconnect });
        if (isDuplicateOp(joinKey)) {
          log.debug('Duplicate JOIN_REQUEST ignored', { key: joinKey });
          p2p.sendTo(peerId, MSG.ROOM_STATE, { room: cachedRoom });
          return;
        }

        const existingPlayer = cachedRoom?.players.find(p => p.id === playerId);
        if (existingPlayer && !existingPlayer.isOnline) {
          existingPlayer.isOnline = true;
          existingPlayer._peerId = originalPeerId || peerId;
          if (cachedRoom.disconnectedPlayers) {
            cachedRoom.disconnectedPlayers = cachedRoom.disconnectedPlayers.filter(p => p.id !== playerId);
          }
          broadcastState();
          p2p.sendTo(peerId, MSG.JOIN_RESPONSE, { success: true, reconnected: true });
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
        const result = submitStorySelection(cachedRoom, data.payload.playerId, data.payload.cardIndex, data.payload.clue);
        if (result.error) {
          p2p.sendTo(peerId, MSG.ROOM_STATE, { room: cachedRoom, error: result.error });
          return;
        }
        broadcastState();
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
        const result = submitVote(cachedRoom, data.payload.playerId, data.payload.votedCardId);
        if (result.error) {
          p2p.sendTo(peerId, MSG.ROOM_STATE, { room: cachedRoom, error: result.error });
          return;
        }
        broadcastState();
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
        if (cachedRoom.status === GAME_PHASES.ENDED) {
          checkWinCondition(cachedRoom);
        } else {
          nextRound(cachedRoom);
        }
        broadcastState();
        break;
      } catch (err) {
        log.error('handleHostMessage:NEXT_ROUND error', { type: data?.type, peerId, error: err });
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
            setConnectionStatus('connected', '已连接');
            gameState.screen = 'lobby';
          }
        } else if (data.payload.delta) {
          const delta = data.payload.delta;
          if (!cachedRoom) {
            log.warn('Delta received but no cachedRoom', { peerId });
            break;
          }
          Object.keys(delta).forEach(key => {
            cachedRoom[key] = delta[key];
          });
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

        _migrationInProgress = false;
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
      shuffledCards: room.gameState.shuffledCards ? [...room.gameState.shuffledCards] : [],
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
    disconnectedPlayers: room.disconnectedPlayers ? [...room.disconnectedPlayers] : [],
    savedPhase: room.savedPhase || null,
    savedStorytellerId: room.savedStorytellerId || null
  };

  syncScreenToPhase(room);
}

function syncScreenToPhase(room) {
  if (room.status === GAME_PHASES.PLAYING && gameState.screen === 'lobby') {
    gameState.screen = 'game';
  }
  if (room.status === GAME_PHASES.ENDED && gameState.screen !== 'result') {
    gameState.screen = 'result';
  }
}

export function handleStartGame() {
  if (!gameState.isHost) return;
  startGame(cachedRoom);
  broadcastState();
  p2p.broadcast(MSG.SUBMIT_STORY, { playerId: gameState.playerId });
}

export function handleSubmitStorySelection(cardIndex, clue) {
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
  if (cachedRoom.status === GAME_PHASES.ENDED) {
    const hasWinner = checkWinCondition(cachedRoom);
    if (!hasWinner) {
      cachedRoom.status = GAME_PHASES.PLAYING;
    }
  } else {
    nextRound(cachedRoom);
  }
  broadcastState();
  p2p.broadcast(MSG.NEXT_ROUND, { playerId: gameState.playerId });
}

export function handleEndGame() {
  if (!gameState.isHost) return;
  cachedRoom.gameState.winner = null;
  cachedRoom.status = GAME_PHASES.ENDED;
  cachedRoom.phase = GAME_PHASES.ENDED;
  cachedRoom.updatedAt = Date.now();
  broadcastState();
}

export async function leaveRoom() {
  cleanup();
  gameState.screen = 'menu';
}

function cleanup() {
  flushStateCache(gameState);
  p2p.stopHeartbeat();
  p2p.disconnect();
  _migrationInProgress = false;
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
  // Only reset connection status, not error state
  if (gameState.connectionStatus !== 'error') {
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

export { GAME_PHASES };
