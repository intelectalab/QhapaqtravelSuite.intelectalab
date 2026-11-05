/**
 * Base local SQLite de la App del operador (spec 05 §8.4.2) con expo-sqlite (API asíncrona, SDK 52+).
 *
 * Tablas de sincronización incluidas aquí: `outbox`, `sync_history`, `sync_state`. Las de caché de lectura
 * (`assignments`, `passengers`, `checkins`, `evidences`, `incidents`) siguen el mismo patrón de migraciones.
 * - WAL para escrituras concurrentes (UI + sincronización en segundo plano).
 * - Migraciones versionadas con `PRAGMA user_version` (nunca borrar la base del usuario en una actualización:
 *   podría tener acciones sin sincronizar).
 * - Datos personales mínimos y ventana [-2 d, +14 d]; purga 7 días después del servicio (spec 05 §12-13).
 */
import * as SQLite from "expo-sqlite";

export type Db = SQLite.SQLiteDatabase;

const MIGRATIONS: readonly string[] = [
  // v1 — outbox y estado de sincronización
  `
  CREATE TABLE IF NOT EXISTS outbox (
    client_action_id TEXT PRIMARY KEY NOT NULL,         -- UUID v7 generado en el dispositivo = ops_sync_actions.id
    type TEXT NOT NULL,                                 -- confirm | start | checkin | checkin_undo | checkin_all | evidence | incident | finish
    assignment_id TEXT NOT NULL,
    coalesce_key TEXT NOT NULL,                         -- p. ej. "checkin:{assignment}:{passenger}"
    payload_json TEXT NOT NULL,
    occurred_at TEXT NOT NULL,                          -- ISO 8601 del hecho en campo (el servidor lo respeta)
    offline INTEGER NOT NULL DEFAULT 0,
    state TEXT NOT NULL DEFAULT 'pending'
      CHECK (state IN ('pending','syncing','synced','failed','conflict')),
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
];

let dbPromise: Promise<Db> | null = null;

export function getDb(): Promise<Db> {
  dbPromise ??= (async () => {
    const db = await SQLite.openDatabaseAsync("qhapaq-ops.db");
    await db.execAsync("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
    const row = await db.getFirstAsync<{ user_version: number }>("PRAGMA user_version");
    const current = row?.user_version ?? 0;
    for (let v = current; v < MIGRATIONS.length; v++) {
      await db.withTransactionAsync(async () => {
        await db.execAsync(MIGRATIONS[v]!);
        await db.execAsync(`PRAGMA user_version = ${v + 1}`);
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
