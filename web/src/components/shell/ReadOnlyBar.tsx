"use client";

import { ArrowRight, Lock } from "lucide-react";
import Link from "next/link";
import { formatDate } from "@/lib/format";
import { useMe } from "./SessionProvider";
import { useWorkspace } from "./Workspace";

const COPY = {
  trial: { title: "Tu prueba terminó", action: "Registrar tarjeta" },
  canceled: { title: "Tu suscripción terminó", action: "Reactivar plan" },
} as const;

function daysLeft(until: string): number {
  const now = new Date();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const [year, month, day] = until.split("-").map(Number);
  return Math.max(0, Math.round((Date.UTC(year, month - 1, day) - today) / 86_400_000));
}

export function ReadOnlyBar() {
  const me = useMe();
  const { allows } = useWorkspace();
  const state = me.read_only;
  if (!state) return null;

  const copy = COPY[state.reason];
  const days = daysLeft(state.until);
  const canManage = allows("/admin/suscripcion");

  return (
    <div role="status" data-testid="read-only-bar" className="relative z-30 border-b border-[color-mix(in_srgb,var(--warn)_35%,transparent)] bg-[color-mix(in_srgb,var(--warn)_12%,var(--surface))] backdrop-blur">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-2 sm:px-6 xl:px-8">
        <span className="grid h-7 w-7 flex-none place-items-center rounded-lg bg-warn text-white">
          <Lock size={14} />
        </span>
        <p className="min-w-0 flex-1 text-[13px] text-fg-2">
          <b className="font-semibold text-fg">{copy.title}: la cuenta está en solo lectura</b>
          <span className="text-fg-3"> · puedes consultar y exportar hasta el {formatDate(state.until)} ({days === 0 ? "último día" : days === 1 ? "queda 1 día" : `quedan ${days} días`})</span>
        </p>
        {canManage ? (
          <Link href="/admin/suscripcion" className="inline-flex h-8 flex-none items-center gap-1.5 rounded-control bg-warn px-3 text-[12.5px] font-semibold text-white transition hover:brightness-110">
            {copy.action} <ArrowRight size={14} />
          </Link>
        ) : (
          <span className="flex-none text-[12px] text-fg-3">Pide al administrador que active el plan.</span>
        )}
      </div>
    </div>
  );
}
