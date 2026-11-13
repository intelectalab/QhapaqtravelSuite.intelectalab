"use client";

import { Check, TriangleAlert, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";
import { setMinimumPassengers, type ProductActionState } from "@/app/(backoffice)/catalogo/productos/actions";
import { Button } from "@/components/ui/Button";
import { InfoTip } from "@/components/ui/InfoTip";
import { TextField } from "@/components/ui/TextField";
import { cn } from "@/lib/cn";
import type { CostBreakdown } from "@/lib/catalog";
import { formatMoney } from "@/lib/format";

const RISE = "animate-[rise-in_420ms_cubic-bezier(0.22,1,0.36,1)_backwards]";

export function CostPerPerson({ breakdown, compact = false, className, adjust }: { breakdown: CostBreakdown; compact?: boolean; className?: string; adjust?: { code: string; lockVersion: number } }) {
  const price = breakdown.price === null ? null : Number(breakdown.price);
  const top = Math.max(...breakdown.groups.map((group) => Number(group.cost)), price ?? 0) || 1;
  const eachItems = breakdown.items.filter((item) => item.per_person);
  const sharedItems = breakdown.items.filter((item) => !item.per_person);
  const hasShared = Number(breakdown.shared) > 0;
  const viajeros = (n: number) => (n === 1 ? "1 viajero" : `${n} viajeros`);

  return (
    <section data-testid="cost-per-person" className={cn("rounded-[14px] border border-line bg-surface p-4", className)}>
      <header>
        <p className="flex items-center gap-1.5 text-[13.5px] font-semibold text-fg">
          <Users size={15} className="text-accent" />
          Costo por viajero según el tamaño del grupo
        </p>
        <p className="mt-0.5 text-[12.5px] text-fg-3">Cuánto le cuesta a la agencia cada viajero de una salida. El producto acepta de {breakdown.min_pax} a {breakdown.max_pax} viajeros. Lo que está en dólares se pasa a soles.</p>
      </header>

      <div className={cn("mt-4 grid gap-3", !compact && hasShared && "grid-cols-[repeat(auto-fit,minmax(260px,1fr))]")}>
        <CostGroup title="Se paga por cada viajero" hint="Cada viajero suma este costo." items={eachItems} total={`${formatMoney(breakdown.per_person)} por viajero`} />
        {hasShared && <CostGroup title="Se paga una vez por salida" hint="Se reparte entre los viajeros: con más gente, toca menos a cada uno." items={sharedItems} total={`${formatMoney(breakdown.shared)} por salida`} />}
      </div>

      <div className="mt-5 flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-[13px] font-semibold text-fg">Costo de cada viajero según cuántos van</p>
        {price !== null && (
          <p className="text-[12.5px] text-fg-3">
            Precio de venta: <b className="font-semibold text-fg">{formatMoney(price)}</b> por viajero
            <InfoTip label="Precio de venta" className="ml-1 align-middle">Es la tarifa pública vigente hoy (canal Directo), sin temporada. Si cambia la tarifa, cambian el margen y el aviso.</InfoTip>
          </p>
        )}
      </div>

      <ul className={cn("mt-2 grid gap-2", compact ? "grid-cols-1" : "grid-cols-[repeat(auto-fill,minmax(168px,1fr))]")}>
        {breakdown.groups.map((group, index) => {
          const cost = Number(group.cost);
          const profit = group.profit === null ? null : Number(group.profit);
          const loses = profit !== null && profit < 0;
          return (
            <li key={group.pax} data-testid={`cost-group:${group.pax}`} className={cn("flex flex-col rounded-[12px] border p-3 transition hover:-translate-y-0.5 hover:shadow-[0_10px_24px_-16px_rgb(14_17_32/0.4)]", loses ? "border-[color-mix(in_srgb,var(--bad)_35%,transparent)] bg-[color-mix(in_srgb,var(--bad)_4%,var(--surface))]" : "border-line", RISE)} style={{ animationDelay: `${index * 50}ms` }}>
              <p className="text-[12px] font-semibold text-fg-2">{viajeros(group.pax)}</p>
              <dl className="mt-2 grid gap-0.5 whitespace-nowrap text-[12px] tabular-nums text-fg-3">
                <div className="flex justify-between gap-2"><dt>Por viajero</dt><dd>{formatMoney(breakdown.per_person)}</dd></div>
                {hasShared && <div className="flex justify-between gap-2"><dt>{formatMoney(breakdown.shared)} ÷ {group.pax}</dt><dd>+ {formatMoney(group.shared_share)}</dd></div>}
                <div className="mt-1 flex justify-between gap-2 border-t border-line pt-1 text-[14.5px] font-semibold text-fg"><dt className="text-[12px] font-medium text-fg-2">Costo</dt><dd>{formatMoney(cost)}</dd></div>
              </dl>
              <span className="relative mt-2.5 block h-1.5 rounded-full bg-surface-2" title={price !== null ? `Costo ${formatMoney(cost)} frente al precio ${formatMoney(price)}` : undefined}>
                <span className={cn("block h-full rounded-full transition-[width] duration-700", loses ? "bg-bad" : "bg-accent")} style={{ width: `${Math.min(100, (cost / top) * 100)}%` }} />
                {price !== null && <span aria-hidden className="absolute -top-1 h-3.5 w-0.5 rounded-full bg-fg" style={{ left: `calc(${Math.min(100, (price / top) * 100)}% - 1px)` }} />}
              </span>
              {profit !== null && (
                <p className={cn("mt-2 text-[12px] font-semibold leading-snug", loses ? "text-bad" : "text-ok")}>
                  {loses ? `Pierde ${formatMoney(Math.abs(profit))} por viajero` : `Gana ${formatMoney(profit)} por viajero`}
                  <span className="block text-[11px] font-medium opacity-80">{loses ? `${Math.abs(Number(group.margin_pct))} % del precio` : `Margen ${group.margin_pct} %`}</span>
                </p>
              )}
            </li>
          );
        })}
      </ul>
      {price !== null && <p className="mt-2 flex items-center gap-1.5 text-[11.5px] text-fg-3"><span aria-hidden className="inline-block h-3 w-0.5 rounded-full bg-fg" /> La rayita marca el precio de venta: si la barra la pasa, ese grupo cuesta más de lo que paga.</p>}

      {price !== null && (
        <p className={cn("mt-3 flex items-start gap-2 text-[12.5px]", breakdown.loses_at_min ? "text-bad" : "text-fg-2")}>
          {breakdown.loses_at_min && <TriangleAlert size={15} className="mt-0.5 flex-none" />}
          {verdict(breakdown, price)}
        </p>
      )}

      {adjust && <MinimumForm breakdown={breakdown} adjust={adjust} />}
    </section>
  );
}

const IDLE: ProductActionState = { message: null, done: false };

function MinimumForm({ breakdown, adjust }: { breakdown: CostBreakdown; adjust: { code: string; lockVersion: number } }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(setMinimumPassengers, IDLE);
  const suggested = breakdown.loses_at_min && breakdown.break_even !== null && breakdown.break_even <= breakdown.max_pax ? breakdown.break_even : breakdown.min_pax;

  useEffect(() => {
    if (state.done) router.refresh();
  }, [state, router]);

  return (
    <form action={action} data-testid="minimum-passengers-form" className="mt-4 flex flex-wrap items-end gap-3 border-t border-line pt-4">
      <input type="hidden" name="code" value={adjust.code} />
      <input type="hidden" name="lock_version" value={adjust.lockVersion} />
      <TextField label="Mínimo de viajeros por salida" name="minimum_passengers" type="number" inputMode="numeric" min={1} max={breakdown.max_pax} defaultValue={suggested} required className="w-[200px]" hint={`Hoy es ${breakdown.min_pax}. Se guarda en la bitácora.`} error={state.message ?? undefined} />
      <Button type="submit" variant="primary" size="md" disabled={pending} icon={<Check size={15} />} className="mb-[22px]">
        {pending ? "Guardando…" : "Guardar mínimo"}
      </Button>
    </form>
  );
}

function verdict(breakdown: CostBreakdown, price: number): string {
  const costAt = (pax: number) => Number(breakdown.per_person) + Number(breakdown.shared) / pax;
  const who = (pax: number) => (pax === 1 ? "1 viajero" : `${pax} viajeros`);
  const min = breakdown.min_pax;
  if (breakdown.break_even === null) return `Con un precio de ${formatMoney(price)} ningún grupo cubre el costo: solo lo que se paga por cada viajero ya suma ${formatMoney(breakdown.per_person)}. Hay que subir la tarifa.`;
  if (!breakdown.loses_at_min) return `Desde ${who(breakdown.break_even)} el precio de ${formatMoney(price)} cubre el costo de cada viajero.`;
  const loss = (costAt(min) - price) * min;
  const even = breakdown.break_even;
  const tail = even > breakdown.max_pax ? `Recién con ${who(even)} se cubriría, y eso es más que el máximo del producto.` : `Con ${who(even)} el costo baja a ${formatMoney(Math.round(costAt(even) * 100) / 100)} por viajero y ya se gana.`;
  return `Con ${who(min)} (el mínimo) cada viajero cuesta ${formatMoney(Math.round(costAt(min) * 100) / 100)} y paga ${formatMoney(price)}: la salida pierde ${formatMoney(Math.round(loss * 100) / 100)} en total. ${tail} Sube el mínimo de viajeros o la tarifa.`;
}

function CostGroup({ title, hint, items, total }: { title: string; hint: string; items: CostBreakdown["items"]; total: string }) {
  return (
    <div className="rounded-[12px] bg-surface-2/60 p-3">
      <p className="text-[12.5px] font-semibold text-fg">{title}</p>
      <p className="text-[11.5px] text-fg-3">{hint}</p>
      <ul className="mt-2 grid gap-1 text-[12.5px]">
        {items.map((item, index) => (
          <li key={`${item.name}-${index}`} className="flex justify-between gap-3">
            <span className="min-w-0 truncate text-fg-2" title={item.name}>{item.name}</span>
            <span className="flex-none tabular-nums text-fg">{formatMoney(item.amount)}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 flex justify-between gap-3 border-t border-line pt-1.5 text-[12.5px] font-semibold text-fg">
        <span>Total</span>
        <span className="tabular-nums">{total}</span>
      </p>
    </div>
  );
}

