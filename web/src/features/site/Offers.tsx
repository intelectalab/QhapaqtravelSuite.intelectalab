"use client";

import { Check, Copy, Tag, TicketPercent } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import type { OffersData, ProductCard as Product } from "@/lib/site";
import { siteHref } from "@/lib/site";
import { trackSiteEvent } from "@/lib/site-analytics";
import { Chip } from "./Bits";
import { ProductCard } from "./Cards";
import { Countdown } from "./Countdown";
import { useSite } from "./SiteContext";

export function OfferGrid({ offers, base }: { offers: Product[]; base: string }) {
  const { t } = useSite();
  return (
    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
      {offers.map((offer, index) => (
        <div key={offer.slug} className="flex flex-col gap-2">
          {offer.promotion && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[color-mix(in_srgb,var(--brand)_25%,transparent)] bg-[color-mix(in_srgb,var(--brand)_6%,var(--surface))] px-3.5 py-2.5">
              <span className="inline-flex items-center gap-2 text-[13px] font-semibold text-fg">
                <Tag size={14} className="text-brand" />
                {offer.promotion.name} · {offer.promotion.percent ? `${offer.promotion.value} %` : `S/ ${offer.promotion.value}`}
                {offer.promotion.code ? <Chip tone="brand">{t.home.promoCode(offer.promotion.code)}</Chip> : offer.promotion.min_pax ? <Chip tone="t4">{t.home.minPax(offer.promotion.min_pax)}</Chip> : null}
              </span>
              <Countdown until={offer.promotion.ends_at} />
            </div>
          )}
          <ProductCard product={offer} base={base} index={index} className="flex-1" />
        </div>
      ))}
    </div>
  );
}

function CodeCard({ item, base, index }: { item: OffersData["codes"][number]; base: string; index: number }) {
  const { t } = useSite();
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(item.code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };
  return (
    <div style={{ animationDelay: `${index * 70}ms` }} className="lift flex animate-[rise-in_420ms_cubic-bezier(0.22,1,0.36,1)_backwards] flex-col gap-3 rounded-2xl border border-dashed border-[color-mix(in_srgb,var(--brand)_40%,transparent)] bg-[color-mix(in_srgb,var(--brand)_5%,var(--surface))] p-4">
      <div className="flex items-start justify-between gap-3">
        <span className="grid h-10 w-10 flex-none place-items-center rounded-xl bg-brand text-white">
          <TicketPercent size={19} />
        </span>
        <Countdown until={item.ends_at} />
      </div>
      <div>
        <p className="text-[15px] font-bold text-fg">{t.offers.off(item.percent ? `${item.value} %` : `S/ ${item.value}`)}</p>
        <p className="text-[13px] text-fg-2">{item.name}</p>
        <Link href={siteHref(base, `/tours/${item.product.slug}`)} onClick={() => trackSiteEvent("select_promotion", { item_id: item.product.slug, promotion_name: item.name, promotion_code: item.code })} className="text-[13px] font-semibold text-brand hover:underline">
          {t.offers.forProduct(item.product.name)}
        </Link>
      </div>
      <button type="button" onClick={copy} className="mt-auto flex items-center justify-between gap-3 rounded-xl border border-line bg-surface px-3.5 py-2.5 font-mono text-[14px] font-bold tracking-wider text-fg transition hover:border-brand">
        {item.code}
        <span className="inline-flex items-center gap-1 font-sans text-[12.5px] font-semibold tracking-normal text-brand">
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? t.offers.copied : t.offers.copy}
        </span>
      </button>
    </div>
  );
}

export function PromoCodes({ codes, base }: { codes: OffersData["codes"]; base: string }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {codes.map((item, index) => (
        <CodeCard key={`${item.code}-${item.product.slug}`} item={item} base={base} index={index} />
      ))}
    </div>
  );
}
