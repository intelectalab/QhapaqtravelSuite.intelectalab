"use client";

import { BedDouble, CarFront, Clock, Lock, Plane, Plus, Search, ShieldCheck, Sparkles, Ticket, X } from "lucide-react";
import { useState, useTransition } from "react";
import { changeExternalOffer, searchExternalOffers } from "@/app/(backoffice)/cotizaciones/actions";
import { RowIcon } from "@/components/table/RowActions";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ChoiceGroup } from "@/components/ui/ChoiceGroup";
import { DateField } from "@/components/ui/DateField";
import { EmptyState } from "@/components/ui/EmptyState";
import { TextField } from "@/components/ui/TextField";
import { TintCardTitle } from "@/components/ui/Tinted";
import { toast } from "@/components/ui/Toast";
import { PlanNotice } from "@/features/growth/GrowthUi";
import { formatDateTime, formatMoney } from "@/lib/format";
import { OFFER_KINDS, OFFER_STATUS_TONE, PROVIDER_LABEL, offerExpiry, offerTotal, pendingIssue, type ExternalOffer, type ExternalOfferKind, type ExternalOfferResult, type ExternalOfferState } from "@/lib/external-offers";

const KIND_ICON: Record<ExternalOfferKind, typeof Plane> = { aereo: Plane, hotel: BedDouble, auto: CarFront, seguro: ShieldCheck };

function KindGlyph({ kind }: { kind: ExternalOfferKind }) {
  const Icon = KIND_ICON[kind];
  return (
    <span className="grid h-10 w-10 flex-none place-items-center rounded-xl bg-[color-mix(in_srgb,var(--tint,var(--accent))_12%,var(--surface))] text-[var(--tint,var(--accent))]">
      <Icon size={18} />
    </span>
  );
}

function OfferRow({ offer, busy, onHold, onRemove }: { offer: ExternalOffer; busy: boolean; onHold: () => void; onRemove: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const expiry = offer.status === "cotizada" || offer.status === "retenida" ? offerExpiry(offer.offer_expires_at) : null;
  return (
    <li data-testid="external-offer" data-status={offer.status} className="lift flex flex-wrap items-center gap-3 rounded-tile border border-line bg-surface p-3.5">
      <KindGlyph kind={offer.kind} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold leading-snug" title={offer.summary}>{offer.summary}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[12px] text-fg-3">
          <span>{offer.kind_label} · {PROVIDER_LABEL[offer.provider] ?? offer.provider}</span>
          {offer.pnr && <span className="font-mono font-semibold text-fg-2">PNR {offer.pnr}</span>}
          {expiry && (
            <span className="inline-flex items-center gap-1" title={offer.offer_expires_at ? formatDateTime(offer.offer_expires_at) : undefined}>
              <Clock size={12} /> {expiry.label}
            </span>
          )}
        </p>
      </div>
      <Badge tone={OFFER_STATUS_TONE[offer.status]} dot={false}>{offer.status_label}</Badge>
      <p className="w-28 text-right text-[15px] font-bold tabular-nums">{formatMoney(offer.sell_amount, offer.currency)}</p>
      <div className="flex items-center gap-1.5">
        {offer.can_hold && (
          <Button size="sm" variant="secondary" icon={<Lock size={14} />} onClick={onHold} disabled={busy}>
            Retener
          </Button>
        )}
        {offer.can_remove &&
          (confirming ? (
            <>
              <Button size="sm" variant="dark" icon={<X size={14} />} onClick={onRemove} disabled={busy}>
                Quitar
              </Button>
              <RowIcon tone="neutral" label="Cancelar" icon={<X size={15} />} onClick={() => setConfirming(false)} />
            </>
          ) : (
            <RowIcon tone="delete" label="Quitar oferta" onClick={() => setConfirming(true)} />
          ))}
      </div>
    </li>
  );
}

function ResultCard({ result, index, busy, added, onAdd }: { result: ExternalOfferResult; index: number; busy: boolean; added: boolean; onAdd: () => void }) {
  const expiry = offerExpiry(result.offer_expires_at);
  return (
    <li style={{ animationDelay: `${index * 50}ms` }} className="lift flex animate-[rise-in_420ms_cubic-bezier(0.22,1,0.36,1)_backwards] flex-col gap-3 rounded-tile border border-line bg-surface p-4">
      <div className="flex items-start gap-3">
        <KindGlyph kind={result.kind} />
        <div className="min-w-0">
          <p className="font-semibold leading-snug">{result.summary}</p>
          <p className="mt-0.5 text-[12px] text-fg-3">{PROVIDER_LABEL[result.provider] ?? result.provider}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Badge tone={result.payload.refundable ? "ok" : "warn"} dot={false}>{result.payload.refundable ? "Reembolsable" : "No reembolsable"}</Badge>
        {expiry && <Badge tone={expiry.tone} dot={false}>{expiry.label}</Badge>}
      </div>
      <div className="mt-auto flex items-end justify-between gap-2 border-t border-line pt-3">
        <div>
          <p className="text-[11px] text-fg-3">Precio de venta</p>
          <p className="text-[17px] font-bold tabular-nums">{formatMoney(result.sell_amount, result.currency)}</p>
        </div>
        {added ? (
          <Badge tone="ok" dot={false}>En la cotización</Badge>
        ) : (
          <Button size="sm" variant="primary" icon={<Plus size={14} strokeWidth={2.4} />} onClick={onAdd} disabled={busy}>
            Agregar
          </Button>
        )}
      </div>
    </li>
  );
}

function SearchPanel({ state, busy, onAdd }: { state: ExternalOfferState; busy: boolean; onAdd: (result: ExternalOfferResult) => void }) {
  const [kind, setKind] = useState<ExternalOfferKind>("aereo");
  const [results, setResults] = useState<ExternalOfferResult[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [searching, startSearch] = useTransition();
  const pax = state.pax_adt + state.pax_chd + state.pax_inf;

  function submit(form: FormData) {
    const text = (name: string) => String(form.get(name) ?? "").trim() || undefined;
    startSearch(async () => {
      const response = await searchExternalOffers(state.code, { kind, origin: kind === "aereo" ? text("origin") : undefined, destination: text("destination") ?? "", date_from: text("date_from"), date_to: text("date_to"), pax: Number(text("pax")) || undefined });
      setMessage(response.message);
      setResults(response.message ? null : response.results);
    });
  }

  return (
    <Card>
      <TintCardTitle icon={Search} title="Buscar en el proveedor" aside={<span className="text-[12.5px] text-fg-3">Precios en {state.currency}</span>} />
      <form action={submit} className="grid gap-3">
        <ChoiceGroup label="Qué buscar" name="kind" options={OFFER_KINDS} defaultValue={kind} onChange={(value) => { setKind(value as ExternalOfferKind); setResults(null); }} />
        <div className="grid gap-3 sm:grid-cols-2">
          {kind === "aereo" && <TextField label="Origen" name="origin" required minLength={3} maxLength={60} placeholder="Lima o LIM" />}
          <TextField label="Destino" name="destination" required minLength={3} maxLength={60} placeholder="Cusco o CUZ" />
          <DateField label={kind === "aereo" ? "Salida" : "Desde"} name="date_from" defaultValue={state.travel_from} />
          <DateField label={kind === "aereo" ? "Regreso (opcional)" : "Hasta"} name="date_to" defaultValue={kind === "aereo" ? null : state.travel_to} />
          <TextField label="Pasajeros" name="pax" type="number" min={1} max={500} defaultValue={String(pax || 1)} />
        </div>
        <div className="flex justify-end">
          <Button type="submit" variant="primary" icon={<Search size={15} />} disabled={searching}>
            {searching ? "Buscando" : "Buscar ofertas"}
          </Button>
        </div>
      </form>
      {message && <p role="alert" className="mt-3 rounded-xl bg-[color-mix(in_srgb,var(--bad)_9%,var(--surface))] px-4 py-3 text-[13px] text-bad">{message}</p>}
      {results !== null &&
        (results.length === 0 ? (
          <EmptyState icon={<Search size={20} />} title="El proveedor no tiene ofertas" description="Prueba con otras fechas o con el código del aeropuerto o la ciudad." />
        ) : (
          <ul data-testid="external-offer-results" className="mt-4 grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
            {results.map((result, index) => (
              <ResultCard key={result.offer_ref} result={result} index={index} busy={busy} added={state.external_offers.some((offer) => offer.offer_ref === result.offer_ref && !["cancelada", "vencida", "error"].includes(offer.status))} onAdd={() => onAdd(result)} />
            ))}
          </ul>
        ))}
    </Card>
  );
}

function TotalBar({ base, offers, currency }: { base: string; offers: ExternalOffer[]; currency: string }) {
  const total = Number(offerTotal(base, offers));
  const extra = total - Number(base);
  const share = total > 0 ? Math.max(4, Math.round((extra / total) * 100)) : 0;
  return (
    <div className="mt-4 rounded-xl bg-surface-2 p-3.5">
      <div className="flex flex-wrap items-baseline justify-between gap-2 text-[13px]">
        <span className="text-fg-2">Servicios de la versión {formatMoney(base, currency)} + aéreo y hotel {formatMoney(extra.toFixed(2), currency)}</span>
        <span className="text-[15px] font-bold tabular-nums">{formatMoney(total.toFixed(2), currency)}</span>
      </div>
      <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-line">
        <div className="h-full bg-[var(--tint,var(--accent))] transition-[width] duration-700" style={{ width: `${100 - share}%` }} />
        <div className="h-full bg-[var(--violet)] transition-[width] duration-700" style={{ width: `${share}%` }} />
      </div>
    </div>
  );
}

export function QuoteExternalOffers({ initial, blocked, versionTotal }: { initial: ExternalOfferState | null; blocked: string | null; versionTotal: string }) {
  const [state, setState] = useState(initial);
  const [busy, startChange] = useTransition();

  if (!state) {
    return (
      <Card>
        <EmptyState icon={<Lock size={20} />} title="Sin acceso" description={blocked ?? "Tu rol no puede ver las ofertas de aéreo y hotel."} />
      </Card>
    );
  }

  const code = state.code;
  const offers = state.external_offers;
  const { count, blocked: stuck } = pendingIssue(offers);
  const canSearch = state.available && state.rule_enabled && state.editable;

  function run(change: Parameters<typeof changeExternalOffer>[1], done: string) {
    startChange(async () => {
      const response = await changeExternalOffer(code, change);
      if (response.message) {
        toast(response.message, "bad");
        return;
      }
      if (response.state) setState(response.state);
      toast(done);
    });
  }

  if (!state.available && offers.length === 0) {
    return (
      <Card>
        <div data-testid="coming-soon">
          <EmptyState icon={<Sparkles size={20} />} title="Próximamente" description={state.unavailable_message ?? "Las ofertas de aéreo y hotel estarán disponibles próximamente."} action={<Badge tone="t4">Te avisaremos cuando esté lista</Badge>} />
        </div>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-5" data-testid="quote-external-offers">
      <PlanNotice enabled={state.rule_enabled} feature="Las ofertas de aéreo y hotel" />
      <Card>
        <TintCardTitle icon={Ticket} title="Aéreo y hotel en la cotización" aside={<span className="text-[12.5px] text-fg-3">{offers.length} {offers.length === 1 ? "oferta" : "ofertas"}</span>} />
        {state.status === "aprobada" && count > 0 && (
          <p className="mb-3 rounded-xl bg-[color-mix(in_srgb,var(--violet)_9%,var(--surface))] px-4 py-3 text-[13px] text-fg-2">
            Se emiten en el proveedor al convertir en reserva. Retén las cotizadas para que el precio no venza antes.
          </p>
        )}
        {stuck > 0 && (
          <p className="mb-3 rounded-xl bg-[color-mix(in_srgb,var(--warn)_10%,var(--surface))] px-4 py-3 text-[13px] text-fg-2">
            {stuck === 1 ? "Una oferta venció o tuvo error" : `${stuck} ofertas vencieron o tuvieron error`}: quítalas antes de convertir en reserva.
          </p>
        )}
        {offers.length === 0 ? (
          <EmptyState icon={<Plane size={20} />} title="Aún no hay vuelos ni hoteles" description={canSearch ? "Busca en el proveedor y agrega la oferta: queda con su precio, moneda y vencimiento." : "Las ofertas se agregan mientras la cotización está en borrador, enviada o en negociación."} />
        ) : (
          <>
            <ul className="flex flex-col gap-2.5">
              {offers.map((offer) => (
                <OfferRow key={offer.id} offer={offer} busy={busy} onHold={() => run({ op: "hold", id: offer.id }, "Oferta retenida en el proveedor.")} onRemove={() => run({ op: "remove", id: offer.id }, "Oferta quitada de la cotización.")} />
              ))}
            </ul>
            <TotalBar base={versionTotal} offers={offers} currency={state.currency} />
          </>
        )}
      </Card>
      {canSearch && <SearchPanel state={state} busy={busy} onAdd={(result) => run({ op: "add", provider: result.provider, offer_ref: result.offer_ref, key: crypto.randomUUID() }, "Oferta agregada a la cotización.")} />}
    </div>
  );
}
