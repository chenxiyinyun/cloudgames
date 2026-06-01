// 加入/重连重发与超时定时器 —— 纯叶子模块，不依赖房间状态或 P2P。
// 回调由调用方（connection.js）以闭包形式传入。

let _joinRetryInterval = null;
let _joinTimeout = null;

/** 启动加入请求重发循环（覆盖前一个） */
export function startJoinRetry(fn, intervalMs) {
  if (_joinRetryInterval) clearInterval(_joinRetryInterval);
  _joinRetryInterval = setInterval(fn, intervalMs);
}

/** 启动加入超时兜底（覆盖前一个） */
export function startJoinTimeout(fn, ms) {
  if (_joinTimeout) clearTimeout(_joinTimeout);
  _joinTimeout = setTimeout(fn, ms);
}

/** 停止重发循环与超时兜底 */
export function stopJoinRetry() {
  if (_joinRetryInterval) {
    clearInterval(_joinRetryInterval);
    _joinRetryInterval = null;
  }
  if (_joinTimeout) {
    clearTimeout(_joinTimeout);
    _joinTimeout = null;
  }
}
