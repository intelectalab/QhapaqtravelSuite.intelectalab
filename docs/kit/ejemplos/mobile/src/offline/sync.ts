/**
 * Motor de sincronización del outbox (spec 05 §8.4.3–8.4.4).
 *
 * - Se dispara al recuperar red (NetInfo), al volver a primer plano y por background fetch (≥ 15 min).
 * - Envía en ORDEN (occurred_at) en lotes de hasta 50: POST /api/v1/mobile/operator/sync. Una sola acción
 *   (con red estable) puede ir por POST /api/v1/mobile/operator/actions.
 * - Idempotencia: el servidor usa `client_action_id` como id de `ops_sync_actions` (si existe devuelve la respuesta
 *   guardada). Además se envía `Idempotency-Key` (= client_action_id, o hash del lote) para que el middleware HTTP
 *   también reconozca el reintento.
 * - Resultado por acción: applied | duplicate → synced; conflict_resolved → conflict (mostrar mensaje) y luego
 *   synced «· resuelto»; rejected → failed + revertir estado local + motivo. 409 HTTP = el servidor gana: se
 *   recarga la asignación (bootstrap) y se muestra qué cambió.
 * - Errores de red / 5xx / 429: backoff exponencial con jitter 2 s, 4 s, 8 s… máx. 5 min; tras 8 intentos → failed.
 * - Después de sincronizar: GET /api/v1/mobile/operator/bootstrap?since={cursor} para traer cambios del servidor.
 *
 * SUPUESTO de forma (el contrato publica `ActionBody`/`GenericObject` para /sync):
 *   request  { actions: [{ client_action_id, type, assignment_id, occurred_at, offline, payload }] }
 *   response { data: { results: [{ client_action_id, result, conflict_rule?, message? }] } }
 */
import NetInfo from "@react-native-community/netinfo";
import { due, markConflict, markFailed, markRetry, markSynced, markSyncing, recoverInterrupted, type OutboxAction } from "./outbox";
import { setState } from "./db";

type ActionResult = {
  client_action_id: string;
  result: "applied" | "duplicate" | "conflict_resolved" | "rejected";
  conflict_rule?: string | null;
  message?: string | null;
};

export type SyncDeps = {
  apiUrl: string; // EXPO_PUBLIC_API_URL (infra/env/mobile.env.example), incluye /api/v1
  getToken: () => Promise<string | null>; // expo-secure-store; nunca AsyncStorage para el token
  onRejected: (action: OutboxAction, message: string) => Promise<void>; // revertir estado local
  onConflict: (action: OutboxAction, message: string) => void; // aviso visible al usuario
  refreshFromServer: () => Promise<void>; // bootstrap?since=cursor
};

const MAX_ATTEMPTS = 8;
const BASE_MS = 2_000;
const MAX_MS = 5 * 60_000;

/** 2 s · 2^(n−1) con jitter ±20 %, tope 5 min. */
export function backoffDelay(attempt: number, random: () => number = Math.random): number {
  const raw = Math.min(MAX_MS, BASE_MS * 2 ** Math.max(0, attempt - 1));
  const jitter = raw * 0.2 * (random() * 2 - 1);
  return Math.round(Math.min(MAX_MS, raw + jitter));
}

export class SyncEngine {
  private running = false;
  private unsubscribe: (() => void) | null = null;

  constructor(private readonly deps: SyncDeps) {}

  /** Llamar una vez al iniciar sesión. */
  async start(): Promise<void> {
    await recoverInterrupted();
    this.unsubscribe = NetInfo.addEventListener((s) => {
      if (s.isConnected && s.isInternetReachable !== false) void this.run();
    });
    void this.run();
  }

  stop(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
  }

  /** Procesa lotes hasta vaciar lo pendiente. Reentrante-seguro (un solo ciclo a la vez). */
  async run(): Promise<void> {
    if (this.running) return;
    const net = await NetInfo.fetch();
    if (!net.isConnected) return;
    this.running = true;
    try {
      let synced = 0;
      for (;;) {
        const batch = await due(50);
        if (batch.length === 0) break;
        const ok = await this.sendBatch(batch);
        if (!ok) break; // error de red: se reintenta con backoff
        synced += batch.length;
      }
      if (synced > 0) {
        await this.deps.refreshFromServer();
        await setState("last_sync_at", new Date().toISOString());
      }
    } finally {
      this.running = false;
    }
  }

  private async sendBatch(batch: OutboxAction[]): Promise<boolean> {
    await markSyncing(batch.map((a) => a.client_action_id));
    const token = await this.deps.getToken();

    let response: Response;
    try {
      response = await fetch(`${this.deps.apiUrl}/mobile/operator/sync`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${token ?? ""}`,
          // Mismo lote ⇒ misma clave (las client_action_id son estables entre reintentos).
          "Idempotency-Key": `sync-${batch[0]!.client_action_id}-${batch.length}`,
          "X-Request-Id": batch[0]!.client_action_id,
        },
        body: JSON.stringify({
          actions: batch.map((a) => ({
            client_action_id: a.client_action_id,
            type: a.type,
            assignment_id: a.assignment_id,
            occurred_at: a.occurred_at,
            offline: a.offline === 1,
            payload: JSON.parse(a.payload_json) as unknown,
          })),
        }),
      });
    } catch (e) {
      await this.scheduleRetry(batch, e instanceof Error ? e.message : "Sin conexión");
      return false;
    }

    if (response.status === 401) {
      // Token revocado/vencido: no reintentar en bucle; la app pide re-login y conserva el outbox.
      await this.scheduleRetry(batch, "Sesión vencida: inicie sesión para sincronizar");
      return false;
    }
    if (response.status === 429 || response.status >= 500) {
      await this.scheduleRetry(batch, `Servidor no disponible (${response.status})`);
      return false;
    }
    if (response.status === 409) {
      // Conflicto a nivel de lote (p. ej. IDEMPOTENCY_IN_PROGRESS): el servidor gana; esperar y reintentar.
      await this.scheduleRetry(batch, "Sincronización en curso en otro proceso");
      return false;
    }
    if (!response.ok) {
      // 403/422 de lote: no se arregla reintentando → failed con el mensaje del servidor.
      const body = (await response.json().catch(() => ({}))) as { message?: string; code?: string };
      for (const a of batch) {
        await markFailed(a.client_action_id, body.message ?? `Error ${response.status}`);
        await this.deps.onRejected(a, body.message ?? "La acción fue rechazada por el servidor.");
      }
      return true;
    }

    const body = (await response.json()) as { data?: { results?: ActionResult[] } };
    const results = new Map((body.data?.results ?? []).map((r) => [r.client_action_id, r]));

    for (const a of batch) {
      const r = results.get(a.client_action_id);
      if (!r) {
        await markRetry(a.client_action_id, "Sin resultado del servidor", new Date(Date.now() + backoffDelay(a.attempts + 1)));
        continue;
      }
      switch (r.result) {
        case "applied":
        case "duplicate": // ya estaba aplicada: misma respuesta guardada, sin efectos repetidos
          await markSynced(a.client_action_id);
          break;
        case "conflict_resolved": {
          const msg = r.message ?? `Conflicto resuelto por el servidor (${r.conflict_rule ?? "regla"})`;
          await markConflict(a.client_action_id, msg);
          this.deps.onConflict(a, msg);
          break;
        }
        case "rejected": {
          const msg = r.message ?? "La acción fue rechazada por el servidor.";
          await markFailed(a.client_action_id, msg);
          await this.deps.onRejected(a, msg);
          break;
        }
      }
    }
    return true;
  }

  private async scheduleRetry(batch: OutboxAction[], error: string): Promise<void> {
    for (const a of batch) {
      const attempt = a.attempts + 1; // markSyncing ya incrementó en BD; a.attempts es el valor previo
      if (attempt >= MAX_ATTEMPTS) await markFailed(a.client_action_id, `${error} · reintentos agotados`);
      else await markRetry(a.client_action_id, error, new Date(Date.now() + backoffDelay(attempt)));
    }
  }
}
