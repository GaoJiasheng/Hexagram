// 测试专用:用 Node 内置 node:sqlite 模拟 D1 绑定(prepare/bind/first/all/run/batch),
// 让接口测试跑在真实的 schema.sql 上(CHECK / UNIQUE / 外键都生效),而不是手写桩。
// 只给 vitest 用,线上代码不引用。
import { readFileSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'

const ROOT = new URL('../', import.meta.url)

export function readRepoFile(path) {
  return readFileSync(new URL(path, ROOT), 'utf8')
}

const plain = (row) => (row ? { ...row } : null)

// 迁移 0007 之前、即线上现有的 identities 结构:3d71b91 的建表语句 + 0001 的 ALTER ADD COLUMN secret
// (0002–0006 都没碰这张表)。其余表取 schema.sql 现状。只给 0007 的迁移测试用。
const PRODUCTION_IDENTITIES_BEFORE_0007 = `CREATE TABLE identities (
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (
    provider IN ('google', 'email', 'phone', 'wechat')
  ),
  provider_uid TEXT NOT NULL CHECK (length(provider_uid) > 0),
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  PRIMARY KEY (provider, provider_uid),
  UNIQUE (user_id, provider),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
ALTER TABLE identities ADD COLUMN secret TEXT;`

export function schemaBefore0007(current = readRepoFile('schema.sql')) {
  const block = /CREATE TABLE identities \([\s\S]*?\n\);/
  if (!block.test(current)) throw new Error('schema.sql 里找不到 identities 建表语句')
  return current.replace(block, PRODUCTION_IDENTITIES_BEFORE_0007)
}

export function createTestD1(sql = readRepoFile('schema.sql')) {
  const sqlite = new DatabaseSync(':memory:')
  sqlite.exec('PRAGMA foreign_keys = ON;')
  if (sql) sqlite.exec(sql)

  function statement(query, bindings = []) {
    return {
      sql: query,
      bindings,
      bind(...values) {
        return statement(query, values)
      },
      async first() {
        return plain(sqlite.prepare(query).get(...bindings))
      },
      async all() {
        return { results: sqlite.prepare(query).all(...bindings).map(plain), success: true }
      },
      async run() {
        const info = sqlite.prepare(query).run(...bindings)
        return { success: true, meta: { changes: Number(info.changes) } }
      },
      runSync() {
        const info = sqlite.prepare(query).run(...bindings)
        return { success: true, meta: { changes: Number(info.changes) } }
      },
    }
  }

  return {
    sqlite,
    prepare(query) {
      return statement(query)
    },
    async batch(statements) {
      sqlite.exec('BEGIN')
      try {
        const results = statements.map((s) => s.runSync())
        sqlite.exec('COMMIT')
        return results
      } catch (error) {
        sqlite.exec('ROLLBACK')
        throw error
      }
    },
    exec(query) {
      sqlite.exec(query)
    },
  }
}
