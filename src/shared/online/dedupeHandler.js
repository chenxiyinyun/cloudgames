/**
 * 通用去重消息处理辅助 — 生成去重 key → 检查重复 → 执行业务逻辑 → 广播。
 *
 * 所有云游戏共享同一流程，避免每个游戏重复实现去重+广播模式。
 *
 * Usage:
 *   import { createDedupeHandler } from '@/shared/online/dedupeHandler'
 *   const withDedupe = createDedupeHandler({
 *     generateOpKey, isDuplicateOp, p2p, broadcastState, log,
 *     getRoom, getRoomCode, roomStateType
 *   })
 *   withDedupe(MSG.SUBMIT_VOTE, payload, peerId,
 *     (room) => submitVote(room, payload.playerId, payload.votedCardId),
 *     { dupeMessage: '请勿重复投票' }
 *   )
 */

export function createDedupeHandler({
  generateOpKey,
  isDuplicateOp,
  p2p,
  broadcastState,
  log,
  getRoom,
  getRoomCode,
  roomStateType
}) {
  if (!generateOpKey || !isDuplicateOp || !p2p || !broadcastState) {
    throw new Error('createDedupeHandler requires generateOpKey, isDuplicateOp, p2p, and broadcastState');
  }

  const stateType = roomStateType || 'ROOM_STATE';

  return function withDedupe(msgType, payload, peerId, fn, opts = {}) {
    const room = typeof getRoom === 'function' ? getRoom() : null;
    const roomCode = typeof getRoomCode === 'function' ? getRoomCode() : (room?.code || '');
    const key = generateOpKey(msgType, { ...payload, roomCode });
    if (isDuplicateOp(key)) {
      if (log) log.debug(`Duplicate ${msgType} ignored`, { key });
      if (peerId) {
        p2p.sendTo(peerId, stateType, {
          room,
          error: opts.dupeMessage || '请勿重复操作'
        });
      }
      return;
    }

    const result = fn(room);
    if (result?.error) {
      if (peerId) {
        p2p.sendTo(peerId, stateType, { room: typeof getRoom === 'function' ? getRoom() : room, error: result.error });
      }
      return;
    }

    broadcastState();
    if (typeof opts.afterBroadcast === 'function') {
      opts.afterBroadcast(typeof getRoom === 'function' ? getRoom() : room);
    }
  };
}
