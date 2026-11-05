/**
 * Outbox offline de la App del operador (spec 05 §8.4.3; CLAUDE.md mobile).
 *
 * Flujo: la UI valida precondiciones de UX → `enqueue()` aplica el cambio local y guarda la acción en `outbox`
 * en UNA transacción SQLite → `SyncEngine` la envía cuando hay red.
 *
 * Estados: pending → syncing → synced | failed | conflict
 *   - pending: esperando red o su turno (next_attempt_at).
 *   - syncing: enviada, esperando respuesta (si la app muere aquí, al reiniciar vuelve a pending: el servidor es
 *     idempotente por client_action_id, reenviar es seguro).
 *   - synced: aplicada (o `duplicate`: ya estaba aplicada).
 *   - conflict: el servidor resolvió un conflicto con sus reglas (MOB-BR-05…11) y devolvió qué cambió;
 *     se muestra al usuario y luego pasa a synced «· resuelto».
 *   - failed: rechazada (`rejected`) o agotó reintentos; se revierte el estado local y se ofrece «Reintentar».
 *
 * Coalescencia: para `confirm` y `checkin`, una acción pending con la misma coalesce_key se REEMPLAZA (no se
 * acumulan toques repetidos sin red).
 */
import { getDb } from "./db";

export type ActionType = "confirm" | "start" | "checkin" | "checkin_undo" | "checkin_all" | "evidence" | "incident" | "finish";
export type OutboxState = "pending" | "syncing" | "synced" | "failed" | "conflict";

export type OutboxAction = {
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
};

const COALESCE_TYPES: ReadonlySet<ActionType> = new Set(["confirm", "checkin"]);

/** UUID v7 (RFC 9562): ordenable por tiempo, igual que las PK del servidor. En React Native, `crypto.getRandomValues`
 * requiere `expo-crypto` (o `react-native-get-random-values`) importado una vez en el punto de entrada. */
export function uuidv7(): string {
  const ts = Date.now();
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  for (let i = 0; i < 6; i++) bytes[i] = Math.floor(ts / 2 ** (8 * (5 - i))) & 0xff;
  bytes[6] = (bytes[6]! & 0x0f) | 0x70;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const h = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export function coalesceKey(type: ActionType, assignmentId: string, payload: Record<string, unknown>): string {
  const pax = typeof payload.passenger_id === "string" ? `:${payload.passenger_id}` : "";
  return `${type === "checkin_undo" ? "checkin" : type}:${assignmentId}${pax}`;
}

/**
 * Encola una acción y aplica su efecto local en la MISMA transacción.
 * @param applyLocal cambio optimista en las tablas de caché (p. ej. marcar el check-in); recibe la conexión.
 */
export async function enqueue(
  type: ActionType,
  assignmentId: string,
  payload: Record<string, unknown>,
  isOnline: boolean,
  applyLocal?: (db: Awaited<ReturnType<typeof getDb>>) => Promise<void>,
): Promise<string> {
  const db = await getDb();
  const id = uuidv7();
  const key = coalesceKey(type, assignmentId, payload);

  await db.withTransactionAsync(async () => {
    if (COALESCE_TYPES.has(type) || type === "checkin_undo") {
      await db.runAsync("DELETE FROM outbox WHERE coalesce_key = ? AND state = 'pending'", [key]);
    }
    await db.runAsync(
      `INSERT INTO outbox (client_action_id, type, assignment_id, coalesce_key, payload_json, occurred_at, offline, state)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [id, type, assignmentId, key, JSON.stringify(payload), new Date().toISOString(), isOnline ? 0 : 1],
    );
    if (applyLocal) await applyLocal(db);
  });
  return id;
}

/** Acciones listas para enviar, en orden causal (occurred_at), máx. `limit` (el lote del servidor admite 50). */
export async function due(limit = 50): Promise<OutboxAction[]> {
  const db = await getDb();
  return db.getAllAsync<OutboxAction>(
    `SELECT * FROM outbox
      WHERE state = 'pending' AND (next_attempt_at IS NULL OR next_attempt_at <= ?)
      ORDER BY occurred_at, client_action_id LIMIT ?`,
    [new Date().toISOString(), limit],
  );
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
    await db.runAsync(
      "INSERT OR REPLACE INTO sync_history (client_action_id, type, synced_at, resolved, conflict_message) VALUES (?, ?, ?, ?, ?)",
      [id, row?.type ?? "?", new Date().toISOString(), resolvedConflict ? 1 : 0, resolvedConflict],
    );
    await db.runAsync("DELETE FROM outbox WHERE client_action_id = ?", [id]);
    // Historial: solo las últimas 30 (spec 05 §8.4.2)
    await db.runAsync("DELETE FROM sync_history WHERE client_action_id NOT IN (SELECT client_action_id FROM sync_history ORDER BY synced_at DESC LIMIT 30)");
  });
}

export async function markConflict(id: string, message: string): Promise<void> {
  const db = await getDb();
  await db.runAsync("UPDATE outbox SET state = 'conflict', conflict_message = ? WHERE client_action_id = ?", [message, id]);
}

export async function markRetry(id: string, error: string, nextAttemptAt: Date): Promise<void> {
  const db = await getDb();
  await db.runAsync("UPDATE outbox SET state = 'pending', last_error = ?, next_attempt_at = ? WHERE client_action_id = ?", [
    error,
    nextAttemptAt.toISOString(),
    id,
  ]);
}

export async function markFailed(id: string, error: string): Promise<void> {
  const db = await getDb();
  await db.runAsync("UPDATE outbox SET state = 'failed', last_error = ? WHERE client_action_id = ?", [error, id]);
}

/** Botón «Reintentar» de una acción fallida (misma client_action_id ⇒ el servidor no duplica). */
export async function retryFailed(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync("UPDATE outbox SET state = 'pending', attempts = 0, next_attempt_at = NULL WHERE client_action_id = ? AND state = 'failed'", [id]);
}

/** El usuario vio el aviso de conflicto: pasa a synced «· resuelto». */
export async function acknowledgeConflict(id: string): Promise<void> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ conflict_message: string | null }>("SELECT conflict_message FROM outbox WHERE client_action_id = ?", [id]);
  await markSynced(id, row?.conflict_message ?? "resuelto");
}

/** Al arrancar la app: lo que quedó en `syncing` (app cerrada a mitad del envío) vuelve a `pending`. */
export async function recoverInterrupted(): Promise<void> {
  const db = await getDb();
  await db.runAsync("UPDATE outbox SET state = 'pending' WHERE state = 'syncing'");
}

export async function counts(): Promise<Record<OutboxState, number>> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ state: OutboxState; n: number }>("SELECT state, COUNT(*) AS n FROM outbox GROUP BY state");
  const base: Record<OutboxState, number> = { pending: 0, syncing: 0, synced: 0, failed: 0, conflict: 0 };
  for (const r of rows) base[r.state] = r.n;
  return base;
}
