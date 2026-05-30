/**
 * 访客消息处理 — 处理房主和其他 peer 发来的 P2P 消息
 */
import p2p from './p2p';
import { createLogger } from './logger';
import { generateOpKey, isDuplicateOp } from './useIdempotency';
import { handleHostDisconnect, isMigrationInProgress, resetMigrationMutex } from './useHostMigration';

const log = createLogger('GuestHandler');

/**
 * 设置访客端的事件处理
 * @param {object} cachedRoom - 可变的房间状态引用
 * @param {function} updateLocalState - 更新本地状态
 * @param {object} gameState - 游戏全局状态
 * @param {function} setConnectionStatus - 设置连接状态
 * @param {function} broadcastState - 广播状态
 * @param {function} setupHostHandlersFn - 房主处理函数设置（迁移后使用）
 */
export function setupGuestHandlers(cachedRoom, updateLocalState, gameState, setConnectionStatus, broadcastState, setupHostHandlersFn) {
  p2p.onPlayerDisconnected = (peerId) => {
    log.info('Guest disconnected from peer:', peerId);
    const hostPeerId = `codenames-${gameState.roomCode}`;
    if (peerId === hostPeerId) {
      if (isMigrationInProgress()) {
        log.info('onPlayerDisconnected: migration already in progress, skipping');
        return;
      }
      log.info('Host disconnected! Attempting migration...');
      triggerHostMigration(cachedRoom, gameState, setConnectionStatus, broadcastState, setupHostHandlersFn);
    }
  };

  p2p.onMessage = (data, peerId) => {
    handleGuestMessage(data, peerId, cachedRoom, updateLocalState, gameState, setConnectionStatus);
  };

  p2p.onError = (err) => {
    log.error('Guest error:', err);
    gameState.error = err.message;
    setConnectionStatus('error', err.message);
  };

  p2p.startHeartbeat(10000);
  p2p.onDeadPeer = (peerId) => {
    log.warn('Guest detected dead peer', { peerId });
    const hostPeerId = `codenames-${gameState.roomCode}`;
    if (peerId === hostPeerId) {
      if (isMigrationInProgress()) {
        log.info('onDeadPeer: migration already in progress, skipping');
        return;
      }
      log.warn('Host is dead, triggering migration');
      triggerHostMigration(cachedRoom, gameState, setConnectionStatus, broadcastState, setupHostHandlersFn);
    }
  };
}

async function triggerHostMigration(cachedRoom, gameState, setConnectionStatus, broadcastState, setupHostHandlersFn) {
  const result = await handleHostDisconnect(cachedRoom, gameState, {
    updateLocalState: () => {}, // updateLocalState 在 broadcastState 中已调用
    broadcastState,
    setupHostHandlers: setupHostHandlersFn
  });

  if (result?.action === 'room_closed') {
    setConnectionStatus('error', '房主已断开，房间关闭');
    gameState.error = '房主已断开，房间关闭';
    gameState.connected = false;
  } else if (result?.action === 'connected_to_new_host') {
    setConnectionStatus('connected', '已连接到新房主');
  } else if (result?.action?.startsWith('became_host')) {
    setConnectionStatus('connected', '你已成为新房主');
    gameState.connected = true;
  }
}

function handleGuestMessage(data, peerId, cachedRoom, updateLocalState, gameState, setConnectionStatus) {
  try {
    switch (data.type) {
    case 'ROOM_STATE': {
      try {
        if (data.payload.room) {
          const room = data.payload.room;
          const roomStateKey = generateOpKey('ROOM_STATE', { roomCode: room.code, detail: `${room.currentRound}_${room.phase}` }, room.code);
          if (isDuplicateOp(roomStateKey)) {
            log.debug('Duplicate ROOM_STATE ignored', { key: roomStateKey });
            break;
          }
          // 更新 cachedRoom 引用
          Object.keys(room).forEach(key => {
            cachedRoom[key] = room[key];
          });
          updateLocalState(cachedRoom);
          if (data.payload.error) {
            // showToast via dynamic import in non-async context
            import('../components/ToastNotification.vue').then(m => {
              m.showToast(data.payload.error, 'warning');
            });
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

    case 'JOIN_RESPONSE': {
      try {
        if (data.payload.success === false) {
          gameState.error = data.payload.error || '加入房间失败';
          setConnectionStatus('error', data.payload.error || '加入房间失败');
          gameState.screen = 'menu';
        } else if (data.payload.reconnected) {
          setConnectionStatus('connected', '重连成功');
        }
        break;
      } catch (err) {
        log.error('handleGuestMessage:JOIN_RESPONSE error', { type: data?.type, peerId, error: err });
        break;
      }
    }

    case 'PEER_LIST': {
      try {
        const { peers } = data.payload;
        log.info('Received peer list:', peers);
        if (peers && peers.length > 0) {
          peers.forEach(async (peerId) => {
            try {
              await p2p.connectToPeer(peerId);
              log.info('Connected to peer:', peerId);
            } catch (err) {
              log.error('Failed to connect to peer:', peerId, err);
            }
          });
        }
        break;
      } catch (err) {
        log.error('handleGuestMessage:PEER_LIST error', { type: data?.type, peerId, error: err });
        break;
      }
    }

    case 'HOST_MIGRATION': {
      try {
        const { newHostId, newHostPeerId, room } = data.payload;
        log.info('Host migration to:', newHostId);

        if (newHostId === gameState.playerId) {
          break;
        }

        resetMigrationMutex();
        log.info('Host migration resolved by peer', { newHostId });

        // 更新 cachedRoom
        Object.keys(room).forEach(key => {
          cachedRoom[key] = room[key];
        });
        updateLocalState(cachedRoom);

        p2p.connectToPeer(newHostPeerId).then(() => {
          setConnectionStatus('connected', '已连接到新房主');
          gameState.connected = true;
        }).catch((err) => {
          log.error('Failed to connect to new host:', err);
        });
        break;
      } catch (err) {
        log.error('handleGuestMessage:HOST_MIGRATION error', { type: data?.type, peerId, error: err });
        break;
      }
    }

    case 'CONNECT_TO_PEER': {
      try {
        const { peerId: targetPeerId } = data.payload;
        p2p.connectToPeer(targetPeerId).catch((err) => {
          log.error('Failed to connect to peer:', targetPeerId, err);
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
