import { getRandomValues } from "expo-crypto";
import { getDb, type Db } from "./db";

export type ActionType = "confirm" | "start" | "checkin" | "checkin_undo" | "checkin_all" | "evidence" | "incident" | "finish";
export type OutboxState = "pending" | "syncing" | "synced" | "failed" | "conflict";

export interface OutboxAction {
  client_action_id: string;
  type: ActionType;
  assignment_id: string;
  coalesce_key: string;
  payload_json: string;
  occurred_at: string;
  offline: number;
  state: OutboxState;
  attempts: number;
  next_attempt_at: string | null;
  last_error: string | null;
  conflict_message: string | null;
}

export interface SyncedAction {
  client_action_id: string;
  type: string;
  synced_at: string;
  resolved: number;
  conflict_message: string | null;
}

const COALESCE_TYPES: ReadonlySet<ActionType> = new Set(["confirm", "checkin", "checkin_undo"]);

export function uuidv7(now: number = Date.now(), random: (bytes: Uint8Array) => Uint8Array = getRandomValues): string {
  const bytes = random(new Uint8Array(16));
  for (let index = 0; index < 6; index++) bytes[index] = Math.floor(now / 2 ** (8 * (5 - index))) & 0xff;
  bytes[6] = (bytes[6]! & 0x0f) | 0x70;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function coalesceKey(type: ActionType, assignmentId: string, payload: Record<string, unknown>): string {
  const passenger = typeof payload.passenger_id === "string" ? `:${payload.passenger_id}` : "";
  return `${type === "checkin_undo" ? "checkin" : type}:${assignmentId}${passenger}`;
}

export async function enqueue(type: ActionType, assignmentId: string, payload: Record<string, unknown>, isOnline: boolean, applyLocal?: (db: Db, actionId: string) => Promise<void>): Promise<string> {
  const db = await getDb();
  const id = uuidv7();
  const key = coalesceKey(type, assignmentId, payload);

  await db.withTransactionAsync(async () => {
    if (COALESCE_TYPES.has(type)) await db.runAsync("DELETE FROM outbox WHERE coalesce_key = ? AND state = 'pending'", [key]);
    await db.runAsync(
      `INSERT INTO outbox (client_action_id, type, assignment_id, coalesce_key, payload_json, occurred_at, offline, state)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [id, type, assignmentId, key, JSON.stringify(payload), new Date().toISOString(), isOnline ? 0 : 1],
    );
    if (applyLocal) await applyLocal(db, id);
  });
  return id;
}

export async function due(limit = 50): Promise<OutboxAction[]> {
  const db = await getDb();
  return db.getAllAsync<OutboxAction>(
    `SELECT * FROM outbox WHERE state = 'pending' AND (next_attempt_at IS NULL OR next_attempt_at <= ?)
      AND NOT EXISTS (SELECT 1 FROM evidences e WHERE e.incident_action_id = outbox.client_action_id AND e.state = 'pending')
      ORDER BY occurred_at, client_action_id LIMIT ?`,
    [new Date().toISOString(), limit],
  );
}

export async function list(): Promise<OutboxAction[]> {
  const db = await getDb();
  return db.getAllAsync<OutboxAction>("SELECT * FROM outbox ORDER BY occurred_at DESC");
}

export async function history(limit = 6): Promise<SyncedAction[]> {
  const db = await getDb();
  return db.getAllAsync<SyncedAction>("SELECT * FROM sync_history ORDER BY synced_at DESC LIMIT ?", [limit]);
}

export async function markSyncing(ids: readonly string[]): Promise<void> {
  if (ids.length === 0) return;
  const db = await getDb();
  await db.runAsync(`UPDATE outbox SET state = 'syncing', attempts = attempts + 1 WHERE client_action_id IN (${ids.map(() => "?").join(",")})`, [...ids]);
}

export async function markSynced(id: string, resolvedConflict: string | null = null): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    const row = await db.getFirstAsync<{ type: string }>("SELECT type FROM outbox WHERE client_action_id = ?", [id]);
    await db.runAsync("INSERT OR REPLACE INTO sync_history (client_action_id, type, synced_at, resolved, conflict_message) VALUES (?, ?, ?, ?, ?)", [
      id,
      row?.type ?? "?",
      new Date().toISOString(),
      resolvedConflict ? 1 : 0,
      resolvedConflict,
    ]);
    await db.runAsync("DELETE FROM outbox WHERE client_action_id = ?", [id]);
    await db.runAsync("DELETE FROM sync_history WHERE client_action_id NOT IN (SELECT client_action_id FROM sync_history ORDER BY synced_at DESC LIMIT 30)");
  });
}

export async function markConflict(id: string, message: string): Promise<void> {
  const db = await getDb();
  await db.runAsync("UPDATE outbox SET state = 'conflict', conflict_message = ? WHERE client_action_id = ?", [message, id]);
}

export async function markRetry(id: string, error: string, nextAttemptAt: Date): Promise<void> {
  const db = await getDb();
  await db.runAsync("UPDATE outbox SET state = 'pending', last_error = ?, next_attempt_at = ? WHERE client_action_id = ?", [error, nextAttemptAt.toISOString(), id]);
}

export async function markFailed(id: string, error: string): Promise<void> {
  const db = await getDb();
  await db.runAsync("UPDATE outbox SET state = 'failed', last_error = ? WHERE client_action_id = ?", [error, id]);
}

export async function retryFailed(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync("UPDATE outbox SET state = 'pending', attempts = 0, next_attempt_at = NULL WHERE client_action_id = ? AND state = 'failed'", [id]);
}

export async function acknowledgeConflict(id: string): Promise<void> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ conflict_message: string | null }>("SELECT conflict_message FROM outbox WHERE client_action_id = ?", [id]);
  await markSynced(id, row?.conflict_message ?? "resuelto");
}

export async function recoverInterrupted(): Promise<void> {
  const db = await getDb();
  await db.runAsync("UPDATE outbox SET state = 'pending' WHERE state = 'syncing'");
}

export async function counts(): Promise<Record<OutboxState, number>> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ state: OutboxState; n: number }>("SELECT state, COUNT(*) AS n FROM outbox GROUP BY state");
  const base: Record<OutboxState, number> = { pending: 0, syncing: 0, synced: 0, failed: 0, conflict: 0 };
  for (const row of rows) base[row.state] = row.n;
  return base;
}
