/**
 * Estado del outbox para el chip siempre visible de la App del operador (COMPONENTES.md: «estado de sincronización
 * siempre visible (pendientes en outbox)»): «Sin conexión · 3», «Sincronizando…», «1 conflicto», «2 con error».
 */
import NetInfo from "@react-native-community/netinfo";
import { useEffect, useState } from "react";
import { counts, type OutboxState } from "./outbox";

export type OutboxStatus = { online: boolean; counts: Record<OutboxState, number>; label: string; tone: "ok" | "warn" | "bad" | "info" };

const EMPTY: Record<OutboxState, number> = { pending: 0, syncing: 0, synced: 0, failed: 0, conflict: 0 };

export function describe(online: boolean, c: Record<OutboxState, number>): Pick<OutboxStatus, "label" | "tone"> {
  if (c.failed > 0) return { label: `${c.failed} con error · tocar para reintentar`, tone: "bad" };
  if (c.conflict > 0) return { label: `${c.conflict} conflicto(s) resuelto(s) por el servidor`, tone: "warn" };
  if (!online) return { label: c.pending > 0 ? `Sin conexión · ${c.pending}` : "Sin conexión", tone: "warn" };
  if (c.syncing > 0 || c.pending > 0) return { label: `Sincronizando… ${c.syncing + c.pending}`, tone: "info" };
  return { label: "Todo sincronizado", tone: "ok" };
}

export function useOutboxStatus(pollMs = 3_000): OutboxStatus {
  const [online, setOnline] = useState(true);
  const [c, setC] = useState(EMPTY);

  useEffect(() => NetInfo.addEventListener((s) => setOnline(Boolean(s.isConnected))), []);
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      const next = await counts();
      if (alive) setC(next);
    };
    void tick();
    const id = setInterval(() => void tick(), pollMs);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [pollMs]);

  return { online, counts: c, ...describe(online, c) };
}
