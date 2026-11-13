"use client";

import { Bus, Compass, Link2, Route, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { cancelInTripOffer, offerInTrip } from "@/app/(backoffice)/reservas/tramos-actions";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { InfoTip } from "@/components/ui/InfoTip";
import { PanelAction } from "@/components/ui/PanelAction";
import { SelectField } from "@/components/ui/SelectField";
import { ConfirmAction, HiddenFields, STEP_INITIAL } from "@/features/catalog-shared/CatalogPanels";
import { cn } from "@/lib/cn";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import type { StepResult } from "@/lib/server/resource";
import { toneStyle } from "@/lib/tone";
import { OFFER_TONES, TRIP_CATEGORIES, type InTripAvailable, type ReservationTripView } from "@/lib/trip";

const CHANNELS = [
  { value: "whatsapp", label: "WhatsApp" },
  { value: "email", label: "Correo" },
  { value: "portal", label: "Portal del cliente" },
  { value: "asesor", label: "Lo envío yo (copiar link)" },
];

function OfferAction({ trip, available }: { trip: ReservationTripView; available: InTripAvailable }) {
  const router = useRouter();
  return (
    <PanelAction<StepResult>
      label="Ofrecer en ruta"
      icon={<Send size={15} />}
      variant="primary"
      size="sm"
      formId="trip-offer"
      title="Ofrecer en ruta"
      description={`El precio lo calcula el servidor y queda congelado hasta ${available.min_hours_before} h antes del servicio. El pasajero paga con un link seguro.`}
      submitLabel="Crear oferta y link"
      action={offerInTrip}
      initial={STEP_INITIAL}
      onDone={() => router.refresh()}
    >
      {() => (
        <>
          <HiddenFields values={{ reservation: trip.reservation.code }} />
          <SelectField label="Servicio" name="item" searchable defaultValue={available.items[0] ? `${available.items[0].kind}:${available.items[0].item_id}` : ""} options={available.items.map((item) => ({ value: `${item.kind}:${item.item_id}`, label: `${formatDate(item.date)} · ${item.city} · ${item.name} · ${formatMoney(item.amount, item.currency)}` }))} />
          <SelectField label="Canal" name="channel" defaultValue="whatsapp" options={CHANNELS} />
        </>
      )}
    </PanelAction>
  );
}

export function ReservationTripSection({ trip, available }: { trip: ReservationTripView; available: InTripAvailable | null }) {
  const total = Number(trip.by_category.total) || 0;
  const categories = TRIP_CATEGORIES.map((category) => ({ ...category, amount: Number(trip.by_category.categories[category.key] ?? 0) })).filter((category) => category.amount > 0);

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-[15px] font-semibold">
            <Route size={16} className="text-t1" /> Viaje por tramos
          </h2>
          <span className="text-[12.5px] text-fg-3">
            {trip.legs.length} ciudades · termina el {trip.trip_end ? formatDate(trip.trip_end, "long") : "—"}
          </span>
        </div>
        <ol className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {trip.legs.map((leg) => (
            <li key={leg.id} className="lift rounded-[14px] border border-line p-3.5">
              <p className="flex items-baseline justify-between gap-2">
                <b className="text-[14px] font-semibold">{leg.city}</b>
                <span className="text-[12px] text-fg-3">{leg.nights} noche(s)</span>
              </p>
              <p className="text-[12px] text-fg-3">
                {formatDate(leg.check_in)} → {formatDate(leg.check_out)}
              </p>
              <ul className="mt-2 flex flex-col gap-1.5">
                {leg.items.map((item) => {
                  const Icon = item.kind === "tour" ? Compass : Bus;
                  return (
                    <li key={item.id} style={toneStyle(item.kind === "tour" ? "t3" : "t4")} className="flex items-start gap-2 rounded-lg bg-[color-mix(in_srgb,var(--tint)_8%,transparent)] px-2.5 py-1.5 text-[12.5px]">
                      <Icon size={13} className="mt-0.5 flex-none text-[var(--tint)]" />
                      <span className="min-w-0 flex-1">
                        <b className="block font-semibold leading-snug">{item.name}</b>
                        <span className="text-fg-3">
                          {formatDate(item.service_date)}
                          {item.start_time ? ` · ${item.start_time}` : ""} · {formatMoney(item.amount, item.currency)}
                          {item.sold_in_trip ? " · en ruta" : ""}
                        </span>
                      </span>
                    </li>
                  );
                })}
                {leg.items.length === 0 && <li className="text-[12px] text-fg-3">Sin tours ni movilidad.</li>}
              </ul>
            </li>
          ))}
        </ol>
      </Card>

      {categories.length > 0 && (
        <Card>
          <p className="mb-3 flex items-center gap-1.5 text-[13.5px] font-semibold">
            Gasto por categoría
            <InfoTip label="De dónde sale">Se suman las líneas cotizadas al reservar (tour base, alojamiento, tours, movilidad, adicionales y recargos) y lo comprado en ruta. Si la reserva no vino del sitio, se usan los servicios de la reserva.</InfoTip>
          </p>
          <div className="flex h-3 overflow-hidden rounded-full bg-surface-2">
            {categories.map((category) => (
              <span key={category.key} style={{ ...toneStyle(category.tone), width: `${(category.amount / total) * 100}%` }} className="h-full bg-[var(--tint)] transition-all duration-500" title={`${category.label} · ${formatMoney(category.amount, trip.by_category.currency)}`} />
            ))}
          </div>
          <ul className="mt-3 grid gap-2 sm:grid-cols-3 xl:grid-cols-6">
            {categories.map((category) => (
              <li key={category.key} style={toneStyle(category.tone)} className="lift rounded-tile border border-line px-3 py-2">
                <span className="flex items-center gap-1.5 text-[12px] text-fg-3">
                  <span className="h-2 w-2 rounded-full bg-[var(--tint)]" />
                  {category.label}
                </span>
                <b className="block font-mono text-[14px] tabular-nums">{formatMoney(category.amount, trip.by_category.currency)}</b>
                <span className="text-[11.5px] text-fg-3">{Math.round((category.amount / total) * 100)} %</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[15px] font-semibold">Venta en ruta</h2>
          {available?.enabled && available.items.length > 0 && <OfferAction trip={trip} available={available} />}
        </div>
        {available && !available.enabled && available.reason && <p className="mb-3 rounded-tile bg-surface-2 px-3 py-2 text-[12.5px] text-fg-2">{available.reason}</p>}
        {available?.enabled && <p className="mb-3 text-[12.5px] text-fg-3">{available.items.length} servicio(s) disponibles para los tramos que faltan, con al menos {available.min_hours_before} h de anticipación.</p>}
        {trip.offers.length === 0 ? (
          <p className="rounded-[14px] border border-dashed border-line px-4 py-6 text-center text-[13px] text-fg-3">Todavía no hay ofertas en ruta.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {trip.offers.map((offer) => (
              <li key={offer.code} className={cn("lift flex flex-wrap items-center gap-3 rounded-[14px] border border-line px-4 py-3", !offer.cancellable && offer.status !== "confirmada" && "opacity-70")}>
                <span className="min-w-0 flex-1">
                  <b className="block text-[13.5px] font-semibold">{offer.name}</b>
                  <span className="text-[12px] text-fg-3">
                    {offer.code} · {formatDate(offer.service_date)} · {offer.channel} · vence {formatDateTime(offer.expires_at, false)}
                  </span>
                </span>
                <b className="font-mono tabular-nums">{formatMoney(offer.amount, offer.currency)}</b>
                <Badge tone={OFFER_TONES[offer.status]}>{offer.status_label}</Badge>
                {offer.payment_link?.url && offer.cancellable && (
                  <a href={offer.payment_link.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-t1 hover:underline">
                    <Link2 size={13} /> {offer.payment_link.code}
                  </a>
                )}
                {offer.cancellable && <ConfirmAction id={`offer-cancel-${offer.code}`} label="Cancelar oferta" title="Cancelar oferta en ruta" description={`${offer.name}: el link de pago se anula y el servicio vuelve a estar disponible.`} submitLabel="Cancelar oferta" action={cancelInTripOffer} hidden={{ reservation: trip.reservation.code, offer: offer.code }} />}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
