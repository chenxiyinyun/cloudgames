import { describe, it, expect } from 'vitest';
import '../cloudCore.js';

const CORE = globalThis.SHANHAI_CLOUD_CORE;

describe('云存档纯逻辑', () => {
  it('decideSync：无云档推本地、同版本按脏标记、远端更新走覆盖或冲突', () => {
    expect(CORE.decideSync({ remoteHasState: false, localFresh: true })).toBe('none');
    expect(CORE.decideSync({ remoteHasState: false, localFresh: false })).toBe('push');
    expect(CORE.decideSync({ remoteHasState: true, remoteRev: 3, localRev: 3, localDirty: false })).toBe('none');
    expect(CORE.decideSync({ remoteHasState: true, remoteRev: 3, localRev: 3, localDirty: true })).toBe('push');
    expect(CORE.decideSync({ remoteHasState: true, remoteRev: 4, localRev: 3, localFresh: true })).toBe('pull');
    expect(CORE.decideSync({ remoteHasState: true, remoteRev: 4, localRev: 3, localFresh: false })).toBe('conflict');
    expect(CORE.decideSync({ remoteHasState: true, remoteRev: 2, localRev: 3 })).toBe('conflict');
  });

  it('离线补传：失败保留队列，恢复后按序清空', async () => {
    let offline = true;
    const sent = [];
    const queue = CORE.createEventQueue({
      send: async (batch) => {
        if (offline) throw new Error('offline');
        sent.push(...batch.map((e) => e.name));
      }
    });
    queue.push('trip_start');
    queue.push('letter_reply');
    const failed = await queue.flush();
    expect(failed.ok).toBe(false);
    expect(queue.size()).toBe(2);

    offline = false;
    const done = await queue.flush();
    expect(done.ok).toBe(true);
    expect(done.sent).toBe(2);
    expect(sent).toEqual(['trip_start', 'letter_reply']);
    expect(queue.size()).toBe(0);
  });

  it('队列满时丢最旧，单批最多 100 条', async () => {
    const batches = [];
    const queue = CORE.createEventQueue({
      limit: 3,
      maxBatch: 2,
      send: async (batch) => batches.push(batch.length)
    });
    ['a', 'b', 'c', 'd', 'e'].forEach((name) => queue.push(name));
    expect(queue.peek().map((e) => e.name)).toEqual(['c', 'd', 'e']);
    await queue.flush();
    expect(batches).toEqual([2, 1]);
  });

  it('退避从 2s 起翻倍，封顶 60s', () => {
    expect(CORE.nextBackoff(0)).toBe(4000);
    expect(CORE.nextBackoff(2000)).toBe(4000);
    expect(CORE.nextBackoff(32000)).toBe(60000);
    expect(CORE.nextBackoff(60000)).toBe(60000);
  });

  it('parseMeta 容错：坏 JSON / 短令牌 / 负版本都回落默认值', () => {
    expect(CORE.parseMeta('{oops')).toEqual({ token: '', code: '', profileId: '', rev: 0, dirty: false, lastSyncAt: 0 });
    expect(CORE.parseMeta(JSON.stringify({ token: 'short', rev: -3 })).token).toBe('');
    const ok = CORE.parseMeta(JSON.stringify({ token: 't'.repeat(43), code: '7KQ2X9', rev: 4, dirty: true }));
    expect(ok.token).toHaveLength(43);
    expect(ok.rev).toBe(4);
    expect(ok.dirty).toBe(true);
  });
});
