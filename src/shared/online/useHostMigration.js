/**
 * 通用房主迁移逻辑 — 当房主断开时，访客端自动选举新房主。
 *
 * 两个游戏共享相同的核心流程：
 *   1. 互斥锁防止多个访客同时迁移
 *   2. 按加入顺序（order）选举新房主
 *   3. 成为新房主 → 广播 HOST_MIGRATION → 切换 handler
 *
 * 猫猜独有特性（通过 enableWaitBranch 控制）：
 *   - 更高 order 的访客等待新房主自动接管（10s 超时兜底）
 *
 * Usage:
 *   import { createHostMigrationHandler } from '@/shared/online/useHostMigration'
 *   const { handleHostDisconnect } = createHostMigrationHandler({ gameId, p2p, log })
 */
export function createHostMigrationHandler({ gameId, p2p, log }) {
  let _migrationInProgress = false;
  let _migrationWaitTimer = null;

  /** @returns {boolean} 是否正在迁移中 */
  function isMigrationInProgress() {
    return _migrationInProgress;
  }

  /** 强制重置迁移互斥锁（紧急出口） */
  function resetMigrationMutex() {
    _migrationInProgress = false;
    clearWaitTimer();
  }

  /** 清理等待计时器 */
  function clearWaitTimer() {
    if (_migrationWaitTimer) {
      clearTimeout(_migrationWaitTimer);
      _migrationWaitTimer = null;
    }
  }

  /**
   * 处理房主断开 — 访客端调用。
   *
   * @param {object}  cachedRoom  - 当前房间状态（可变引用）
   * @param {object}  gameState   - 游戏全局状态（可变引用）
   * @param {object}  opts
   * @param {Function} opts.broadcastState     - 广播房间状态
   * @param {Function} opts.setupHostHandlers  - 切换为房主 handler
   * @param {Function} opts.setConnectionStatus - 更新连接状态 UI
   * @param {Function} opts.onBecomeHost       - 成为房主后的额外操作（如重启定时器）
   * @param {boolean}  opts.enableWaitBranch   - 启用"高 order 访客等待"分支（猫猜特有）
   */
  async function handleHostDisconnect(cachedRoom, gameState, {
    broadcastState,
    setupHostHandlers,
    setConnectionStatus,
    onBecomeHost,
    enableWaitBranch = false
  } = {}) {
    if (!cachedRoom) return;

    if (_migrationInProgress) {
      log.info('Host migration already in progress, skipping');
      return;
    }

    // 互斥锁必须在候选评估之前设置（防止竞态）
    _migrationInProgress = true;

    const candidates = cachedRoom.players
      .filter(p => p.isOnline !== false && p.id !== cachedRoom.hostId)
      .sort((a, b) => a.order - b.order);

    if (candidates.length === 0) {
      _migrationInProgress = false;
      if (setConnectionStatus) {
        setConnectionStatus('error', '房主已断开，房间关闭');
      }
      if (gameState) {
        gameState.error = '房主已断开，房间关闭';
        gameState.connected = false;
      }
      return { action: 'room_closed' };
    }

    const newHost = candidates[0];
    const myOrder = cachedRoom.players.find(p => p.id === gameState.playerId)?.order ?? Infinity;

    // 猫猜特有：高 order 访客（更晚加入）应该等待新房主推举结果
    if (enableWaitBranch && myOrder > newHost.order) {
      log.info(`Waiting for new host (my order: ${myOrder}, new host order: ${newHost.order})`);
      if (setConnectionStatus) {
        setConnectionStatus('reconnecting', `等待 ${newHost.name} 成为新房主...`);
      }

      clearWaitTimer();
      _migrationWaitTimer = setTimeout(() => {
        if (!cachedRoom || !gameState.playerId) return;
        log.warn('New host did not assert in time, re-evaluating');
        _migrationInProgress = false;
        handleHostDisconnect(cachedRoom, gameState, {
          broadcastState, setupHostHandlers, setConnectionStatus, onBecomeHost, enableWaitBranch
        });
      }, 10000);
      return { action: 'waiting_for_new_host' }; // 保持锁，等待
    }

    const safetyTimer = setTimeout(() => {
      if (_migrationInProgress) {
        log.warn('Host migration safety timeout triggered, resetting mutex');
        _migrationInProgress = false;
      }
    }, 5000);

    if (newHost.id === gameState.playerId) {
      log.info('I am the new host!');
      await _becomeNewHost(cachedRoom, gameState, {
        broadcastState, setupHostHandlers, onBecomeHost
      });
      clearTimeout(safetyTimer);
      return { action: 'became_host' };
    } else {
      log.info('Waiting for new host:', newHost.name);
      if (setConnectionStatus) {
        setConnectionStatus('reconnecting', '房主已断开，正在重新组织连接...');
      }

      const newHostPeerId = newHost._peerId || `${gameId}-guest-${newHost.id}`;
      try {
        await p2p.connectToPeer(newHostPeerId);
        if (setConnectionStatus) {
          setConnectionStatus('connected', '已连接到新房主');
        }
        clearTimeout(safetyTimer);
        _migrationInProgress = false;
        return { action: 'connected_to_new_host' };
      } catch (err) {
        log.error('Failed to connect to new host, attempting self-promotion', { error: err });
        clearTimeout(safetyTimer);
        await _becomeNewHost(cachedRoom, gameState, {
          broadcastState, setupHostHandlers, onBecomeHost
        });
        return { action: 'became_host_fallback' };
      }
    }
  }

  /**
   * 成为新房主
   */
  async function _becomeNewHost(cachedRoom, gameState, {
    broadcastState,
    setupHostHandlers,
    onBecomeHost
  }) {
    if (!cachedRoom) return;

    cachedRoom.hostId = gameState.playerId;
    gameState.isHost = true;

    const me = cachedRoom.players.find(p => p.id === gameState.playerId);
    if (me) {
      me.isHost = true;
      me._peerId = p2p.getMyPeerId();
    }

    // 移除旧房主的连接（走 P2PService 公共方法，避免直接改写内部 connections）
    const oldHostPeerId = `${gameId}-${gameState.roomCode}`;
    p2p.disconnectPeer(oldHostPeerId);

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

    _migrationInProgress = false;

    // 切换为房主模式
    p2p.stopHeartbeat();
    setupHostHandlers();

    broadcastState();

    // 成为房主后的回调（如重启定时器）
    if (onBecomeHost) {
      onBecomeHost();
    }
  }

  /**
   * 当从外部收到 HOST_MIGRATION 消息时，清理等待计时器。
   * 调用方在消息处理中应该：如果本地也在等待，调用此方法。
   */
  function onHostMigrationReceived() {
    clearWaitTimer();
  }

  return {
    handleHostDisconnect,
    isMigrationInProgress,
    resetMigrationMutex,
    onHostMigrationReceived
  };
}
