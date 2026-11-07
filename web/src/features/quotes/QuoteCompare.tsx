"use client";

import { ArrowRight, GitCompareArrows } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { compareVersions } from "@/app/(backoffice)/cotizaciones/actions";
import { Select } from "@/components/ui/Select";
import { SidePanel } from "@/components/ui/SidePanel";
import { Button } from "@/components/ui/Button";
import { FormError } from "@/features/auth/AuthForms";
import { cn } from "@/lib/cn";
import { formatDate, formatMoney } from "@/lib/format";
import type { QuoteComparison } from "@/lib/quotes";

const CHANGE = {
  agregada: { label: "Agregada", className: "text-ok" },
  quitada: { label: "Quitada", className: "text-bad" },
  modificada: { label: "Cambió", className: "text-warn" },
  igual: { label: "Igual", className: "text-fg-3" },
} as const;

const FIELD_LABELS: Record<string, string> = { date: "fecha", qty: "cantidad", pax: "pasajeros", unit_price: "precio", total: "total" };

export function QuoteCompare({ code, versions, currency }: { code: string; versions: number[]; currency: string }) {
  const [open, setOpen] = useState(false);
  const [a, setA] = useState(String(versions[1] ?? versions[0]));
  const [b, setB] = useState(String(versions[0]));
  const [comparison, setComparison] = useState<QuoteComparison | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const options = versions.map((number) => ({ value: String(number), label: `Versión ${number}` }));

  useEffect(() => {
    if (!open || a === b) return;
    startTransition(async () => {
      const result = await compareVersions(code, Number(a), Number(b));
      setComparison(result.comparison);
      setMessage(result.message);
    });
  }, [open, code, a, b]);

  if (versions.length < 2) return null;

  const delta = comparison?.summary.grand_delta ?? null;

  return (
    <>
      <Button variant="ghost" size="sm" icon={<GitCompareArrows size={15} />} onClick={() => setOpen(true)} data-testid="quote-compare">
        Comparar versiones
      </Button>
      <SidePanel open={open} onOpenChange={setOpen} title="Comparar versiones" description="Las líneas se emparejan por producto y segmento.">
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <Select value={a} onChange={setA} options={options} ariaLabel="Versión anterior" className="flex-1" testId="field:a" />
            <ArrowRight size={16} className="flex-none text-fg-3" />
            <Select value={b} onChange={setB} options={options} ariaLabel="Versión nueva" className="flex-1" testId="field:b" />
          </div>
          {a === b && <p className="text-[13px] text-fg-3">Elige dos versiones distintas.</p>}
          <FormError message={message} />
          {pending && !comparison && <p className="py-8 text-center text-[13px] text-fg-3">Comparando…</p>}
          {comparison && a !== b && (
            <>
              <div className="grid grid-cols-2 gap-2" data-testid="quote-compare-summary">
                {[comparison.a, comparison.b].map((side) => (
                  <div key={side.number} className="rounded-xl border border-line-2 bg-surface-2 px-3.5 py-3">
                    <p className="text-[12px] text-fg-3">{`Versión ${side.number} · descuento ${side.discount_pct} %`}</p>
                    <p className="mt-0.5 text-[17px] font-bold tracking-[-0.02em]" data-amount={side.totals.grand}>
                      {formatMoney(side.totals.grand, currency)}
                    </p>
                    {side.totals.margin_pct !== null && <p className="text-[12px] text-fg-2">{`Margen ${side.totals.margin_pct} %`}</p>}
                  </div>
                ))}
              </div>
              <p className="text-[13px] text-fg-2">
                {`${comparison.summary.added} agregadas · ${comparison.summary.removed} quitadas · ${comparison.summary.changed} con cambios`}
                {delta !== null && (
                  <b className={cn("ml-1 font-semibold", Number(delta) > 0 ? "text-ok" : Number(delta) < 0 ? "text-bad" : "text-fg-2")}>{` · total ${Number(delta) > 0 ? "+" : ""}${formatMoney(delta, currency)}`}</b>
                )}
              </p>
              <ul className="flex flex-col">
                {comparison.lines.map((line) => (
                  <li key={line.key} data-testid={`compare-line:${line.key}`} data-change={line.change} className="border-t border-line-2 py-2.5 text-[13px] first:border-t-0">
                    <div className="flex items-baseline gap-2">
                      <b className="min-w-0 flex-1 truncate font-semibold">{line.product.name}</b>
                      <span className={cn("flex-none text-[12px] font-semibold", CHANGE[line.change].className)}>{CHANGE[line.change].label}</span>
                    </div>
                    <p className="text-[12.5px] text-fg-3">
                      {line.segment}
                      {line.change === "modificada" && ` · cambió ${line.fields.map((field) => FIELD_LABELS[field] ?? field).join(", ")}`}
                    </p>
                    {(line.before || line.after) && (
                      <p className="mt-0.5 font-mono text-[12px] text-fg-2">
                        {line.before ? `${formatDate(line.before.date)} · ${line.before.pax} pax · ${formatMoney(line.before.total, currency)}` : "—"}
                        <ArrowRight size={12} className="mx-1.5 inline" />
                        {line.after ? `${formatDate(line.after.date)} · ${line.after.pax} pax · ${formatMoney(line.after.total, currency)}` : "—"}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </SidePanel>
    </>
  );
}
