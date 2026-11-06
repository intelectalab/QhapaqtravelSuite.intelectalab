"use client";

import { CalendarDays, Clock3, Loader2, Lock, RefreshCw, Trash2, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { reholdCartLine, removeCartLine } from "@/app/(sitio)/sitio/[agencia]/actions";
import { cn } from "@/lib/cn";
import { capitalize, formatDate, formatMoney } from "@/lib/format";
import type { CartLine, SiteCart } from "@/lib/site";
import { useSite } from "./SiteContext";

function useNow(): number | null {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    const first = window.setTimeout(() => setNow(Date.now()), 0);
    return () => {
      window.clearInterval(timer);
      window.clearTimeout(first);
    };
  }, []);
  return now;
}

export function HoldTimer({ until, compact = false }: { until: string; compact?: boolean }) {
  const now = useNow();
  if (now === null) return null;
  const left = Math.max(0, new Date(until).getTime() - now);
  const minutes = Math.floor(left / 60_000);
  const seconds = Math.floor((left % 60_000) / 1000);
  const expired = left === 0;
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold tabular-nums", expired ? "bg-[color-mix(in_srgb,var(--bad)_10%,transparent)] text-bad" : minutes < 5 ? "bg-[color-mix(in_srgb,var(--warn)_14%,transparent)] text-warn" : "bg-[color-mix(in_srgb,var(--ok)_12%,transparent)] text-ok")}>
      <Clock3 size={13} />
      {expired ? "Bloqueo vencido" : `${compact ? "" : "Cupos bloqueados por "}${minutes}:${String(seconds).padStart(2, "0")}`}
    </span>
  );
}

function CartRow({ item, index }: { item: CartLine; index: number }) {
  const { agencia, href } = useSite();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (task: () => Promise<string | null>) =>
    start(async () => {
      const message = await task();
      setError(message);
      router.refresh();
    });
  const expired = item.hold?.status === "expirada";
  const pax = [item.pax.adults && `${item.pax.adults} ${item.pax.adults === 1 ? "adulto" : "adultos"}`, item.pax.children && `${item.pax.children} ${item.pax.children === 1 ? "niño" : "niños"}`, item.pax.infants && `${item.pax.infants} ${item.pax.infants === 1 ? "infante" : "infantes"}`].filter(Boolean).join(" · ");

  return (
    <li className={cn("rounded-card border border-line bg-surface p-5 shadow-card transition-opacity animate-[rise-in_420ms_cubic-bezier(0.22,1,0.36,1)_backwards]", pending && "opacity-60")} style={{ animationDelay: `${index * 60}ms` }}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link href={href(`/tours/${item.product.slug}?fecha=${item.date}`)} className="text-[16px] font-bold tracking-tight text-fg hover:text-brand">
            {item.product.name}
          </Link>
          <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-fg-2">
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays size={14} className="text-fg-3" />
              {capitalize(formatDate(item.date, "long"))}
              {item.quote?.departure?.time && ` · ${item.quote.departure.time} h`}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Users size={14} className="text-fg-3" />
              {pax}
            </span>
          </p>
        </div>
        <div className="text-right">
          {item.quote ? <b className="text-[18px] font-bold tabular-nums text-fg">{formatMoney(item.quote.total, item.quote.currency)}</b> : <span className="text-[13px] text-bad">No disponible</span>}
          {item.quote?.discount && <span className="block text-[12px] text-ok">{item.quote.discount.label}: − {formatMoney(item.quote.discount.amount, item.quote.currency)}</span>}
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
        <div className="flex flex-wrap items-center gap-2 text-[12px] text-fg-3">
          {item.hold ? (
            <>
              <HoldTimer until={item.hold.expires_at} />
              <span>Código {item.hold.ref}</span>
            </>
          ) : (
            <span className="inline-flex items-center gap-1.5">
              <Lock size={13} />
              Confirmación del operador en 24 h
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {item.hold && expired && (
            <button type="button" onClick={() => run(() => reholdCartLine(agencia, item.line))} className="inline-flex h-9 items-center gap-1.5 rounded-control border border-line px-3 text-[12.5px] font-semibold text-fg transition hover:border-accent hover:text-accent">
              <RefreshCw size={14} />
              Volver a bloquear
            </button>
          )}
          <button type="button" onClick={() => run(() => removeCartLine(agencia, item.line))} className="inline-flex h-9 items-center gap-1.5 rounded-control px-3 text-[12.5px] font-semibold text-fg-3 transition hover:bg-[color-mix(in_srgb,var(--bad)_8%,transparent)] hover:text-bad">
            {pending ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            Quitar
          </button>
        </div>
      </div>
      {(error || item.error) && <p className="mt-3 rounded-xl bg-[color-mix(in_srgb,var(--bad)_8%,transparent)] px-3 py-2 text-[12.5px] text-bad">{error ?? item.error}</p>}
    </li>
  );
}

export function CartLines({ cart }: { cart: SiteCart }) {
  return (
    <ul className="grid gap-4">
      {cart.items.map((item, index) => (
        <CartRow key={item.line} item={item} index={index} />
      ))}
    </ul>
  );
}

export function CartSummary({ cart, action }: { cart: SiteCart; action?: React.ReactNode }) {
  const holds = cart.items.map((item) => item.hold?.expires_at).filter((value): value is string => Boolean(value)).sort();
  return (
    <div className="rounded-card border border-line bg-surface p-5 shadow-card">
      <h2 className="text-[15px] font-semibold text-fg">Resumen</h2>
      <dl className="mt-3 grid gap-2 text-[13.5px]">
        {cart.totals.map((total) => (
          <div key={total.currency} className="grid gap-1.5">
            <div className="flex justify-between text-fg-2">
              <dt>Subtotal en {total.currency === "USD" ? "dólares" : "soles"}</dt>
              <dd className="tabular-nums">{formatMoney(total.subtotal, total.currency)}</dd>
            </div>
            {total.discount > 0 && (
              <div className="flex justify-between text-ok">
                <dt>Descuentos</dt>
                <dd className="tabular-nums">− {formatMoney(total.discount, total.currency)}</dd>
              </div>
            )}
            <div className="flex items-baseline justify-between border-t border-line pt-2">
              <dt className="font-semibold text-fg">Total</dt>
              <dd className="text-[20px] font-bold tabular-nums text-fg">{formatMoney(total.total, total.currency)}</dd>
            </div>
          </div>
        ))}
      </dl>
      {cart.totals.length > 1 && <p className="mt-2 text-[12px] text-fg-3">Tu carrito tiene productos en soles y en dólares; al pagar se convierte con el tipo de cambio del día (S/ {cart.fx.toFixed(3)}).</p>}
      {holds.length > 0 && (
        <p className="mt-4 flex flex-wrap items-center gap-2 text-[12.5px] text-fg-2">
          Tus cupos quedan bloqueados {cart.hold_minutes} minutos.
          <HoldTimer until={holds[0]} compact />
        </p>
      )}
      <p className="mt-3 text-[12px] text-fg-3">El precio final lo calcula el sistema según la fecha y la temporada.</p>
      {action}
    </div>
  );
}
