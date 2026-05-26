/**
 * 幂等性层 — 防止 P2P 广播导致游戏操作被重复处理
 * 房主本地执行 + ROOM_STATE 中继 → 访客可能看到同一操作两次
 */

const _processedOps = new Map();

export function generateOpKey(type, payload, roomCode) {
  const rc = payload.roomCode || roomCode || '';
  const playerId = payload.playerId || '';

  switch (type) {
    case 'SUBMIT_CLUES':
      return `${type}_${rc}_${playerId}_${(payload.clues || []).join(',')}`;
    case 'SUBMIT_TEAM_GUESS':
    case 'SUBMIT_OPPONENT_GUESS':
    case 'SUBMIT_TEAM_VOTE':
      return `${type}_${rc}_${playerId}_${(payload.guess || []).join(',')}`;
    case 'START_GAME':
    case 'NEXT_ROUND':
      return `${type}_${rc}_${playerId}`;
    case 'JOIN_REQUEST':
      return `${type}_${rc}_${playerId}_${payload.isReconnect ? 'reconnect' : 'new'}`;
    case 'ROOM_STATE':
      return `${type}_${rc}_${payload.detail || ''}`;
    default:
      return `${type}_${rc}_${playerId}`;
  }
}

export function isDuplicateOp(key, ttlMs = 10000) {
  const now = Date.now();
  const prev = _processedOps.get(key);
  if (prev && (now - prev) < ttlMs) {
    return true;
  }
  _processedOps.set(key, now);
  return false;
}

export function cleanupOps() {
  const now = Date.now();
  for (const [key, ts] of _processedOps) {
    if (now - ts > 30000) {
      _processedOps.delete(key);
    }
  }
}
