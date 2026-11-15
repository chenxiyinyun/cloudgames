/**
 * 《山海来信》云存档服务装配：存储 + HTTP 接口 + 指标。
 */
import { resolve } from 'node:path';
import { createStore } from './store.js';
import { createShanhaiHttp } from './http.js';

export function createShanhai({
  dbFile = process.env.SHANHAI_DB_PATH || 'server/data/shanhai.sqlite',
  log = null,
  allowedOrigin = process.env.SHANHAI_ALLOWED_ORIGIN || '*',
  now = Date.now
} = {}) {
  const store = createStore({ file: resolve(dbFile), now });
  const http = createShanhaiHttp({ store, log, allowedOrigin, now });
  return {
    handle: http.handle,
    stats: () => store.stats(),
    close: () => store.close()
  };
}
