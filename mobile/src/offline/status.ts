import type { Tone } from "../theme";
import type { OutboxState } from "./outbox";

export function describeStatus(online: boolean, counts: Record<OutboxState, number>): { label: string; tone: Tone } {
  if (counts.failed > 0) return { label: `${counts.failed} con error`, tone: "bad" };
  if (counts.conflict > 0) return { label: `${counts.conflict} resuelto${counts.conflict === 1 ? "" : "s"} por el servidor`, tone: "warn" };
  if (!online) return { label: counts.pending > 0 ? `Sin conexión · ${counts.pending} por enviar` : "Sin conexión", tone: "warn" };
  if (counts.syncing > 0 || counts.pending > 0) return { label: `Sincronizando · ${counts.syncing + counts.pending}`, tone: "info" };
  return { label: "Todo sincronizado", tone: "ok" };
}
