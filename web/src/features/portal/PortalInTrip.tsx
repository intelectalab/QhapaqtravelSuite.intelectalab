"use client";

import { Bus, CreditCard, ExternalLink, Loader2, Mountain, Route } from "lucide-react";
import { useState, useTransition } from "react";
import { buyInTrip } from "@/app/(portal)/portal/actions";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { SidePanel } from "@/components/ui/SidePanel";
import { cn } from "@/lib/cn";
import { formatDate, formatMoney } from "@/lib/format";
import { toneStyle } from "@/lib/tone";
import { OFFER_TONES, type InTripAvailable, type InTripItem } from "@/lib/trip";
import { EmptyLine, RISE, rise, SectionCard } from "./PortalUi";

export function PortalInTrip({ code, data }: { code: string; data: InTripAvailable }) {
  const [picked, setPicked] = useState<InTripItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const open = data.offers.filter((offer) => offer.status === "link_enviado" && offer.payment_link?.url);

  if (!data.enabled && data.offers.length === 0) return null;

  const confirm = () => {
    if (!picked) return;
    setError(null);
    start(async () => {
      const result = await buyInTrip(code, picked.kind, picked.item_id);
      if (!result.done) {
        setError(result.message);
        return;
      }
      setLink(result.url);
    });
  };

  return (
    <SectionCard icon={Route} title="Agregar en ruta" aside={data.enabled ? `${data.items.length} disponibles` : undefined}>
      <p className="mb-3 text-[13px] text-fg-2">Suma tours y movilidad de las ciudades que te faltan. Se reservan hasta {data.min_hours_before} h antes; pagas con un link seguro y el voucher llega cuando el proveedor confirma.</p>
      {!data.enabled && data.reason && <EmptyLine>{data.reason}</EmptyLine>}
      {data.enabled && data.items.length === 0 && <EmptyLine>Ya tienes todo lo disponible para los tramos que faltan.</EmptyLine>}
      {data.items.length > 0 && (
        <ul className="grid gap-2 sm:grid-cols-2">
          {data.items.map((item, index) => {
            const Icon = item.kind === "tour" ? Mountain : Bus;
            return (
              <li key={`${item.kind}-${item.item_id}`} style={{ ...rise(index), ...toneStyle(item.kind === "tour" ? "t3" : "t4") }} className={cn("lift group flex flex-col gap-2 rounded-tile border border-line bg-surface p-3.5", RISE)}>
                <span className="flex items-start gap-3">
                  <span className="grid h-9 w-9 flex-none place-items-center rounded-[10px] bg-[color-mix(in_srgb,var(--tint)_14%,transparent)] text-[var(--tint)] transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110">
                    <Icon size={17} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <b className="block text-[13.5px] font-semibold leading-snug">{item.name}</b>
                    <span className="text-[12px] text-fg-3">
                      {item.city} · {formatDate(item.date)}
                      {item.time ? ` · ${item.time}` : ""}
                      {item.vehicle ? ` · ${item.units && item.units > 1 ? `${item.units} × ` : ""}${item.vehicle}` : ""}
                    </span>
                  </span>
                </span>
                <span className="mt-auto flex items-center justify-between gap-2">
                  <b className="text-[15px] tabular-nums">{formatMoney(item.amount, item.currency)}</b>
                  <Button size="sm" variant="primary" icon={<CreditCard size={14} />} onClick={() => { setPicked(item); setLink(null); setError(null); }}>
                    Agregar y pagar
                  </Button>
                </span>
              </li>
            );
          })}
        </ul>
      )}
      {data.offers.length > 0 && (
        <div className="mt-4 border-t border-line pt-3">
          <p className="mb-2 text-[12.5px] font-semibold text-fg-2">Tus compras en ruta</p>
          <ul className="grid gap-1.5">
            {data.offers.map((offer) => (
              <li key={offer.code} className="flex flex-wrap items-center justify-between gap-2 text-[13px]">
                <span className="min-w-0">
                  <b className="font-semibold">{offer.name}</b> <span className="text-fg-3">· {formatDate(offer.service_date)}</span>
                </span>
                <span className="flex items-center gap-2">
                  <span className="tabular-nums">{formatMoney(offer.amount, offer.currency)}</span>
                  <Badge tone={OFFER_TONES[offer.status]}>{offer.status_label}</Badge>
                  {open.includes(offer) && offer.payment_link?.url && (
                    <a href={offer.payment_link.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-t1 hover:underline">
                      Pagar <ExternalLink size={12} />
                    </a>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <SidePanel
        open={picked !== null}
        onOpenChange={(value) => !value && setPicked(null)}
        title="Agregar en ruta"
        description={picked ? `${picked.name} · ${formatDate(picked.date, "long")}` : undefined}
        footer={
          link ? (
            <Button variant="primary" href={link} target="_blank" icon={<ExternalLink size={15} />}>
              Abrir link de pago
            </Button>
          ) : (
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setPicked(null)}>
                Cancelar
              </Button>
              <Button variant="primary" onClick={confirm} disabled={pending} icon={pending ? <Loader2 size={15} className="animate-spin" /> : <CreditCard size={15} />}>
                Generar link de pago
              </Button>
            </div>
          )
        }
      >
        {picked && (
          <dl className="grid gap-3 text-[13.5px]">
            <div className="flex justify-between gap-3">
              <dt className="text-fg-3">Ciudad</dt>
              <dd className="font-medium">{picked.from_city ? `${picked.from_city} → ${picked.city}` : picked.city}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-fg-3">Fecha</dt>
              <dd className="font-medium">
                {formatDate(picked.date, "long")}
                {picked.time ? ` · ${picked.time}` : ""}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-fg-3">Pasajeros</dt>
              <dd className="font-medium">
                {picked.adults} {picked.adults === 1 ? "adulto" : "adultos"}
                {picked.children > 0 ? ` · ${picked.children} ${picked.children === 1 ? "niño" : "niños"}` : ""}
              </dd>
            </div>
            <div className="flex justify-between gap-3 border-t border-line pt-3">
              <dt className="font-semibold">Precio</dt>
              <dd className="text-[18px] font-bold tabular-nums">{formatMoney(picked.amount, picked.currency)}</dd>
            </div>
            <p className="rounded-tile bg-surface-2 px-3 py-2.5 text-[12.5px] text-fg-2">El precio queda congelado hasta el plazo de compra. Si el proveedor no confirma, te devolvemos el pago completo.</p>
            {link && <p className="rounded-tile bg-[color-mix(in_srgb,var(--ok)_10%,var(--surface))] px-3 py-2.5 text-[12.5px] font-medium text-ok">Listo: tu link de pago está generado. Ábrelo para pagar con tarjeta.</p>}
            {error && <p className="rounded-tile bg-[color-mix(in_srgb,var(--bad)_8%,transparent)] px-3 py-2.5 text-[12.5px] text-bad">{error}</p>}
          </dl>
        )}
      </SidePanel>
    </SectionCard>
  );
}
