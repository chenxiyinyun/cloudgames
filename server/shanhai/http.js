/**
 * 《山海来信》云存档 HTTP 接口（路径 A：存档即服务）。
 *
 * 只有四个能力：匿名身份、存档读写（rev 乐观锁）、授时、匿名埋点。
 * 不做权威结算、不做实时同步。
 */
import { createHash, randomBytes, randomUUID } from 'node:crypto';
// 副作用导入：把前后端共用的归一化实现挂到 globalThis.SHSaveSchema
import '../../static/shanhai-letters/src/saveSchema.js';

const schema = globalThis.SHSaveSchema;

const TOKEN_BYTES = 32;
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;
const BODY_MAX_BYTES = 2 * 1024 * 1024;
const SAVE_MAX_BYTES = schema.SAVE_MAX_BYTES;
const EVENTS_MAX = 100;
const EVENT_NAME_MAX = 32;
const PROPS_MAX_BYTES = 1024;

const hash = (value) => createHash('sha256').update(String(value)).digest('hex');

function randomCode() {
  const bytes = randomBytes(CODE_LENGTH);
  let out = '';
  for (let i = 0; i < CODE_LENGTH; i++) out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return out;
}

function createRateLimiter({ limit, windowMs, now }) {
  const buckets = new Map();
  return function hit(key) {
    const t = now();
    const bucket = buckets.get(key);
    if (!bucket || t - bucket.start >= windowMs) {
      buckets.set(key, { start: t, count: 1 });
      if (buckets.size > 5000) {
        for (const [k, b] of buckets) {
          if (t - b.start >= windowMs) buckets.delete(k);
        }
      }
      return true;
    }
    bucket.count += 1;
    return bucket.count <= limit;
  };
}

export function createShanhaiHttp({
  store,
  log = null,
  allowedOrigin = '*',
  now = () => Date.now()
}) {
  const guestLimiter = createRateLimiter({ limit: 10, windowMs: 60_000, now });
  const transferLimiter = createRateLimiter({ limit: 5, windowMs: 10 * 60_000, now });

  function send(res, status, body) {
    if (status === 204) {
      res.writeHead(204, baseHeaders());
      res.end();
      return;
    }
    const payload = JSON.stringify(body);
    res.writeHead(status, { ...baseHeaders(), 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(payload) });
    res.end(payload);
  }

  function baseHeaders() {
    return {
      'Access-Control-Allow-Origin': allowedOrigin,
      'Access-Control-Allow-Headers': 'Authorization, Content-Type',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff'
    };
  }

  const fail = (res, status, code, message, extra) => send(res, status, { code, message, ...(extra || {}) });

  async function readText(req) {
    let text = '';
    for await (const chunk of req) {
      text += chunk;
      if (Buffer.byteLength(text) > BODY_MAX_BYTES) {
        const err = new Error('请求体过大');
        err.code = 'PAYLOAD_TOO_LARGE';
        throw err;
      }
    }
    return text;
  }

  async function readJson(req) {
    const text = await readText(req);
    if (!text.trim()) return {};
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      const err = new Error('请求体必须是 JSON');
      err.code = 'INVALID_JSON';
      throw err;
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      const err = new Error('请求体必须是 JSON 对象');
      err.code = 'INVALID_JSON';
      throw err;
    }
    return body;
  }

  function tokenFrom(req) {
    const header = req.headers && req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) return '';
    const token = header.slice(7).trim();
    return token.length >= 20 && token.length <= 100 ? token : '';
  }

  function authenticate(req) {
    const token = tokenFrom(req);
    if (!token) return null;
    const profile = store.findByTokenHash(hash(token));
    return profile ? { profile, token } : null;
  }

  function issueGuest() {
    const profileId = `p_${randomUUID()}`;
    const token = randomBytes(TOKEN_BYTES).toString('base64url');
    let code = randomCode();
    for (let i = 0; i < 8 && store.findByCodeHash(hash(code)); i++) code = randomCode();
    store.createProfile({ profileId, tokenHash: hash(token), codeHash: hash(code) });
    if (log) log.info('shanhai guest created', { profileId });
    return { profileId, token, transferCode: code };
  }

  async function handleGuest(req, res, ip) {
    const body = await readJson(req);
    const rawCode = body.transferCode == null ? '' : String(body.transferCode).trim().toUpperCase();
    if (!rawCode) {
      if (!guestLimiter(ip)) return fail(res, 429, 'RATE_LIMITED', '创建档案过于频繁，请稍后再试');
      const created = issueGuest();
      return send(res, 201, { profileId: created.profileId, token: created.token, transferCode: created.transferCode, rev: 0 });
    }
    if (!transferLimiter(ip)) return fail(res, 429, 'RATE_LIMITED', '尝试次数过多，请稍后再试');
    if (rawCode.length !== CODE_LENGTH || !/^[A-Z0-9]+$/.test(rawCode)) {
      return fail(res, 404, 'TRANSFER_CODE_INVALID', '转移码无效');
    }
    const profile = store.findByCodeHash(hash(rawCode));
    if (!profile) return fail(res, 404, 'TRANSFER_CODE_INVALID', '转移码无效');
    const token = randomBytes(TOKEN_BYTES).toString('base64url');
    store.rotateToken(profile.id, hash(token));
    if (log) log.info('shanhai guest transferred', { profileId: profile.id });
    return send(res, 200, {
      profileId: profile.id,
      token,
      transferCode: rawCode,
      rev: Number(profile.save_rev)
    });
  }

  function handleGetSave(req, res) {
    const auth = authenticate(req);
    if (!auth) return fail(res, 401, 'TOKEN_INVALID', '身份令牌无效');
    const saved = store.getSave(auth.profile.id);
    if (!saved) return fail(res, 401, 'TOKEN_INVALID', '身份令牌无效');
    let state = null;
    if (saved.stateJson) {
      try { state = JSON.parse(saved.stateJson); } catch { state = null; }
    }
    return send(res, 200, { rev: saved.rev, updatedAt: saved.updatedAt, state });
  }

  async function handlePutSave(req, res) {
    const auth = authenticate(req);
    if (!auth) return fail(res, 401, 'TOKEN_INVALID', '身份令牌无效');
    const body = await readJson(req);
    const baseRev = Number(body.rev);
    if (!Number.isInteger(baseRev) || baseRev < 0) {
      return fail(res, 422, 'INVALID_SAVE', 'rev 必须是非负整数');
    }
    let rawState = body.state;
    let rawJson;
    try {
      rawJson = JSON.stringify(rawState);
    } catch {
      return fail(res, 422, 'INVALID_SAVE', '存档无法序列化');
    }
    if (rawJson === undefined) return fail(res, 422, 'INVALID_SAVE', '缺少存档内容');
    if (Buffer.byteLength(rawJson) > SAVE_MAX_BYTES) {
      return fail(res, 413, 'PAYLOAD_TOO_LARGE', '存档超过 1MB 上限');
    }
    let normalized;
    try {
      normalized = schema.normalizeState(rawState, { strict: true });
    } catch (err) {
      return fail(res, 422, 'INVALID_SAVE', err.message || '存档结构不正确');
    }
    const stateJson = JSON.stringify(normalized);
    if (Buffer.byteLength(stateJson) > SAVE_MAX_BYTES) {
      return fail(res, 413, 'PAYLOAD_TOO_LARGE', '存档超过 1MB 上限');
    }
    const result = store.putSave(auth.profile.id, baseRev, stateJson);
    if (!result.ok) {
      if (log) log.warn('shanhai save conflict', { profileId: auth.profile.id, baseRev, currentRev: result.rev });
      return fail(res, 409, 'REV_CONFLICT', '云端存档已被更新', { rev: result.rev, updatedAt: result.updatedAt });
    }
    return send(res, 200, { rev: result.rev, updatedAt: result.updatedAt });
  }

  async function handleEvents(req, res) {
    const auth = authenticate(req);
    if (!auth) return fail(res, 401, 'TOKEN_INVALID', '身份令牌无效');
    const body = await readJson(req);
    if (!Array.isArray(body.events)) return fail(res, 400, 'INVALID_EVENTS', 'events 必须是数组');
    if (body.events.length > EVENTS_MAX) return fail(res, 413, 'PAYLOAD_TOO_LARGE', '单批埋点不能超过 100 条');
    const events = [];
    for (const raw of body.events) {
      if (!raw || typeof raw !== 'object') return fail(res, 400, 'INVALID_EVENTS', '埋点条目必须是对象');
      const name = typeof raw.name === 'string' ? raw.name.trim() : '';
      if (!name || name.length > EVENT_NAME_MAX) return fail(res, 400, 'INVALID_EVENTS', '埋点名称不合法');
      let propsJson = null;
      if (raw.props != null) {
        if (typeof raw.props !== 'object' || Array.isArray(raw.props)) {
          return fail(res, 400, 'INVALID_EVENTS', '埋点属性必须是对象');
        }
        propsJson = JSON.stringify(raw.props);
        if (Buffer.byteLength(propsJson) > PROPS_MAX_BYTES) {
          return fail(res, 400, 'INVALID_EVENTS', '埋点属性过大');
        }
      }
      const ts = Number.isFinite(Number(raw.ts)) ? Math.floor(Number(raw.ts)) : null;
      events.push({ name, propsJson, ts });
    }
    store.insertEvents(auth.profile.id, events);
    store.touch(auth.profile.id);
    return send(res, 204);
  }

  async function handle(req, res) {
    let pathname;
    try {
      pathname = new URL(req.url, 'http://localhost').pathname;
    } catch {
      return fail(res, 400, 'INVALID_REQUEST', '非法请求地址');
    }
    if (req.method === 'OPTIONS') return send(res, 204);
    const ip = (req.socket && req.socket.remoteAddress) || 'unknown';

    try {
      if (req.method === 'POST' && pathname === '/api/shanhai/guest') return await handleGuest(req, res, ip);
      if (req.method === 'GET' && pathname === '/api/shanhai/time') return send(res, 200, { now: now() });
      if (req.method === 'GET' && pathname === '/api/shanhai/save') return handleGetSave(req, res);
      if (req.method === 'PUT' && pathname === '/api/shanhai/save') return await handlePutSave(req, res);
      if (req.method === 'POST' && pathname === '/api/shanhai/events') return await handleEvents(req, res);
      return fail(res, 404, 'NOT_FOUND', '接口不存在');
    } catch (err) {
      if (err && err.code === 'PAYLOAD_TOO_LARGE') return fail(res, 413, 'PAYLOAD_TOO_LARGE', '请求体过大');
      if (err && err.code === 'INVALID_JSON') return fail(res, 400, 'INVALID_JSON', err.message);
      if (log) log.error('shanhai request failed', { pathname, error: err && err.message });
      return fail(res, 500, 'INTERNAL', '服务内部错误');
    }
  }

  return { handle, limits: { SAVE_MAX_BYTES, BODY_MAX_BYTES, EVENTS_MAX } };
}
