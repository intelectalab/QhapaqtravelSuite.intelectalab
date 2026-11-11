import { ArrowRight, Ban, CalendarCheck2, Pencil, PlayCircle, Plus, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { SectionTitle } from "@/components/ui/Details";
import { SimpleTable } from "@/components/ui/SimpleTable";
import { cn } from "@/lib/cn";
import { formatDate, formatDateTime, formatMoney, formatPercent } from "@/lib/format";
import { ADJUSTMENT_LABELS, GOAL_LABELS, HEALTH, targetHref, type SalesTarget, type TargetAdjustment, type TargetBreakdownRow } from "@/lib/targets";
import { ProgressBar } from "./TargetForms";

function Indicator({ label, real, goal, format }: { label: string; real: number; goal: number | null; format: (value: number) => string }) {
  const pct = goal ? (real / goal) * 100 : null;
  return (
    <li className="lift rounded-xl border border-line px-3.5 py-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[12.5px] text-fg-3">{label}</span>
        <span className={cn("text-[15px] font-bold", pct !== null && pct >= 100 && "text-ok")}>{format(real)}</span>
      </div>
      {pct !== null ? (
        <>
          <div className="mt-2">
            <ProgressBar progress={pct} projection={pct} />
          </div>
          <p className="mt-1 text-[11.5px] text-fg-3">
            {formatPercent(pct, 0)} de {format(goal ?? 0)}
          </p>
        </>
      ) : (
        <p className="mt-1 text-[11.5px] text-fg-3">Sin meta para este indicador</p>
      )}
    </li>
  );
}

export function TargetProgressSection({ target }: { target: SalesTarget }) {
  return (
    <div className="flex flex-col gap-5">
      <Card>
        <SectionTitle title="Indicadores" />
        <ul className="grid gap-3 md:grid-cols-3">
          <Indicator label="Reservas" real={target.actual.bookings} goal={target.goals.bookings} format={(value) => String(Math.round(value))} />
          <Indicator label="Margen" real={target.actual.margin} goal={target.goals.margin} format={(value) => formatMoney(value, "PEN", { compact: true })} />
          <Indicator label="Conversión" real={target.actual.conversion ?? 0} goal={target.goals.conversion} format={(value) => formatPercent(value, 0)} />
        </ul>
      </Card>
      <Card>
        <SectionTitle title="Reservas que suman" />
        <SimpleTable
          columns={[{ header: "Reserva" }, { header: "Creada" }, { header: "Total", align: "right" }, { header: "En soles", align: "right" }]}
          rows={target.reservations.map((item) => ({
            key: item.code,
            cells: [
              <Link key="code" href={`/reservas/${item.code}`} className="hover:text-accent hover:underline">
                <b className="block text-[13px]">{item.title}</b>
                <span className="font-mono text-[12px] text-fg-3">{item.code}</span>
              </Link>,
              formatDate(item.created_at),
              formatMoney(item.total, item.currency),
              formatMoney(item.total_pen),
            ],
          }))}
          empty={target.status === "cerrada" ? "El resultado quedó congelado al cerrar el período." : "Aún no hay reservas confirmadas en el período."}
        />
      </Card>
      {target.status !== "cerrada" && (
        <Card>
          <SectionTitle title="Oportunidades que cierran en el período" />
          <SimpleTable
            columns={[{ header: "Oportunidad" }, { header: "Cierre" }, { header: "Probabilidad", align: "right" }, { header: "Monto", align: "right" }]}
            rows={target.pipeline.map((item) => ({
              key: item.code,
              cells: [
                <Link key="code" href={`/crm/oportunidades/${item.code}`} className="hover:text-accent hover:underline">
                  <b className="block text-[13px]">{item.title}</b>
                  <span className="font-mono text-[12px] text-fg-3">{item.code}</span>
                </Link>,
                formatDate(item.close),
                `${item.probability} %`,
                formatMoney(item.amount, item.currency),
              ],
            }))}
            empty="No hay oportunidades abiertas con cierre en el período."
          />
        </Card>
      )}
    </div>
  );
}

const KIND_LABELS: Record<TargetBreakdownRow["kind"], string> = { asesor: "Asesor", equipo: "Equipo", sede: "Sede" };

export function TargetBreakdownSection({ target, rows }: { target: SalesTarget; rows: TargetBreakdownRow[] }) {
  const byAdvisor = target.scope_type !== "asesor";
  return (
    <Card>
      <SectionTitle title={byAdvisor ? "Aporte de cada asesor" : "Metas de equipo y sede que integra"} />
      <SimpleTable
        columns={
          byAdvisor
            ? [{ header: "Asesor" }, { header: "Vendido", align: "right" }, { header: "Reservas", align: "right" }, { header: "Su meta", align: "right" }, { header: "Avance" }, { header: "Aporte", align: "right" }]
            : [{ header: "Meta" }, { header: "Vendido", align: "right" }, { header: "Reservas", align: "right" }, { header: "Meta", align: "right" }, { header: "Avance" }, { header: "Tu aporte", align: "right" }]
        }
        rows={rows.map((row) => ({
          key: `${row.kind}-${row.name}-${row.target_code ?? ""}`,
          cells: [
            <span key="name" className="block">
              {row.target_code ? (
                <Link href={targetHref(row.target_code)} className="font-semibold hover:text-accent hover:underline">
                  {row.name}
                </Link>
              ) : (
                <b className="font-semibold">{row.name}</b>
              )}
              <span className="block text-[12px] text-fg-3">{[KIND_LABELS[row.kind], row.period_label].filter(Boolean).join(" · ")}</span>
            </span>,
            formatMoney(row.sales),
            String(row.bookings),
            row.goal !== null ? formatMoney(row.goal) : "Sin meta",
            row.progress_pct !== null ? (
              <span key="bar" className="block w-[140px]">
                <ProgressBar progress={row.progress_pct} projection={row.progress_pct} />
                <span className="mt-1 block text-[11.5px] text-fg-3">{formatPercent(row.progress_pct, 0)}</span>
              </span>
            ) : (
              <span key="bar" className="text-[12px] text-fg-3">—</span>
            ),
            formatPercent(row.share_pct, 0),
          ],
        }))}
        empty={byAdvisor ? "Nadie vendió todavía en este período." : "No integra metas de equipo o sede en este período."}
      />
    </Card>
  );
}

export function TargetHistorySection({ rows }: { rows: SalesTarget[] }) {
  return (
    <Card>
      <SectionTitle title="Otros períodos" />
      <SimpleTable
        columns={[{ header: "Período" }, { header: "Meta", align: "right" }, { header: "Vendido", align: "right" }, { header: "Cumplimiento" }, { header: "Estado" }]}
        rows={rows.map((row) => {
          const health = HEALTH[row.health] ?? HEALTH.borrador;
          return {
            key: row.code,
            muted: row.status === "anulada",
            cells: [
              <Link key="period" href={targetHref(row.code)} className="hover:text-accent hover:underline">
                <b className="block text-[13px]">{row.period_label}</b>
                <span className="font-mono text-[12px] text-fg-3">{row.code}</span>
              </Link>,
              formatMoney(row.goals.sales),
              formatMoney(row.actual.sales),
              <span key="bar" className="block w-[140px]">
                <ProgressBar progress={row.progress_pct} projection={row.projection_pct} />
                <span className="mt-1 block text-[11.5px] text-fg-3">{formatPercent(row.progress_pct, 0)}</span>
              </span>,
              <Badge key="health" tone={health.tone}>
                {health.label}
              </Badge>,
            ],
          };
        })}
        empty="No hay metas de este alcance en otros períodos."
      />
    </Card>
  );
}

const ADJUSTMENT_ICONS: Record<TargetAdjustment["action"], LucideIcon> = { crear: Plus, activar: PlayCircle, ajustar: Pencil, anular: Ban, cerrar: CalendarCheck2, bono: Plus };

function goalValue(key: string, value: number | string | null | undefined) {
  if (value === null || value === undefined) return "Sin meta";
  const number = Number(value);
  if (key === "goal_bookings") return String(number);
  if (key === "goal_conversion_pct") return formatPercent(number, 0);
  return formatMoney(number);
}

export function TargetAdjustmentsSection({ rows }: { rows: TargetAdjustment[] }) {
  if (rows.length === 0) {
    return (
      <Card>
        <p className="text-[13px] text-fg-3">Sin movimientos registrados.</p>
      </Card>
    );
  }
  return (
    <Card>
      <SectionTitle title="Historial de ajustes" />
      <ol className="flex flex-col gap-3 border-l-2 border-line pl-4">
        {rows.map((row) => {
          const Icon = ADJUSTMENT_ICONS[row.action] ?? Pencil;
          const changes = Object.keys(GOAL_LABELS).filter((key) => row.before && row.after && String(row.before[key] ?? "") !== String(row.after[key] ?? ""));
          return (
            <li key={`${row.action}-${row.at}`} className="relative">
              <span className="absolute -left-[27px] top-0.5 grid h-5 w-5 place-items-center rounded-full bg-surface-2 text-fg-2 ring-2 ring-surface">
                <Icon size={11} />
              </span>
              <p className="text-[13px]">
                <b className="font-semibold">{ADJUSTMENT_LABELS[row.action] ?? row.action}</b> · {row.by} · <span className="text-fg-3">{formatDateTime(row.at)}</span>
              </p>
              {changes.length > 0 && (
                <ul className="mt-1 flex flex-wrap gap-1.5">
                  {changes.map((key) => (
                    <li key={key} className="inline-flex items-center gap-1 rounded-lg bg-surface-2 px-2 py-1 text-[12px]">
                      {GOAL_LABELS[key]}: {goalValue(key, row.before?.[key])} <ArrowRight size={12} className="text-fg-3" /> <b>{goalValue(key, row.after?.[key])}</b>
                    </li>
                  ))}
                </ul>
              )}
              {row.reason && <p className="mt-1 text-[12.5px] text-fg-2">{row.reason}</p>}
            </li>
          );
        })}
      </ol>
    </Card>
  );
}

export function TargetStatusBadges({ target }: { target: SalesTarget }) {
  const health = HEALTH[target.health] ?? HEALTH.borrador;
  return (
    <span className="ml-2 inline-flex flex-none items-center gap-1.5">
      <StatusBadge status={target.status} />
      {health.label.toLowerCase() !== target.status && <Badge tone={health.tone}>{health.label}</Badge>}
    </span>
  );
}
