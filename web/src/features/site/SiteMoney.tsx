"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { setSiteCurrency } from "@/app/(sitio)/sitio/[agencia]/actions";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/format";
import { convertForDisplay } from "@/lib/site";
import { trackSiteEvent } from "@/lib/site-analytics";
import { useSite } from "./SiteContext";

export function CurrencySwitch() {
  const { agencia, currency, t } = useSite();
  const router = useRouter();
  const [pending, start] = useTransition();
  const options = currency?.currencies ?? [];
  if (options.length < 2) return null;
  const selected = currency?.selected ?? options[0].code;
  return (
    <div role="group" aria-label={t.header.currency} className={cn("hidden h-10 items-center rounded-xl border border-line p-0.5 transition-opacity sm:flex", pending && "opacity-60")}>
      {options.map((option) => (
        <button
          key={option.code}
          type="button"
          aria-pressed={selected === option.code}
          title={option.name}
          data-testid={`site-currency:${option.code}`}
          onClick={() => {
            if (option.code === selected) return;
            trackSiteEvent("select_currency", { currency: option.code, previous: selected });
            start(async () => {
              await setSiteCurrency(agencia, option.code);
              router.refresh();
            });
          }}
          className={cn("h-full rounded-[9px] px-2.5 text-[12px] font-bold tracking-wide transition", selected === option.code ? "bg-brand text-brand-fg" : "text-fg-3 hover:text-fg")}
        >
          {option.code}
        </button>
      ))}
    </div>
  );
}

export function Referential({ amount, currency, className }: { amount: number | string | null | undefined; currency: string | null | undefined; className?: string }) {
  const { currency: settings, t } = useSite();
  const selected = settings?.selected;
  if (!settings || !selected || !currency || amount === null || amount === undefined || selected === currency) return null;
  const value = convertForDisplay(Number(amount), currency, selected, settings);
  if (value === null) return null;
  return (
    <span data-testid="site-referential" title={t.header.paidIn(currency)} className={cn("block text-[11.5px] font-normal text-fg-3", className)}>
      {t.header.approx(formatMoney(value, selected))} · {t.header.paidShort(currency)}
    </span>
  );
}
