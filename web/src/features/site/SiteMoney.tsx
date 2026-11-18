"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { setSiteCurrency } from "@/app/(sitio)/sitio/[agencia]/actions";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/format";
import { convertForDisplay } from "@/lib/site";
import { trackSiteEvent } from "@/lib/site-analytics";
import { useSite } from "./SiteContext";

export function CurrencySwitch({ variant = "header" }: { variant?: "header" | "bar" }) {
  const { agencia, currency, t } = useSite();
  const router = useRouter();
  const [pending, start] = useTransition();
  const options = currency?.currencies ?? [];
  if (options.length < 2) return null;
  const selected = currency?.selected ?? options[0].code;
  return (
    <div role="group" aria-label={t.header.currency} className={cn("items-center border border-line p-0.5 transition-opacity", variant === "bar" ? "flex h-7 rounded-lg" : "hidden h-10 rounded-xl sm:flex xl:hidden", pending && "opacity-60")}>
      {options.map((option) => (
        <button
          key={option.code}
          type="button"
          aria-pressed={selected === option.code}
          title={option.name}
          data-testid={`${variant === "bar" ? "site-bar-currency" : "site-currency"}:${option.code}`}
          onClick={() => {
            if (option.code === selected) return;
            trackSiteEvent("select_currency", { currency: option.code, previous: selected });
            start(async () => {
              await setSiteCurrency(agencia, option.code);
              router.refresh();
            });
          }}
          className={cn("h-full font-bold tracking-wide transition", variant === "bar" ? "rounded-md px-2 text-[11px]" : "rounded-[9px] px-2.5 text-[12px]", selected === option.code ? "bg-brand text-brand-fg" : "text-fg-3 hover:text-fg")}
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
    <span data-testid="site-referential" title={t.header.paidIn(currency)} className={cn("block text-[11.5px] font-normal", className ?? "text-fg-3")}>
      {t.header.approx(formatMoney(value, selected))} · {t.header.paidShort(currency)}
    </span>
  );
}
