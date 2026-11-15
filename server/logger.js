/**
 * 服务端结构化日志：单行人读 + 机器可解析。
 *
 * 形如：`[2026-11-15T10:00:00.000Z] [ws] info room created {"roomCode":"AB12CD"}`
 * 前缀保留 `[ws]` 便于沿用既有 grep/运维习惯，尾部 JSON 便于采集与检索。
 */
export function createLogger({ name = 'ws', sink = console, now = () => new Date() } = {}) {
  function emit(level, message, meta) {
    const suffix = meta === undefined ? '' : ` ${safeJson(meta)}`;
    const line = `[${now().toISOString()}] [${name}] ${level} ${message}${suffix}`;
    const write = level === 'error' ? sink.error : level === 'warn' ? sink.warn : sink.log;
    write.call(sink, line);
  }

  function safeJson(value) {
    try {
      return JSON.stringify(value);
    } catch {
      return '"[unserializable]"';
    }
  }

  return {
    debug() {},
    info: (message, meta) => emit('info', message, meta),
    warn: (message, meta) => emit('warn', message, meta),
    error: (message, meta) => emit('error', message, meta)
  };
}
