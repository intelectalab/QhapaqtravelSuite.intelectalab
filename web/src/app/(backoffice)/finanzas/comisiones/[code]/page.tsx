import { BadgePercent, Calculator, Coins, Scale } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { PageHeader } from "@/components/shell/PageHeader";
import { StatusBadge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { FieldList } from "@/components/ui/Details";
import { TintCardTitle, TintTile, ToneScope } from "@/components/ui/Tinted";
import { AuditCard, StatusHistoryCard } from "@/features/finance/FinanceDetailParts";
import { cn } from "@/lib/cn";
import type { CommissionDetail } from "@/lib/finance";
import { formatDateTime, formatMoney } from "@/lib/format";
import { getResource } from "@/lib/server/resource";
import { statusTone } from "@/lib/tone";

const getCommission = cache(async (code: string) => (await getResource<CommissionDetail>(`/finance/commissions/${encodeURIComponent(code)}`, "No pudimos cargar la comisión.")) ?? notFound());

export async function generateMetadata({ params }: PageProps<"/finanzas/comisiones/[code]">): Promise<Metadata> {
  const { code } = await params;
  return { title: `Comisión ${(await getCommission(code)).code}` };
}

export default async function ComisionPage({ params }: PageProps<"/finanzas/comisiones/[code]">) {
  const { code } = await params;
  const row = await getCommission(code);
  const rule = row.current_rule;

  return (
    <ToneScope tone={statusTone(row.status)}>
      <PageHeader
        back={{ href: "/finanzas/comisiones", label: "Comisiones" }}
        jump={false}
        leading={
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-[var(--tint)] text-white shadow-[0_10px_24px_-12px_var(--tint)]">
            <BadgePercent size={24} />
          </span>
        }
        title={row.beneficiary ?? "Comisión"}
        info={
          <span className="ml-2 flex-none">
            <StatusBadge status={row.status} primary />
          </span>
        }
        subtitle={`${row.code} · ${row.beneficiary_kind === "asesor" ? "Asesor" : "Agencia aliada"}`}
      />
      <section className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <TintTile icon={Calculator} tone="t1" label="Base" value={formatMoney(row.base, row.currency)} />
        <TintTile icon={BadgePercent} tone="violet" label="Porcentaje" value={`${Number(row.pct)} %`} />
        <TintTile icon={Coins} tone="ok" label="Comisión" value={formatMoney(row.amount, row.currency)} />
        <TintTile icon={Scale} tone={rule && Number(rule.difference) !== 0 ? "warn" : "sun"} label="Frente a la regla vigente" value={rule ? (Number(rule.difference) === 0 ? "Coincide" : formatMoney(rule.difference, row.currency)) : <span className="text-[14px] text-fg-3">Sin regla</span>} />
      </section>
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-5">
          <Card>
            <TintCardTitle icon={Scale} title="Regla aplicada" />
            <FieldList
              fields={[
                { label: "Regla", value: <span className="whitespace-normal">{row.rule ?? "Sin descripción"}</span> },
                ...(rule
                  ? [
                      { label: "Porcentaje vigente", value: `${Number(rule.pct)} %${rule.active ? "" : " · regla inactiva"}` },
                      ...(rule.condition ? [{ label: "Condición", value: <span className="whitespace-normal">{rule.condition}</span> }] : []),
                      { label: "Con la regla vigente sería", value: formatMoney(rule.expected, row.currency) },
                      { label: "Diferencia", value: <span className={cn("font-mono", Number(rule.difference) !== 0 && "text-warn")}>{formatMoney(rule.difference, row.currency)}</span> },
                    ]
                  : []),
              ]}
            />
          </Card>
          <AuditCard rows={row.audit} />
        </div>
        <div className="flex flex-col gap-5">
          <Card>
            <TintCardTitle icon={Coins} title="Aprobación y pago" />
            <FieldList
              fields={[
                ...(row.reservation ? [{ label: "Reserva", value: <Link href={`/reservas/${row.reservation.code}`} className="hover:underline">{row.reservation.code}</Link> }] : [{ label: "Origen", value: "Bono por meta" }]),
                { label: "Aprobó", value: row.approved_by ? `${row.approved_by}${row.approved_at ? ` · ${formatDateTime(row.approved_at)}` : ""}` : "Pendiente" },
                { label: "Pagada", value: row.paid_at ? `${formatDateTime(row.paid_at)}${row.payment_method ? ` · ${row.payment_method}` : ""}${row.payment_ref ? ` · ${row.payment_ref}` : ""}` : "No" },
                ...(row.observation ? [{ label: "Observación", value: <span className="whitespace-normal">{row.observation}</span> }] : []),
              ]}
            />
          </Card>
          <StatusHistoryCard rows={row.history} />
        </div>
      </div>
    </ToneScope>
  );
}
