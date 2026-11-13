import NetInfo from "@react-native-community/netinfo";
import { API_URL } from "../config";
import { due, markFailed, markRetry, markSynced, markSyncing, recoverInterrupted, type OutboxAction } from "./outbox";

interface ActionResult {
  client_action_id: string;
  result: "applied" | "duplicate" | "conflict_resolved" | "rejected";
  conflict_rule?: string | null;
  message?: string | null;
}

export interface SyncDeps {
  getToken: () => Promise<string | null>;
  getDeviceId: () => Promise<string | null>;
  beforeSend: () => Promise<void>;
  onRejected: (action: OutboxAction, message: string) => Promise<void>;
  onConflict: (action: OutboxAction, message: string) => void;
  onSessionExpired: () => void;
  refreshFromServer: () => Promise<void>;
  onChange: () => void;
  onDeviceRevoked?: (message: string) => Promise<void>;
}

export const DEVICE_REVOKED = "DEVICE_REVOKED";

export function isDeviceRevoked(status: number, code: string | undefined): boolean {
  return status === 403 && code === DEVICE_REVOKED;
}

const MAX_ATTEMPTS = 8;
const BASE_MS = 2_000;
const MAX_MS = 5 * 60_000;

export function backoffDelay(attempt: number, random: () => number = Math.random): number {
  const raw = Math.min(MAX_MS, BASE_MS * 2 ** Math.max(0, attempt - 1));
  const jitter = raw * 0.2 * (random() * 2 - 1);
  return Math.round(Math.min(MAX_MS, raw + jitter));
}

export function toWire(action: OutboxAction, deviceId: string) {
  const payload = JSON.parse(action.payload_json) as Record<string, unknown>;
  const undo = action.type === "checkin_undo";
  return {
    client_action_id: action.client_action_id,
    device_id: deviceId,
    type: undo ? "checkin" : action.type,
    assignment_id: action.assignment_id,
    occurred_at: action.occurred_at,
    offline: action.offline === 1,
    payload: undo ? { ...payload, undo: true } : payload,
  };
}

export class SyncEngine {
  private running = false;
  private unsubscribe: (() => void) | null = null;

  constructor(private readonly deps: SyncDeps) {}

  async start(): Promise<void> {
    await recoverInterrupted();
    this.unsubscribe = NetInfo.addEventListener((state) => {
      if (state.isConnected && state.isInternetReachable !== false) void this.run();
    });
    void this.run();
  }

  stop(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
  }

  async run(): Promise<void> {
    if (this.running) return;
    const net = await NetInfo.fetch();
    if (!net.isConnected) return;
    this.running = true;
    try {
      await this.deps.beforeSend();
      for (;;) {
        const batch = await due(50);
        if (batch.length === 0) break;
        const ok = await this.sendBatch(batch);
        this.deps.onChange();
        if (!ok) break;
      }
      await this.deps.refreshFromServer().catch(async (error: unknown) => {
        const detail = typeof error === "object" && error !== null && "detail" in error ? (error.detail as { status: number; code?: string; message: string }) : null;
        if (detail && isDeviceRevoked(detail.status, detail.code)) await this.deps.onDeviceRevoked?.(detail.message);
      });
    } finally {
      this.running = false;
      this.deps.onChange();
    }
  }

  private async sendBatch(batch: OutboxAction[]): Promise<boolean> {
    const deviceId = await this.deps.getDeviceId();
    if (!deviceId) {
      await this.scheduleRetry(batch, "Registra el dispositivo iniciando sesión otra vez.");
      return false;
    }
    await markSyncing(batch.map((action) => action.client_action_id));
    const token = await this.deps.getToken();

    let response: Response;
    try {
      response = await fetch(`${API_URL}/mobile/operator/sync`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${token ?? ""}`,
          "Idempotency-Key": `sync-${batch[0]!.client_action_id}-${batch.length}`,
          "X-Request-Id": batch[0]!.client_action_id,
        },
        body: JSON.stringify({ actions: batch.map((action) => toWire(action, deviceId)) }),
      });
    } catch (error) {
      await this.scheduleRetry(batch, error instanceof Error ? error.message : "Sin conexión");
      return false;
    }

    if (response.status === 401) {
      await this.scheduleRetry(batch, "Sesión vencida: inicia sesión para sincronizar");
      this.deps.onSessionExpired();
      return false;
    }
    if (response.status === 429 || response.status >= 500) {
      await this.scheduleRetry(batch, `Servidor no disponible (${response.status})`);
      return false;
    }
    if (response.status === 409) {
      await this.scheduleRetry(batch, "Sincronización en curso en otro proceso");
      return false;
    }
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { message?: string; code?: string };
      if (isDeviceRevoked(response.status, body.code)) {
        await this.deps.onDeviceRevoked?.(body.message ?? "Tu agencia desactivó este teléfono.");
        return false;
      }
      for (const action of batch) {
        await markFailed(action.client_action_id, body.message ?? `Error ${response.status}`);
        await this.deps.onRejected(action, body.message ?? "La acción fue rechazada por el servidor.");
      }
      return true;
    }

    const body = (await response.json()) as { data?: { results?: ActionResult[] } };
    const results = new Map((body.data?.results ?? []).map((result) => [result.client_action_id, result]));

    for (const action of batch) {
      const result = results.get(action.client_action_id);
      if (!result) {
        await markRetry(action.client_action_id, "Sin resultado del servidor", new Date(Date.now() + backoffDelay(action.attempts + 1)));
        continue;
      }
      if (result.result === "applied" || result.result === "duplicate") {
        await markSynced(action.client_action_id);
      } else if (result.result === "conflict_resolved") {
        const message = result.message ?? `Conflicto resuelto por el servidor (${result.conflict_rule ?? "regla"})`;
        await markSynced(action.client_action_id, message);
        this.deps.onConflict(action, message);
      } else {
        const message = result.message ?? "La acción fue rechazada por el servidor.";
        await markFailed(action.client_action_id, message);
        await this.deps.onRejected(action, message);
      }
    }
    return true;
  }

  private async scheduleRetry(batch: OutboxAction[], error: string): Promise<void> {
    for (const action of batch) {
      const attempt = action.attempts + 1;
      if (attempt >= MAX_ATTEMPTS) await markFailed(action.client_action_id, `${error} · reintentos agotados`);
      else await markRetry(action.client_action_id, error, new Date(Date.now() + backoffDelay(attempt)));
    }
  }
}
