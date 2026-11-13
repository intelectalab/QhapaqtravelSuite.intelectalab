import { CheckCircle2, CircleAlert, Coins, Lock, Receipt, Wallet } from "lucide-react";
import Link from "next/link";
import { StatusBadge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { FieldList } from "@/components/ui/Details";
import { MiniTable } from "@/components/ui/MiniTable";
import { TintCardTitle } from "@/components/ui/Tinted";
import { cn } from "@/lib/cn";
import type { SettlementDetail } from "@/lib/finance";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { SettlementCloseAction } from "./SettlementClose";

export function SettlementSection({ data }: { data: SettlementDetail | null }) {
  if (!data) {
    return (
      <Card>
        <p className="py-6 text-center text-[13.5px] text-fg-3">La liquidación la ven quienes tienen acceso a la rentabilidad de la agencia.</p>
      </Card>
    );
  }
  const { statement, cash } = data;
  return (
    <div className="flex flex-col gap-5">
      {data.closed && (
        <p className="flex items-center gap-2 rounded-card border border-[color-mix(in_srgb,var(--ok)_30%,transparent)] bg-[color-mix(in_srgb,var(--ok)_8%,transparent)] px-4 py-3 text-[13.5px]">
          <Lock size={16} className="flex-none text-ok" />
          <span>
            <b className="font-semibold">Liquidación cerrada</b> el {formatDateTime(data.closed.closed_at)}
            {data.closed.closed_by && ` por ${data.closed.closed_by}`}. Neto {formatMoney(data.closed.net_pen)}.
          </span>
        </p>
      )}
      <div className="grid items-start gap-5 xl:grid-cols-2">
        <Card>
          <TintCardTitle icon={Coins} title="Estado de resultados" aside="En soles" />
          <FieldList
            fields={[
              { label: "Ingresos sin IGV", value: <span className="font-mono">{formatMoney(statement.income)}</span> },
              { label: "Costo de servicios", value: <span className="font-mono">− {formatMoney(statement.service_cost ?? statement.cost)}</span> },
              ...(statement.extra_cost !== undefined ? [{ label: "Costos adicionales aprobados", value: <span className="font-mono">− {formatMoney(statement.extra_cost)}</span> }] : []),
              ...(Number(statement.pending_extra_cost ?? 0) > 0 ? [{ label: "Costos por aprobar (sin impacto)", value: <span className="font-mono text-fg-3">{formatMoney(statement.pending_extra_cost ?? 0)}</span> }] : []),
              ...(statement.gross !== undefined ? [{ label: "Margen bruto", value: <b className={cn("font-mono", Number(statement.gross) < 0 && "text-bad")}>{formatMoney(statement.gross)}{statement.margin_pct !== null && ` · ${statement.margin_pct} %`}</b> }] : []),
              { label: "Comisiones", value: <span className="font-mono">− {formatMoney(statement.commissions)}</span> },
              { label: "Utilidad neta", value: <b className={cn("font-mono", Number(statement.net) < 0 && "text-bad")}>{formatMoney(statement.net)}{statement.net_pct != null && ` · ${statement.net_pct} %`}</b> },
            ]}
          />
        </Card>
        <Card>
          <TintCardTitle icon={Wallet} title="Flujo de caja" aside="En soles" />
          <FieldList
            fields={[
              { label: "Cobrado", value: <span className="font-mono">{formatMoney(cash.collected)}</span> },
              { label: "Pagado a proveedores", value: <span className="font-mono">− {formatMoney(cash.paid_out)}</span> },
              { label: "Posición de caja", value: <b className="font-mono">{formatMoney(cash.position)}</b> },
            ]}
          />
        </Card>
      </div>
      <Card>
        <TintCardTitle icon={CheckCircle2} title="Para liquidar" aside={data.closed ? undefined : <SettlementCloseAction code={data.reservation.code} disabled={!data.can_close} />} />
        <ul className="grid gap-2 md:grid-cols-2">
          {data.checks.map((check) => (
            <li key={check.key} className={cn("flex items-start gap-2.5 rounded-[12px] px-3 py-2.5 text-[13px]", check.ok ? "bg-[color-mix(in_srgb,var(--ok)_8%,transparent)]" : "bg-[color-mix(in_srgb,var(--warn)_10%,transparent)]")}>
              {check.ok ? <CheckCircle2 size={16} className="mt-0.5 flex-none text-ok" /> : <CircleAlert size={16} className="mt-0.5 flex-none text-warn" />}
              <span>
                <b className="block font-semibold">{check.label}</b>
                {!check.ok && <span className="text-fg-2">{check.detail}</span>}
              </span>
            </li>
          ))}
        </ul>
      </Card>
      <Card>
        <TintCardTitle icon={Receipt} title="Cobros" aside={String(data.receivables.length)} />
        {data.receivables.length === 0 ? (
          <p className="text-[13.5px] text-fg-3">La reserva no tiene cuotas por cobrar.</p>
        ) : (
          <MiniTable head={["Cuota", "Vence", "Importe", "Cobrado", "Estado"]} align={["left", "left", "right", "right", "left"]} minWidth={520}>
            {data.receivables.map((item) => (
              <tr key={item.code}>
                <td>
                  <Link href={`/finanzas/cobros/${item.code}`} className="font-semibold hover:underline">
                    {item.concept}
                  </Link>
                  <span className="block text-xs text-fg-3">{item.code}</span>
                </td>
                <td className="whitespace-nowrap">{formatDate(item.due_date)}</td>
                <td className="text-right font-mono">{formatMoney(item.amount, item.currency ?? data.reservation.currency)}</td>
                <td className="text-right font-mono">{formatMoney(item.paid_amount, item.currency ?? data.reservation.currency)}</td>
                <td>
                  <StatusBadge status={item.status} />
                </td>
              </tr>
            ))}
          </MiniTable>
        )}
      </Card>
      <div className="grid items-start gap-5 xl:grid-cols-2">
        <Card>
          <TintCardTitle icon={Wallet} title="Costos" aside={String(data.payables.length)} />
          {data.payables.length === 0 ? (
            <p className="text-[13.5px] text-fg-3">Sin cuentas por pagar registradas.</p>
          ) : (
            <MiniTable head={["Obligación", "Monto", "Pagado", "Estado"]} align={["left", "right", "right", "left"]} minWidth={460}>
              {data.payables.map((item) => (
                <tr key={item.code}>
                  <td>
                    <Link href={`/finanzas/proveedores/${item.code}`} className="font-semibold hover:underline">
                      {item.concept}
                    </Link>
                    <span className="block text-xs text-fg-3">{[item.code, item.provider].filter(Boolean).join(" · ")}</span>
                  </td>
                  <td className="text-right font-mono">{formatMoney(item.amount, item.currency)}</td>
                  <td className="text-right font-mono">{formatMoney(item.paid_amount, item.currency)}</td>
                  <td>
                    <StatusBadge status={item.status} />
                  </td>
                </tr>
              ))}
            </MiniTable>
          )}
        </Card>
        <Card>
          <TintCardTitle icon={Coins} title="Comisiones" aside={String(data.commissions.length)} />
          {data.commissions.length === 0 ? (
            <p className="text-[13.5px] text-fg-3">Sin comisiones calculadas.</p>
          ) : (
            <ul className="flex flex-col">
              {data.commissions.map((item) => (
                <li key={item.code} className="flex items-center gap-3 border-t border-line-2 py-2.5 text-[13px] first:border-t-0">
                  <Link href={`/finanzas/comisiones/${item.code}`} className="min-w-0 flex-1 font-semibold hover:underline">
                    {item.code} <span className="font-normal text-fg-3">· {item.kind}</span>
                  </Link>
                  <span className="font-mono">{formatMoney(item.amount, item.currency)}</span>
                  <StatusBadge status={item.status} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
