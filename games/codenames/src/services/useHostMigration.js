/**
 * 房主迁移逻辑 — 薄封装，核心实现在 src/shared/online/useHostMigration.js
 */
import p2p from './p2p';
import { createLogger } from '../../../../src/shared/online/logger';
import { createHostMigrationHandler } from '../../../../src/shared/online/useHostMigration';

const log = createLogger('HostMigration');

const handler = createHostMigrationHandler({
  gameId: 'codenames',
  p2p,
  log
});

export function isMigrationInProgress() {
  return handler.isMigrationInProgress();
}

export function resetMigrationMutex() {
  handler.resetMigrationMutex();
}

export async function handleHostDisconnect(cachedRoom, gameState, { broadcastState, setupHostHandlers }) {
  return handler.handleHostDisconnect(cachedRoom, gameState, {
    broadcastState,
    setupHostHandlers,
    setConnectionStatus: (status, msg) => {
      if (gameState) {
        gameState.connectionStatus = status;
        gameState.connectionMessage = msg;
      }
    },
    enableWaitBranch: false // 猜词不需要等待分支
  });
}
