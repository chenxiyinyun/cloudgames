// ── 网络层（catguess，服务器权威 / WebSocket）────────────────────────────────
// 复用共享 createGameNetwork。阶段超时自动推进、离线代操作、计分等全部由服务器
// tick 权威驱动，客户端只发意图、收 STATE。服务器错误用 toast 提示。

import { createGameNetwork } from '../../../../src/shared/ws/createGameNetwork';
import { createLogger } from '../services/logger';
import { gameState, setConnectionStatus, setRoom, updateLocalState } from './state';
import { showToast } from '../components/ToastNotification.vue';

const net = createGameNetwork({
  gameId: 'catguess',
  logger: createLogger('Catguess:Network'),
  gameState,
  setConnectionStatus,
  setRoom,
  updateLocalState,
  onError: ({ message }) => {
    if (message) showToast(message, 'warning');
  }
});

export const RECONNECT_METADATA = net.RECONNECT_METADATA;

export const connectCreate = net.connectCreate;
export const connectJoin = net.connectJoin;
export const reconnectNetwork = net.reconnectNetwork;
export const sendIntent = net.sendIntent;
export const leaveNetwork = net.leaveNetwork;
export const cleanupNetwork = net.cleanupNetwork;
