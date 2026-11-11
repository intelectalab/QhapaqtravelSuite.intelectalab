"use client";

import { LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { StatusBadge } from "@/components/ui/Badge";
import { ProgressBar } from "@/components/ui/MiniTable";
import { cn } from "@/lib/cn";
import { formatDate, formatMoney } from "@/lib/format";
import type { ApprovalItem } from "@/lib/approvals";
import { loadApprovalOrigin, type ApprovalOriginData } from "./origin";

const ORIGIN_TYPES = ["quote", "cancel", "change", "reversal", "refund", "other"];

function MarginBar({ value }: { value: number }) {
  return (
    <span className="flex items-center justify-end gap-2">
      <span className="h-1.5 w-14 overflow-hidden rounded-full bg-surface-2">
        <span className={cn("block h-full rounded-full transition-[width] duration-700", value < 0 ? "bg-bad" : "bg-accent")} style={{ width: `${Math.min(100, Math.max(4, Math.abs(value)))}%` }} />
      </span>
      <span className={cn("w-12 text-right font-mono", value < 0 && "text-bad")}>{value.toFixed(1)} %</span>
    </span>
  );
}

function QuoteLines({ origin }: { origin: Extract<ApprovalOriginData, { kind: "quote" }> }) {
  const { version, currency } = origin;
  const totals = [
    { label: "Venta neta", value: version.totals.net },
    { label: "Costo", value: version.totals.cost },
    { label: "Utilidad", value: version.totals.profit },
  ].filter((entry): entry is { label: string; value: string } => entry.value !== null);
  return (
    <section className="flex flex-col gap-2" data-testid="approval-origin-quote">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[12.5px] font-semibold text-fg-3">Líneas de la versión {version.number}</p>
        {version.totals.margin_pct !== null && <span className="text-[12.5px] text-fg-2">Margen total {Number(version.totals.margin_pct).toFixed(1)} %</span>}
      </div>
      <ul className="flex flex-col divide-y divide-line-2 rounded-xl border border-line-2">
        {version.items.map((item) => (
          <li key={item.line} className="flex items-center justify-between gap-3 px-3 py-2 text-[13px] transition-colors hover:bg-surface-2">
            <span className="min-w-0">
              <b className="block truncate font-medium">{item.product.name}</b>
              <span className="text-[12px] text-fg-3">
                {formatDate(item.date)} · {item.pax} pax · {item.segment}
              </span>
            </span>
            <span className="flex flex-none flex-col items-end gap-1">
              <span className="font-mono text-[12.5px]">{formatMoney(item.total, currency)}</span>
              {item.margin_pct !== null && <MarginBar value={Number(item.margin_pct)} />}
            </span>
          </li>
        ))}
      </ul>
      {totals.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {totals.map((entry) => (
            <div key={entry.label} className="lift rounded-xl border border-line-2 px-3 py-2">
              <p className="text-[11.5px] text-fg-3">{entry.label}</p>
              <p className="font-mono text-[13.5px] font-semibold">{formatMoney(entry.value, currency)}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function Receivables({ origin }: { origin: Extract<ApprovalOriginData, { kind: "receivables" }> }) {
  return (
    <section className="flex flex-col gap-2" data-testid="approval-origin-receivables">
      <p className="text-[12.5px] font-semibold text-fg-3">Cuentas por cobrar de {origin.reservation}</p>
      <ul className="flex flex-col gap-1.5">
        {origin.receivables.map((receivable) => {
          const amount = Number(receivable.amount);
          const paid = Number(receivable.paid_amount);
          const pct = amount > 0 ? (paid / amount) * 100 : 0;
          const affected = origin.applied.includes(receivable.code);
          return (
            <li key={receivable.code} data-affected={affected ? "1" : undefined} className={cn("lift rounded-xl border px-3.5 py-2.5 text-[13px]", affected ? "border-warn/60 bg-[color-mix(in_srgb,var(--warn)_7%,transparent)]" : "border-line-2")}>
              <div className="flex items-start justify-between gap-3">
                <span className="min-w-0">
                  <b className="block truncate font-semibold">{receivable.concept}</b>
                  <span className="text-[12px] text-fg-3">
                    {receivable.code} · vence el {formatDate(receivable.due_date)}
                    {affected && " · el pago a revertir se aplicó aquí"}
                  </span>
                </span>
                <StatusBadge status={receivable.status} />
              </div>
              <div className="mt-2 flex items-center gap-3">
                <span className="flex-1">
                  <ProgressBar value={pct} tone={pct >= 100 ? "ok" : pct > 0 ? "warn" : "bad"} />
                </span>
                <span className="whitespace-nowrap font-mono text-[12.5px]">
                  {formatMoney(paid, receivable.currency)} de {formatMoney(amount, receivable.currency)}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function ApprovalOrigin({ item }: { item: ApprovalItem }) {
  const payment = item.subject?.type === "fin_payments" ? (item.subject.code ?? null) : null;
  const applies = ORIGIN_TYPES.includes(item.type) && (item.type !== "quote" || item.version_no !== undefined) && (item.type === "quote" || ["cancel", "change"].includes(item.type) || Boolean(item.reservation) || payment !== null);
  const [origin, setOrigin] = useState<ApprovalOriginData | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(applies);

  useEffect(() => {
    if (!applies) return;
    let active = true;
    loadApprovalOrigin({ type: item.type, target: item.target, version: item.version_no, reservation: item.reservation, subject: payment ? { type: "fin_payments", code: payment } : null, currency: item.currency }).then((result) => {
      if (!active) return;
      setOrigin(result.origin);
      setMessage(result.message);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [applies, payment, item.type, item.target, item.version_no, item.reservation, item.currency]);

  if (!applies) return null;
  if (loading)
    return (
      <p className="flex items-center gap-2 text-[12.5px] text-fg-3">
        <LoaderCircle size={14} className="animate-spin" />
        Cargando el registro de origen…
      </p>
    );
  if (message) return <p className="text-[12.5px] text-bad">{message}</p>;
  if (!origin) return null;
  return origin.kind === "quote" ? <QuoteLines origin={origin} /> : <Receivables origin={origin} />;
}
