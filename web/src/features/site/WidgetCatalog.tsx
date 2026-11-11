"use client";

import { ChevronRight, MapPin } from "lucide-react";
import Link from "next/link";
import type { WidgetConfig } from "@/lib/site";
import { useSite } from "./SiteContext";

export function WidgetCatalog({ config, query }: { config: WidgetConfig; query: string }) {
  const { t } = useSite();
  return (
    <section>
      <p className="text-[12px] font-semibold text-fg-3">{t.widget.eyebrow}</p>
      <h1 className="mt-0.5 text-[22px] font-bold tracking-tight text-fg">{t.widget.catalogTitle}</h1>
      {config.products.length === 0 ? (
        <p className="mt-4 rounded-card bg-surface-2 px-4 py-3 text-[13.5px] text-fg-2">{t.widget.catalogEmpty}</p>
      ) : (
        <ul className="mt-4 grid gap-2.5 sm:grid-cols-2">
          {config.products.map((product) => (
            <li key={product.code}>
              <Link href={`/widget/${encodeURIComponent(product.code)}${query}`} className="lift group flex items-center gap-3 rounded-card border border-line bg-surface px-4 py-3.5 transition hover:border-accent">
                <span className="min-w-0 flex-1">
                  <b className="block truncate text-[14.5px] font-semibold text-fg">{product.name}</b>
                  <span className="mt-0.5 flex items-center gap-1.5 text-[12px] text-fg-3">
                    <MapPin size={12} />
                    {product.destination} · {product.category}
                  </span>
                </span>
                <ChevronRight size={17} className="text-fg-3 transition group-hover:translate-x-0.5 group-hover:text-accent" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
