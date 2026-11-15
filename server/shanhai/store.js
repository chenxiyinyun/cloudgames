/**
 * 《山海来信》云存档存储层（SQLite，Node 内置 node:sqlite）。
 *
 * 只存「匿名档案 + 整包存档 + 埋点」三类数据，不做游戏规则。
 * 换驱动（如 better-sqlite3）只改本文件，http 层不感知。
 */
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS profiles (
  id              TEXT PRIMARY KEY,
  token_hash      TEXT NOT NULL UNIQUE,
  code_hash       TEXT NOT NULL UNIQUE,
  created_at      INTEGER NOT NULL,
  last_seen_at    INTEGER NOT NULL,
  save_rev        INTEGER NOT NULL DEFAULT 0,
  save_json       TEXT,
  save_bytes      INTEGER NOT NULL DEFAULT 0,
  save_updated_at INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_profiles_last_seen ON profiles(last_seen_at);

CREATE TABLE IF NOT EXISTS anon_events (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_id  TEXT,
  name        TEXT NOT NULL,
  props_json  TEXT,
  client_ts   INTEGER,
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_events_created ON anon_events(created_at);
`;

export function createStore({ file, now = () => Date.now() } = {}) {
  if (!file) throw new Error('缺少 SQLite 文件路径');

  if (file !== ':memory:') mkdirSync(dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA synchronous = NORMAL');
  db.exec(SCHEMA);

  const stmts = {
    insertProfile: db.prepare(
      'INSERT INTO profiles (id, token_hash, code_hash, created_at, last_seen_at) VALUES (?, ?, ?, ?, ?)'
    ),
    byToken: db.prepare('SELECT * FROM profiles WHERE token_hash = ?'),
    byCode: db.prepare('SELECT * FROM profiles WHERE code_hash = ?'),
    rotToken: db.prepare('UPDATE profiles SET token_hash = ?, last_seen_at = ? WHERE id = ?'),
    touch: db.prepare('UPDATE profiles SET last_seen_at = ? WHERE id = ?'),
    getSave: db.prepare('SELECT save_rev, save_json, save_updated_at FROM profiles WHERE id = ?'),
    putSave: db.prepare(
      `UPDATE profiles
          SET save_json = ?, save_rev = save_rev + 1, save_updated_at = ?, last_seen_at = ?, save_bytes = ?
        WHERE id = ? AND save_rev = ?`
    ),
    countProfiles: db.prepare('SELECT COUNT(*) AS n FROM profiles'),
    insertEvent: db.prepare(
      'INSERT INTO anon_events (profile_id, name, props_json, client_ts, created_at) VALUES (?, ?, ?, ?, ?)'
    )
  };

  const counters = { savePutTotal: 0, saveConflictTotal: 0 };

  return {
    createProfile({ profileId, tokenHash, codeHash }) {
      const t = now();
      stmts.insertProfile.run(profileId, tokenHash, codeHash, t, t);
      return { profileId, rev: 0, createdAt: t };
    },

    findByTokenHash(tokenHash) {
      return stmts.byToken.get(tokenHash) || null;
    },

    findByCodeHash(codeHash) {
      return stmts.byCode.get(codeHash) || null;
    },

    rotateToken(profileId, tokenHash) {
      stmts.rotToken.run(tokenHash, now(), profileId);
    },

    getSave(profileId) {
      const row = stmts.getSave.get(profileId);
      if (!row) return null;
      return {
        rev: Number(row.save_rev),
        stateJson: row.save_json == null ? null : String(row.save_json),
        updatedAt: Number(row.save_updated_at)
      };
    },

    /** 乐观锁写入：rev 不匹配返回当前 rev，不覆盖别人刚写的内容 */
    putSave(profileId, baseRev, stateJson) {
      const t = now();
      const result = stmts.putSave.run(stateJson, t, t, Buffer.byteLength(stateJson), profileId, baseRev);
      if (Number(result.changes) === 1) {
        counters.savePutTotal += 1;
        return { ok: true, rev: baseRev + 1, updatedAt: t };
      }
      counters.saveConflictTotal += 1;
      const cur = stmts.getSave.get(profileId);
      return { ok: false, rev: cur ? Number(cur.save_rev) : baseRev, updatedAt: cur ? Number(cur.save_updated_at) : 0 };
    },

    touch(profileId) {
      stmts.touch.run(now(), profileId);
    },

    insertEvents(profileId, events) {
      const t = now();
      db.exec('BEGIN');
      try {
        events.forEach((ev) => {
          stmts.insertEvent.run(profileId, ev.name, ev.propsJson, ev.ts, t);
        });
        db.exec('COMMIT');
      } catch (err) {
        db.exec('ROLLBACK');
        throw err;
      }
      return events.length;
    },

    countProfiles() {
      return Number(stmts.countProfiles.get().n);
    },

    stats() {
      return {
        profiles: this.countProfiles(),
        savePutTotal: counters.savePutTotal,
        saveConflictTotal: counters.saveConflictTotal
      };
    },

    close() {
      try { db.close(); } catch { /* ignore */ }
    }
  };
}
