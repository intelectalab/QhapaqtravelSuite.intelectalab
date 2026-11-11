import { CircleCheck, Hourglass, ListChecks, Scale, Stamp, Users } from "lucide-react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { InfoTip } from "@/components/ui/InfoTip";
import { TintCardTitle, TintTile } from "@/components/ui/Tinted";
import { CalculateCommissionsAction, CommissionsTable, RuleFormAction } from "@/features/finance/Commissions";
import { cn } from "@/lib/cn";
import type { BeneficiarySummary, CommissionRule, CommissionsOverview } from "@/lib/finance";
import { formatDate, formatMoney } from "@/lib/format";
import { getResource } from "@/lib/server/resource";

export const metadata: Metadata = { title: "Comisiones" };

const SEGMENTS = [
  { key: "calculated", label: "Por aprobar", className: "bg-info" },
  { key: "approved", label: "Por pagar", className: "bg-warn" },
  { key: "paid", label: "Pagado", className: "bg-ok" },
] as const;

function BeneficiaryBreakdown({ rows }: { rows: BeneficiarySummary[] }) {
  if (rows.length === 0) return <p className="py-6 text-center text-[13px] text-fg-3">Aún no hay comisiones.</p>;
  const max = Math.max(1, ...rows.map((row) => row.pen));
  return (
    <>
      <ul className="grid gap-3">
        {rows.slice(0, 8).map((row, index) => (
          <li key={row.name} style={{ animationDelay: `${index * 60}ms` }} className="group grid gap-1 animate-[rise-in_420ms_cubic-bezier(0.22,1,0.36,1)_backwards]">
            <span className="flex items-baseline justify-between gap-3 text-[13px]">
              <span className="min-w-0 truncate">
                <b className="font-semibold">{row.name}</b>
                <span className="text-xs text-fg-3"> · {row.kind} · {row.count === 1 ? "1 comisión" : `${row.count} comisiones`}</span>
              </span>
              <span className="flex-none whitespace-nowrap font-mono font-semibold">{formatMoney(row.pen)}</span>
            </span>
            <span className="flex h-2.5 overflow-hidden rounded-full bg-surface-2" style={{ width: `${Math.max(8, (row.pen / max) * 100)}%` }}>
              {SEGMENTS.map((segment) =>
                row[segment.key] > 0 ? <span key={segment.key} title={`${segment.label}: ${formatMoney(row[segment.key])}`} className={cn("h-full origin-left transition-[filter] group-hover:brightness-110 motion-safe:animate-[fill-x_700ms_cubic-bezier(0.22,1,0.36,1)_backwards]", segment.className)} style={{ width: `${(row[segment.key] / row.pen) * 100}%` }} /> : null,
              )}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-3 flex flex-wrap gap-4 text-[12px] text-fg-3">
        {SEGMENTS.map((segment) => (
          <span key={segment.key} className="inline-flex items-center gap-1.5">
            <span className={cn("h-2 w-2 rounded-full", segment.className)} />
            {segment.label}
          </span>
        ))}
      </p>
    </>
  );
}

function RulesCard({ rules, editable, today }: { rules: CommissionRule[]; editable: boolean; today: string }) {
  return (
    <Card>
      <TintCardTitle icon={Scale} title="Reglas de comisión" aside={editable ? <RuleFormAction today={today} /> : undefined} />
      <ul className="grid gap-2">
        {rules.map((rule, index) => (
          <li key={rule.id} style={{ animationDelay: `${index * 70}ms` }} className={cn("lift flex items-center gap-3 rounded-xl bg-surface-2 px-3.5 py-2.5 animate-[rise-in_420ms_cubic-bezier(0.22,1,0.36,1)_backwards]", !rule.in_force && "opacity-60")}>
            <span className="min-w-0 flex-1 text-[13px]">
              <b className="block font-semibold">{rule.condition_label}</b>
              <span className="text-xs text-fg-3">
                {rule.base} · desde {formatDate(rule.valid_from)}
                {rule.valid_to ? ` hasta ${formatDate(rule.valid_to)}` : ""}
                {rule.used > 0 ? ` · usada en ${rule.used}` : ""}
              </span>
            </span>
            {!rule.active ? <Badge tone="mute">Inactiva</Badge> : !rule.in_force && <Badge tone="warn">Fuera de vigencia</Badge>}
            <span className="font-mono text-[14px] font-bold">{rule.pct === null ? "Convenio" : `${rule.pct.toLocaleString("es-PE")} %`}</span>
            {editable && <RuleFormAction rule={rule} today={today} />}
          </li>
        ))}
      </ul>
    </Card>
  );
}

export default async function ComisionesPage() {
  const data = await getResource<CommissionsOverview>("/finance/commissions", "No pudimos cargar las comisiones.");

  if (!data) {
    return <PageHeader title="Comisiones" subtitle="Tu rol no tiene acceso a esta sección." />;
  }

  const { kpis } = data;
  const today = new Date().toISOString().slice(0, 10);

  return (
    <>
      <PageHeader
        title="Comisiones"
        subtitle="Comisiones de vendedores, agencias y bonos por meta."
        info={<InfoTip>Cada comisión guarda la regla con la que se calculó. Recalcular vuelve a aplicar la regla vigente; una comisión pagada ya no se recalcula y las diferencias se ajustan en el siguiente periodo.</InfoTip>}
        actions={data.can.operate && kpis.pending_reservations > 0 ? <CalculateCommissionsAction pending={kpis.pending_reservations} /> : undefined}
      />
      <section className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <TintTile icon={Hourglass} tone="info" label="Por aprobar" value={formatMoney(kpis.calculada.pen, "PEN", { compact: true })} info={<p>Comisiones calculadas que esperan aprobación, en soles al tipo de cambio de cada reserva.</p>} />
        <TintTile icon={Stamp} tone="sun" label="Aprobado por pagar" value={formatMoney(kpis.aprobada.pen, "PEN", { compact: true })} info={<p>Comisiones aprobadas que aún no se pagan en planilla, transferencia o nota de crédito.</p>} />
        <TintTile icon={CircleCheck} tone="ok" label="Pagado" value={formatMoney(kpis.pagada.pen, "PEN", { compact: true })} info={<p>Comisiones ya pagadas, con su forma de pago y referencia.</p>} />
        <TintTile icon={ListChecks} tone="violet" label="Reservas sin comisión" value={kpis.pending_reservations} note="Vendidas y aún sin calcular" info={<p>Reservas confirmadas con asesor o agencia con convenio que todavía no tienen comisión. Calcular pendientes las crea con la regla vigente.</p>} />
      </section>
      <div className="mb-5 grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Card>
          <TintCardTitle icon={Users} title="Por beneficiario" aside="En soles" />
          <BeneficiaryBreakdown rows={data.by_beneficiary} />
        </Card>
        <RulesCard rules={data.rules} editable={data.can.rules} today={today} />
      </div>
      <CommissionsTable data={data} />
    </>
  );
}
