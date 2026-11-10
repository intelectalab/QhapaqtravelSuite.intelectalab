"use client";

import { useState } from "react";
import { StatusBadge } from "@/components/ui/Badge";
import { DownloadButton } from "@/components/ui/DownloadButton";
import { SOFT_TINT } from "@/components/ui/Tinted";
import { cn } from "@/lib/cn";
import { formatDate, formatMoney } from "@/lib/format";
import type { QuoteVersion } from "@/lib/quotes";

export function QuoteVersions({ code, versions, currency, seeMargin }: { code: string; versions: QuoteVersion[]; currency: string; seeMargin: boolean }) {
  const [selected, setSelected] = useState(versions[0]?.number);
  const version = versions.find((item) => item.number === selected) ?? versions[0];

  if (!version) return <p className="text-[13.5px] text-fg-3">Esta cotización no tiene versiones.</p>;

  return (
    <div>
      {versions.length > 1 && (
        <div role="tablist" className="mb-4 flex w-fit gap-1 rounded-control bg-surface-2 p-1">
          {versions.map((item) => (
            <button
              key={item.number}
              type="button"
              role="tab"
              aria-selected={item.number === version.number}
              onClick={() => setSelected(item.number)}
              className={cn("rounded-[10px] px-3 py-1.5 text-[12.5px] font-semibold transition-[background-color,color,box-shadow] duration-300", item.number === version.number ? "bg-surface text-fg shadow-card" : "text-fg-3 hover:text-fg")}
            >
              Versión {item.number}
            </button>
          ))}
        </div>
      )}

      <div key={version.number} className="motion-safe:animate-[drop-in_240ms_ease-out_backwards]">
        <p className="mb-3 flex flex-wrap items-center gap-2 text-[12.5px] text-fg-3">
          <StatusBadge status={version.status} />
          <span>
            Emitida el {formatDate(version.issued_on)} por {version.author}
          </span>
          <DownloadButton href={`/cotizaciones/${code}/pdf/${version.number}`} label={`PDF de la versión ${version.number}`} size="sm" variant="ghost" className="ml-auto" />
        </p>
        {version.notes && <p className={cn("mb-3 rounded-[12px] px-3.5 py-2.5 text-[13px] text-fg-2", SOFT_TINT)}>{version.notes}</p>}

        <ul className="flex flex-col gap-1.5">
          {version.items.map((item) => (
            <li key={item.line} className="group/item grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-[12px] border border-line-2 px-3.5 py-2.5 transition-[background-color,border-color] duration-300 hover:border-[color-mix(in_srgb,var(--tint)_35%,transparent)] hover:bg-[color-mix(in_srgb,var(--tint)_5%,var(--surface))]">
              <span className="min-w-0 transition-transform duration-300 group-hover/item:translate-x-0.5">
                <b className="block truncate text-[13.5px] font-semibold">{item.product.name}</b>
                <span className="text-xs text-fg-3">
                  {formatDate(item.date)} · {item.pax} {item.segment.toLowerCase()}
                  {item.pax === 1 ? "" : "s"}
                  {item.qty > 1 ? ` × ${item.qty}` : ""} · {formatMoney(item.unit_price, currency)} c/u
                </span>
              </span>
              <span className="text-right">
                <b className="block font-mono text-[13.5px]">{formatMoney(item.total, currency)}</b>
                {item.margin_pct !== null && <span className={cn("text-[11.5px] font-medium", Number(item.margin_pct) < 15 ? "text-warn" : "text-ok")}>{item.margin_pct} % margen</span>}
              </span>
            </li>
          ))}
        </ul>

        <dl className="mt-4 ml-auto flex max-w-[340px] flex-col gap-1.5 text-[13px]">
          <div className="flex justify-between">
            <dt className="text-fg-3">Subtotal</dt>
            <dd className="font-mono">{formatMoney(version.totals.sale, currency)}</dd>
          </div>
          {Number(version.totals.discount) > 0 && (
            <div className="flex justify-between">
              <dt className="text-fg-3">Descuento ({version.discount_pct} %)</dt>
              <dd className="font-mono text-bad">− {formatMoney(version.totals.discount, currency)}</dd>
            </div>
          )}
          <div className="flex justify-between">
            <dt className="text-fg-3">IGV ({version.tax_pct} %)</dt>
            <dd className="font-mono">{formatMoney(version.totals.tax, currency)}</dd>
          </div>
          <div className="flex justify-between border-t border-line-2 pt-1.5 text-[15px] font-bold">
            <dt>Total</dt>
            <dd className="font-mono">{formatMoney(version.totals.grand, currency)}</dd>
          </div>
          {seeMargin && version.totals.margin_pct !== null && (
            <div className="flex justify-between text-[12.5px]">
              <dt className="text-fg-3">Utilidad</dt>
              <dd className={cn("font-mono font-semibold", Number(version.totals.margin_pct) < 15 ? "text-warn" : "text-ok")}>
                {formatMoney(version.totals.profit ?? 0, currency)} · {version.totals.margin_pct} %
              </dd>
            </div>
          )}
        </dl>
      </div>
    </div>
  );
}
