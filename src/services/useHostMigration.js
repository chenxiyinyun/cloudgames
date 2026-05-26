/**
 * 房主迁移逻辑 — 当房主断开时，访客端自动选举新房主
 */
import p2p from './p2p';
import { createLogger } from './logger';

const log = createLogger('HostMigration');

let _migrationInProgress = false;

export function isMigrationInProgress() {
  return _migrationInProgress;
}

export function resetMigrationMutex() {
  _migrationInProgress = false;
}

/**
 * 处理房主断开 — 访客端调用
 * @param {object} cachedRoom - 当前房间状态引用
 * @param {object} gameState - 游戏全局状态
 * @param {function} broadcastState - 广播状态
 * @param {function} setupHostHandlers - 设置房主处理函数
 */
export async function handleHostDisconnect(cachedRoom, gameState, { broadcastState, setupHostHandlers }) {
  if (!cachedRoom) return;

  // 互斥锁：防止多个访客同时触发迁移
  if (_migrationInProgress) {
    log.info('Host migration already in progress, skipping');
    return;
  }
  _migrationInProgress = true;

  // 安全阀：5 秒后自动重置互斥锁
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
    return { action: 'room_closed' };
  }

  // 选举新房主：按加入顺序（order）最小的在线玩家
  const candidates = cachedRoom.players
    .filter(p => p.isOnline !== false)
    .sort((a, b) => a.order - b.order);

  const newHost = candidates[0];

  if (newHost.id === gameState.playerId) {
    // 我成为新房主
    log.info('I am the new host!');
    await becomeNewHost(cachedRoom, gameState, { broadcastState, setupHostHandlers });
    clearTimeout(safetyTimer);
    return { action: 'became_host' };
  } else {
    // 等待新房主连接我
    log.info('Waiting for new host:', newHost.name);

    const newHostPeerId = newHost._peerId || `codenames-guest-${newHost.id}`;
    try {
      await p2p.connectToPeer(newHostPeerId);
      clearTimeout(safetyTimer);
      _migrationInProgress = false;
      return { action: 'connected_to_new_host' };
    } catch (err) {
      log.error('Failed to connect to new host, attempting self-promotion', { error: err });
      clearTimeout(safetyTimer);
      await becomeNewHost(cachedRoom, gameState, { broadcastState, setupHostHandlers });
      return { action: 'became_host_fallback' };
    }
  }
}

/**
 * 成为新房主
 */
export async function becomeNewHost(cachedRoom, gameState, { broadcastState, setupHostHandlers }) {
  if (!cachedRoom) return;

  // 更新房间状态
  cachedRoom.hostId = gameState.playerId;
  gameState.isHost = true;

  // 更新玩家状态
  const me = cachedRoom.players.find(p => p.id === gameState.playerId);
  if (me) {
    me.isHost = true;
    me._peerId = p2p.getMyPeerId();
  }

  // 移除旧房主的连接
  const oldHostPeerId = `codenames-${gameState.roomCode}`;
  p2p.connections = p2p.connections.filter(c => c.peer !== oldHostPeerId);

  // 广播房主变更
  try {
    p2p.broadcast('HOST_MIGRATION', {
      newHostId: gameState.playerId,
      newHostPeerId: p2p.getMyPeerId(),
      room: cachedRoom
    });
  } catch (err) {
    log.error('Failed to broadcast HOST_MIGRATION', { error: err });
  }

  // 迁移完成 — 清除互斥锁
  _migrationInProgress = false;

  // 重启心跳并切换到房主处理函数
  p2p.stopHeartbeat();
  setupHostHandlers();

  broadcastState();
}
