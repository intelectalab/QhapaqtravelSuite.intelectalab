import * as SQLite from "expo-sqlite";

export type Db = SQLite.SQLiteDatabase;

const MIGRATIONS: readonly string[] = [
  `
  CREATE TABLE IF NOT EXISTS outbox (
    client_action_id TEXT PRIMARY KEY NOT NULL,
    type TEXT NOT NULL,
    assignment_id TEXT NOT NULL,
    coalesce_key TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    occurred_at TEXT NOT NULL,
    offline INTEGER NOT NULL DEFAULT 0,
    state TEXT NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','syncing','synced','failed','conflict')),
    attempts INTEGER NOT NULL DEFAULT 0,
    next_attempt_at TEXT,
    last_error TEXT,
    conflict_message TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );
  CREATE INDEX IF NOT EXISTS ix_outbox_state_next ON outbox (state, next_attempt_at, occurred_at);
  CREATE INDEX IF NOT EXISTS ix_outbox_coalesce ON outbox (coalesce_key, state);
  CREATE TABLE IF NOT EXISTS sync_history (
    client_action_id TEXT PRIMARY KEY NOT NULL,
    type TEXT NOT NULL,
    synced_at TEXT NOT NULL,
    resolved INTEGER NOT NULL DEFAULT 0,
    conflict_message TEXT
  );
  CREATE TABLE IF NOT EXISTS sync_state (key TEXT PRIMARY KEY NOT NULL, value TEXT);
  `,
  `
  CREATE TABLE IF NOT EXISTS assignments (
    id TEXT PRIMARY KEY NOT NULL,
    service_date TEXT NOT NULL,
    json TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS ix_assignments_date ON assignments (service_date);
  CREATE TABLE IF NOT EXISTS evidences (
    id TEXT PRIMARY KEY NOT NULL,
    assignment_id TEXT NOT NULL,
    local_uri TEXT NOT NULL,
    file_name TEXT NOT NULL,
    mime TEXT NOT NULL,
    size INTEGER NOT NULL,
    sha256 TEXT NOT NULL,
    upload_id TEXT,
    state TEXT NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','uploaded','failed')),
    last_error TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );
  `,
  `
  ALTER TABLE evidences ADD COLUMN incident_action_id TEXT;
  CREATE INDEX IF NOT EXISTS ix_evidences_incident ON evidences (incident_action_id, state);
  `,
];

let dbPromise: Promise<Db> | null = null;

export function getDb(): Promise<Db> {
  dbPromise ??= (async () => {
    const db = await SQLite.openDatabaseAsync("kipucontrol-ops.db");
    await db.execAsync("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
    const row = await db.getFirstAsync<{ user_version: number }>("PRAGMA user_version");
    const current = row?.user_version ?? 0;
    for (let version = current; version < MIGRATIONS.length; version++) {
      await db.withTransactionAsync(async () => {
        await db.execAsync(MIGRATIONS[version]!);
        await db.execAsync(`PRAGMA user_version = ${version + 1}`);
      });
    }
    return db;
  })();
  return dbPromise;
}

export async function getState(key: string): Promise<string | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string | null }>("SELECT value FROM sync_state WHERE key = ?", [key]);
  return row?.value ?? null;
}

export async function setState(key: string, value: string): Promise<void> {
  const db = await getDb();
  await db.runAsync("INSERT INTO sync_state (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", [key, value]);
}

export async function clearLocalData(): Promise<void> {
  const db = await getDb();
  await db.execAsync("DELETE FROM outbox; DELETE FROM sync_history; DELETE FROM sync_state; DELETE FROM assignments; DELETE FROM evidences;");
}
