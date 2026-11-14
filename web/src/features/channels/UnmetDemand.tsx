import { CalendarX, UsersRound } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { InfoTip } from "@/components/ui/InfoTip";
import type { UnmetDemand } from "@/lib/channels";
import { capitalize, formatDate, formatDateTime, formatNumber } from "@/lib/format";

export function UnmetDemandSection({ demand }: { demand: UnmetDemand | undefined }) {
  const items = demand?.items ?? [];
  const max = Math.max(1, ...items.map((item) => item.sessions));

  if (items.length === 0) {
    return (
      <div className="p-5">
        <EmptyState icon={<CalendarX size={22} />} title="Sin demanda sin cupo" description="Cuando un visitante elija en el sitio una fecha sin cupo para un tour, aparecerá aquí con cuántas sesiones la buscaron." />
      </div>
    );
  }

  return (
    <div className="grid gap-4 p-5">
      <p className="flex items-center gap-2 text-[13px] text-fg-2">
        <b className="text-fg">{formatNumber(demand?.total ?? 0)}</b> sesiones eligieron una fecha sin cupo.
        <InfoTip label="De dónde sale">Eventos «Eligieron fecha» del sitio marcados sin disponibilidad, agrupados por tour y fecha. Solo se registran con el consentimiento de cookies analíticas y sin datos personales.</InfoTip>
      </p>
      <ul className="grid gap-2.5 md:grid-cols-2">
        {items.map((item, index) => (
          <li key={`${item.product?.slug ?? "buscador"}-${item.date ?? index}`} style={{ animationDelay: `${index * 50}ms` }} className="lift group animate-[rise-in_420ms_cubic-bezier(0.22,1,0.36,1)_backwards] rounded-tile border border-line bg-surface p-4">
            <div className="flex items-start justify-between gap-3">
              <span className="flex min-w-0 items-center gap-2.5">
                <span className="grid h-9 w-9 flex-none place-items-center rounded-[10px] bg-[color-mix(in_srgb,var(--warn)_14%,transparent)] text-warn transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110">
                  <CalendarX size={17} />
                </span>
                <span className="min-w-0">
                  <b className="block truncate text-[14px] font-semibold text-fg">{item.product?.name ?? "Búsqueda sin tour"}</b>
                  <span className="text-[12.5px] text-fg-3">{item.date ? capitalize(formatDate(item.date, "long")) : "Sin fecha"}</span>
                </span>
              </span>
              <span className="text-right">
                <b className="block font-mono text-[18px] font-bold leading-none text-fg">{formatNumber(item.sessions)}</b>
                <span className="text-[11.5px] text-fg-3">{item.sessions === 1 ? "sesión" : "sesiones"}</span>
              </span>
            </div>
            <span className="mt-3 block h-1.5 overflow-hidden rounded-full bg-surface-2">
              <span className="block h-full rounded-full bg-warn transition-[filter] group-hover:brightness-110" style={{ width: `${Math.max(6, (item.sessions / max) * 100)}%` }} />
            </span>
            <p className="mt-2 flex items-center justify-between gap-2 text-[12px] text-fg-3">
              <span className="inline-flex items-center gap-1.5">
                <UsersRound size={13} />
                {formatNumber(item.travelers)} viajeros buscados
              </span>
              <span>Última {formatDateTime(item.last_at, false)}</span>
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
