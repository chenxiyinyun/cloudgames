import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { createStore } from '../shanhai/store.js';
import { createShanhaiHttp } from '../shanhai/http.js';

const sha256 = (v) => createHash('sha256').update(String(v)).digest('hex');
const TOKEN_ALPHABET = /^[A-Z0-9]{6}$/;

let dir;
let clock;
let store;
let http;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'shanhai-'));
  clock = 1_760_000_000_000;
  store = createStore({ file: join(dir, 'test.sqlite'), now: () => clock });
  http = createShanhaiHttp({ store, now: () => clock });
});

afterEach(() => {
  store.close();
  rmSync(dir, { recursive: true, force: true });
});

/** 用最小 req/res 桩直接调用 http 处理器 */
async function call({ method, path, body, token, ip = '127.0.0.1' }) {
  const chunks = body === undefined ? [] : [Buffer.from(typeof body === 'string' ? body : JSON.stringify(body))];
  const headers = {};
  if (token) headers.authorization = `Bearer ${token}`;
  const req = {
    method,
    url: path,
    headers,
    socket: { remoteAddress: ip },
    async *[Symbol.asyncIterator]() {
      for (const chunk of chunks) yield chunk;
    }
  };
  const res = {
    status: 0,
    headers: {},
    text: '',
    writeHead(status, headersOut) { this.status = status; this.headers = headersOut || {}; },
    end(chunk) { if (chunk) this.text += chunk; }
  };
  await http.handle(req, res);
  return { status: res.status, headers: res.headers, body: res.text ? JSON.parse(res.text) : null };
}

async function createGuest() {
  const res = await call({ method: 'POST', path: '/api/shanhai/guest', body: {} });
  expect(res.status).toBe(201);
  return res.body;
}

const saveBody = (rev, extra) => ({
  rev,
  state: { beasts: { baize: {} }, ...(extra || {}) }
});

describe('山海来信云存档接口', () => {
  it('游客登记只返回一次令牌，库里只存哈希', async () => {
    const guest = await createGuest();
    expect(guest.token).toHaveLength(43);
    expect(guest.transferCode).toMatch(TOKEN_ALPHABET);
    expect(guest.rev).toBe(0);

    const row = store.findByTokenHash(sha256(guest.token));
    expect(row).toBeTruthy();
    expect(JSON.stringify(row)).not.toContain(guest.token);
    expect(JSON.stringify(row)).not.toContain(guest.transferCode);
    expect(store.findByCodeHash(sha256(guest.transferCode)).id).toBe(guest.profileId);
  });

  it('转移码可换发新令牌，旧令牌立即失效', async () => {
    const guest = await createGuest();
    const transferred = await call({
      method: 'POST',
      path: '/api/shanhai/guest',
      body: { transferCode: guest.transferCode.toLowerCase() }
    });
    expect(transferred.status).toBe(200);
    expect(transferred.body.profileId).toBe(guest.profileId);
    expect(transferred.body.token).not.toBe(guest.token);
    expect(transferred.body.transferCode).toBe(guest.transferCode);

    const old = await call({ method: 'GET', path: '/api/shanhai/save', token: guest.token });
    expect(old.status).toBe(401);
    const fresh = await call({ method: 'GET', path: '/api/shanhai/save', token: transferred.body.token });
    expect(fresh.status).toBe(200);
  });

  it('转移码错误返回 404 且不限流泄漏信息', async () => {
    const res = await call({ method: 'POST', path: '/api/shanhai/guest', body: { transferCode: 'ZZZZZZ' } });
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('TRANSFER_CODE_INVALID');
  });

  it('rev 乐观锁：过期 rev 返回 409 与当前版本，旧内容不被覆盖', async () => {
    const guest = await createGuest();
    const first = await call({ method: 'PUT', path: '/api/shanhai/save', token: guest.token, body: saveBody(0, { worldFlags: { a: true } }) });
    expect(first.status).toBe(200);
    expect(first.body.rev).toBe(1);

    const conflict = await call({ method: 'PUT', path: '/api/shanhai/save', token: guest.token, body: saveBody(0, { worldFlags: { b: true } }) });
    expect(conflict.status).toBe(409);
    expect(conflict.body.code).toBe('REV_CONFLICT');
    expect(conflict.body.rev).toBe(1);
    expect(conflict.body.state).toBeUndefined();

    const current = await call({ method: 'GET', path: '/api/shanhai/save', token: guest.token });
    expect(current.body.rev).toBe(1);
    expect(current.body.state.worldFlags).toEqual({ a: true });

    const retry = await call({ method: 'PUT', path: '/api/shanhai/save', token: guest.token, body: saveBody(1, { worldFlags: { b: true } }) });
    expect(retry.status).toBe(200);
    expect(retry.body.rev).toBe(2);
    expect(store.stats()).toEqual({ profiles: 1, savePutTotal: 2, saveConflictTotal: 1 });
  });

  it('令牌失效统一返回 401', async () => {
    const missing = await call({ method: 'GET', path: '/api/shanhai/save' });
    expect(missing.status).toBe(401);
    expect(missing.body.code).toBe('TOKEN_INVALID');

    const expired = await call({ method: 'PUT', path: '/api/shanhai/save', token: 'x'.repeat(43), body: saveBody(0) });
    expect(expired.status).toBe(401);
  });

  it('超大存档返回 413，非法形状返回 422', async () => {
    const guest = await createGuest();
    const huge = await call({
      method: 'PUT',
      path: '/api/shanhai/save',
      token: guest.token,
      body: { rev: 0, state: { beasts: { baize: {} }, letters: [{ id: 'x', body: 'a'.repeat(1_100_000) }] } }
    });
    expect(huge.status).toBe(413);
    expect(huge.body.code).toBe('PAYLOAD_TOO_LARGE');

    const invalid = await call({ method: 'PUT', path: '/api/shanhai/save', token: guest.token, body: { rev: 0, state: {} } });
    expect(invalid.status).toBe(422);
    expect(invalid.body.code).toBe('INVALID_SAVE');

    const badRev = await call({ method: 'PUT', path: '/api/shanhai/save', token: guest.token, body: saveBody(-1) });
    expect(badRev.status).toBe(422);
  });

  it('授时接口返回服务端时间且不需要鉴权', async () => {
    clock += 1234;
    const res = await call({ method: 'GET', path: '/api/shanhai/time' });
    expect(res.status).toBe(200);
    expect(res.body.now).toBe(clock);
  });

  it('埋点批量上报成功返回 204，非法条目被拒绝', async () => {
    const guest = await createGuest();
    const ok = await call({
      method: 'POST',
      path: '/api/shanhai/events',
      token: guest.token,
      body: { events: [{ name: 'trip_start', props: { beastId: 'baize' }, ts: 1 }, { name: 'reply' }] }
    });
    expect(ok.status).toBe(204);

    const badName = await call({
      method: 'POST',
      path: '/api/shanhai/events',
      token: guest.token,
      body: { events: [{ name: 'x'.repeat(33) }] }
    });
    expect(badName.status).toBe(400);

    const tooMany = await call({
      method: 'POST',
      path: '/api/shanhai/events',
      token: guest.token,
      body: { events: new Array(101).fill({ name: 'a' }) }
    });
    expect(tooMany.status).toBe(413);
  });

  it('游客登记按 IP 限流，OPTIONS 预检带 CORS 头', async () => {
    const preflight = await call({ method: 'OPTIONS', path: '/api/shanhai/save' });
    expect(preflight.status).toBe(204);
    expect(preflight.headers['Access-Control-Allow-Methods']).toContain('PUT');

    let last = null;
    for (let i = 0; i < 11; i++) {
      last = await call({ method: 'POST', path: '/api/shanhai/guest', body: {}, ip: '10.0.0.9' });
    }
    expect(last.status).toBe(429);
  });
});
