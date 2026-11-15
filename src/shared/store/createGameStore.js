import { reactive, watch } from 'vue';
import { createGameNetwork } from '../ws/createGameNetwork';
import { createStateCache } from '../online/stateCache';

/**
 * 共享 store 工厂 — 服务器权威游戏的 state + network + cache 三件套。
 *
 * 4 个游戏的响应式状态骨架（screen/playerId/roomCode/…）、房间镜像访问器
 * （getRoom/setRoom）、网络接线（createGameNetwork）与 localStorage 缓存
 * （watch 落盘 / beforeunload flush / 刷新恢复）完全同构，统一收敛到这里。
 *
 * 各游戏只需提供差异部分：
 *   - gameId / logger / onError      网络接线参数
 *   - cacheKey / stateFields / roomFields  缓存配置
 *   - createEmptyRoom                初始房间镜像
 *   - applyRoom(state, room)         把服务器房间镜像进 state.room（游戏特有字段）
 *   - syncScreenToPhase(state, room) 由房间阶段推导屏幕
 *   - extraState / resetExtra        游戏特有扩展字段（如 codenames 的 team）
 */
export function createGameStore({
  gameId,
  logger = console,
  onError,
  onAgentInvite,
  maxReconnects,
  cacheKey,
  stateFields,
  roomFields,
  createEmptyRoom,
  applyRoom,
  syncScreenToPhase,
  extraState = {},
  resetExtra = () => {}
}) {
  const gameState = reactive({
    screen: 'menu',
    playerId: null,
    playerName: '',
    playerToken: null,
    isHost: false,
    roomCode: null,
    connected: false,
    connecting: false,
    error: null,
    connectionStatus: 'disconnected',
    connectionMessage: '',
    ...extraState,
    room: createEmptyRoom()
  });

  // 最近一次服务器下发的权威房间（缓存/恢复用）。
  // 会被整体重新赋值，因此对外只暴露 getRoom()/setRoom() 访问器。
  let cachedRoom = null;
  function getRoom() {
    return cachedRoom;
  }
  function setRoom(room) {
    cachedRoom = room;
  }

  function setConnectionStatus(status, message = '') {
    gameState.connectionStatus = status;
    gameState.connectionMessage = message;
  }

  // 收到服务器 STATE 时调用：公共派生（roomCode/isHost）+ 游戏特有镜像 + 屏幕推导
  function updateLocalState(room) {
    if (!room) return;
    gameState.roomCode = room.code;
    gameState.isHost = room.hostId === gameState.playerId;
    applyRoom(gameState, room);
    syncScreenToPhase(gameState, room);
  }

  // 离开房间 / 清理时把本地状态恢复到默认
  function resetLocalState() {
    setRoom(null);
    gameState.screen = 'menu';
    gameState.playerId = null;
    gameState.playerName = '';
    gameState.playerToken = null;
    gameState.isHost = false;
    gameState.roomCode = null;
    gameState.connected = false;
    gameState.connecting = false;
    gameState.error = null;
    setConnectionStatus('disconnected', '');
    resetExtra(gameState);
    gameState.room = createEmptyRoom();
  }

  // ── 网络层（复用共享 createGameNetwork）──────────────────────────────────────
  const net = createGameNetwork({
    gameId,
    logger,
    gameState,
    setConnectionStatus,
    setRoom,
    updateLocalState,
    ...(maxReconnects != null ? { maxReconnects } : {}),
    onError,
    onAgentInvite
  });

  // ── 本地缓存（刷新页面可继续之前的房间）─────────────────────────────────────
  // 席位凭证由共享层统一持久化，各游戏无需在 stateFields 里重复声明
  const cache = createStateCache({ cacheKey, stateFields: [...(stateFields || []), 'playerToken'], roomFields });

  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', () => {
      cache.flushStateCache(gameState);
    });
  }

  watch(() => ({
    screen: gameState.screen,
    playerId: gameState.playerId,
    playerName: gameState.playerName,
    roomCode: gameState.roomCode,
    isHost: gameState.isHost,
    connectionStatus: gameState.connectionStatus,
    room: gameState.room
  }), (newState) => {
    // 回到菜单：取消任何待保存的定时器，不缓存菜单状态
    if (newState.screen === 'menu') {
      cache.cancelPendingSave();
      return;
    }
    if (newState.playerId) {
      cache.saveStateToCache(gameState);
    }
  }, { deep: true });

  function restoreFromCache() {
    const cached = cache.loadStateFromCache();
    if (!cached?.state || !cached?.room) return false;

    Object.assign(gameState, cached.state);
    const room = {
      ...cached.room,
      code: cached.state.roomCode,
      id: cached.state.roomCode,
      // 部分游戏的缓存房间不含 hostId，用 isHost 还原
      hostId: cached.room.hostId ?? (cached.state.isHost ? cached.state.playerId : null)
    };
    setRoom(room);
    updateLocalState(room);
    return true;
  }

  return {
    // state
    gameState,
    getRoom,
    setRoom,
    setConnectionStatus,
    updateLocalState,
    resetLocalState,
    // network
    RECONNECT_METADATA: net.RECONNECT_METADATA,
    connectCreate: net.connectCreate,
    connectJoin: net.connectJoin,
    reconnectNetwork: net.reconnectNetwork,
    sendIntent: net.sendIntent,
    requestAgentInvite: net.requestAgentInvite,
    leaveNetwork: net.leaveNetwork,
    cleanupNetwork: net.cleanupNetwork,
    // cache
    restoreFromCache,
    hasRestoreableState: () => cache.hasCachedState(),
    clearCache: () => cache.clearStateCache(),
    flushCache: () => cache.flushStateCache(gameState)
  };
}
