"use client";

import { Bus, CalendarRange, Compass, MoonStar, Plus, Route, SunMedium } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { createSeasonRate, deleteSeasonRate, saveLegNights, saveLegTour, saveTransportOption } from "@/app/(backoffice)/catalogo/productos/tramos-actions";
import { Pager } from "@/components/table/Pager";
import { RowIcon } from "@/components/table/RowActions";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { InfoTip } from "@/components/ui/InfoTip";
import { MetricCard, MetricCardRow } from "@/components/ui/MetricCard";
import { PanelAction } from "@/components/ui/PanelAction";
import { SelectField } from "@/components/ui/SelectField";
import { SwitchField } from "@/components/ui/SwitchField";
import { TextField } from "@/components/ui/TextField";
import { ConfirmAction, HiddenFields, PanelSection, STEP_INITIAL } from "@/features/catalog-shared/CatalogPanels";
import { cn } from "@/lib/cn";
import { formatDate, formatMoney } from "@/lib/format";
import type { StepResult } from "@/lib/server/resource";
import type { TripCatalogView, TripOption, TripTour } from "@/lib/trip";

type View = "noches" | "temporadas" | "tours" | "movilidad";

const CURRENCIES = [
  { value: "USD", label: "USD" },
  { value: "PEN", label: "PEN" },
];

function Panel({ id, label, title, description, submitLabel, action, icon, trigger, variant = "secondary", children }: { id: string; label: string; title: string; description?: ReactNode; submitLabel: string; action: (state: StepResult, form: FormData) => Promise<StepResult>; icon?: ReactNode; trigger?: (open: () => void) => ReactNode; variant?: "primary" | "secondary" | "ghost"; children: ReactNode }) {
  const router = useRouter();
  return (
    <PanelAction<StepResult> label={label} icon={icon} variant={variant} size="sm" formId={`trip-${id}`} title={title} description={description} submitLabel={submitLabel} action={action} initial={STEP_INITIAL} trigger={trigger} onDone={() => router.refresh()}>
      {() => children}
    </PanelAction>
  );
}

function Switch({ name, label, hint, defaultChecked }: { name: string; label: string; hint?: string; defaultChecked: boolean }) {
  const [checked, setChecked] = useState(defaultChecked);
  return <SwitchField name={name} label={label} hint={hint} checked={checked} onCheckedChange={setChecked} />;
}

function NightsAction({ data, leg }: { data: TripCatalogView; leg: TripCatalogView["legs"][number] }) {
  const [flexible, setFlexible] = useState(leg.min_nights !== null);
  return (
    <Panel id={`nights-${leg.code}`} label="Editar" trigger={(open) => <RowIcon tone="edit" label={`Editar noches de ${leg.city}`} onClick={open} />} title={`Noches en ${leg.city}`} description={`Por defecto ${leg.nights} noche(s). El cliente elige dentro del rango y el servidor lo respeta (TB-02).`} submitLabel="Guardar noches" action={saveLegNights}>
      <HiddenFields values={{ product: data.product.code, lock_version: data.product.lock_version, leg: leg.id }} />
      <SwitchField name="flexible" label="El cliente elige las noches" hint="Apagado: noches fijas." checked={flexible} onCheckedChange={setFlexible} />
      {flexible && (
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Mínimo" name="min_nights" type="number" min={1} max={leg.nights} required defaultValue={leg.min_nights ?? Math.max(1, leg.nights - 1)} />
          <TextField label="Máximo" name="max_nights" type="number" min={leg.nights} max={30} required defaultValue={leg.max_nights ?? leg.nights + 2} />
        </div>
      )}
    </Panel>
  );
}

function SeasonAction({ data }: { data: TripCatalogView }) {
  const hotels = data.legs.flatMap((leg) => leg.hotels.map((hotel) => ({ value: hotel.id, label: `${leg.city} · ${hotel.name}` })));
  return (
    <Panel id="season-new" label="Nueva temporada" icon={<CalendarRange size={15} />} variant="primary" title="Nueva temporada de hotel" description="Cada noche dentro de las fechas se cobra con la tarifa base ajustada por este porcentaje (TB-03). Las fechas no pueden cruzarse con otra temporada del mismo hotel." submitLabel="Crear temporada" action={createSeasonRate}>
      <SelectField label="Hotel" name="hotel" searchable defaultValue={hotels[0]?.value ?? ""} options={hotels} />
      <TextField label="Nombre" name="label" required maxLength={60} placeholder="Temporada alta" />
      <div className="grid grid-cols-2 gap-3">
        <TextField label="Desde" name="date_from" type="date" required />
        <TextField label="Hasta" name="date_to" type="date" required />
      </div>
      <TextField label="Ajuste (%)" name="adjust_pct" type="number" step="0.01" min={-50} max={300} required defaultValue={20} hint="De −50 % a 300 %. Negativo para temporada baja." />
    </Panel>
  );
}

function TourAction({ data, tour }: { data: TripCatalogView; tour?: TripTour }) {
  return (
    <Panel id={tour ? `tour-${tour.code}` : "tour-new"} label="Nuevo tour" icon={<Compass size={15} />} variant="primary" trigger={tour ? (open) => <RowIcon tone="edit" label={`Editar ${tour.name}`} onClick={open} /> : undefined} title={tour ? `Editar ${tour.name}` : "Nuevo tour por ciudad"} description="El tour se ofrece en la ficha pública y, si lo permites, en la venta en ruta." submitLabel={tour ? "Guardar tour" : "Crear tour"} action={saveLegTour}>
      <HiddenFields values={{ product: data.product.code, tour: tour?.id }} />
      <PanelSection title="Tour">
        <SelectField label="Ciudad" name="leg_id" defaultValue={tour?.leg_id ?? data.legs[0]?.id ?? ""} options={data.legs.map((leg) => ({ value: leg.id, label: leg.city }))} />
        <TextField label="Nombre" name="name" required maxLength={160} defaultValue={tour?.name} placeholder="Kayak al amanecer en el Titicaca" />
        <div className="grid grid-cols-3 gap-3">
          <TextField label="Día del tramo" name="day_offset" type="number" min={0} max={30} defaultValue={tour?.day_offset ?? 0} hint="0 = llegada" />
          <TextField label="Hora" name="start_time" type="time" required defaultValue={tour?.start_time ?? "09:00"} />
          <TextField label="Horas" name="duration_hours" type="number" step="0.5" min={0.5} max={24} required defaultValue={tour?.duration_hours ?? 3} />
        </div>
      </PanelSection>
      <PanelSection title="Precio y cupo">
        <div className="grid grid-cols-3 gap-3">
          <SelectField label="Moneda" name="currency" defaultValue={tour?.currency ?? "USD"} options={CURRENCIES} />
          <TextField label="Adulto" name="price_adult" type="number" step="0.01" min={0} required defaultValue={tour?.price_adult} />
          <TextField label="Niño" name="price_child" type="number" step="0.01" min={0} defaultValue={tour?.price_child ?? 0} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Edad mínima" name="min_age" type="number" min={0} max={99} defaultValue={tour?.min_age ?? ""} hint="Vacío: sin restricción" />
          <TextField label="Cupo por salida" name="capacity" type="number" min={1} max={999} defaultValue={tour?.capacity ?? ""} />
        </div>
        <SelectField label="Proveedor" name="provider_id" clearable searchable placeholder="Sin proveedor" defaultValue={tour?.provider?.id ?? ""} options={data.options.providers.map((provider) => ({ value: provider.id, label: `${provider.name} · ${provider.type}` }))} />
      </PanelSection>
      <Switch name="in_trip_sale" label="Se vende en ruta" hint="El pasajero lo compra desde su portal con link de pago." defaultChecked={tour?.in_trip_sale ?? true} />
      <Switch name="active" label="Activo" defaultChecked={tour?.active ?? true} />
    </Panel>
  );
}

function TransportAction({ data, option }: { data: TripCatalogView; option?: TripOption }) {
  const [pricing, setPricing] = useState<string>(option?.pricing ?? "pax");
  const slots = ["1", "2", "3"];
  return (
    <Panel id={option ? `trans-${option.code}` : "trans-new"} label="Nueva movilidad" icon={<Bus size={15} />} variant="primary" trigger={option ? (open) => <RowIcon tone="edit" label={`Editar ${option.name}`} onClick={open} /> : undefined} title={option ? `Editar ${option.name}` : "Nueva opción de movilidad"} description="Entre dos ciudades el cliente elige una sola opción (TB-06). Sin destino es movilidad local de la ciudad." submitLabel={option ? "Guardar movilidad" : "Crear movilidad"} action={saveTransportOption}>
      <HiddenFields values={{ product: data.product.code, option: option?.id, pricing }} />
      <PanelSection title="Trayecto">
        <div className="grid grid-cols-2 gap-3">
          <SelectField label="Desde" name="from_leg_id" defaultValue={option?.from_leg_id ?? data.legs[0]?.id ?? ""} options={data.legs.map((leg) => ({ value: leg.id, label: leg.city }))} />
          <SelectField label="Hasta" name="to_leg_id" clearable placeholder="Movilidad local" defaultValue={option?.to_leg_id ?? ""} options={data.legs.map((leg) => ({ value: leg.id, label: leg.city }))} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <SelectField label="Tipo" name="mode" defaultValue={option?.mode ?? "bus"} options={data.options.modes} />
          <TextField label="Horas" name="duration_hours" type="number" step="0.5" min={0.5} max={99} defaultValue={option?.duration_hours ?? ""} />
        </div>
        <TextField label="Nombre" name="name" required maxLength={160} defaultValue={option?.name} placeholder="Bus turístico Arequipa → Puno" />
      </PanelSection>
      <PanelSection title="Precio">
        <div className="grid grid-cols-2 gap-3">
          <SelectField label="Cobro" name="pricing_select" value={pricing} onChange={(value) => setPricing(value || "pax")} options={data.options.pricing} />
          <SelectField label="Moneda" name="currency" defaultValue={option?.currency ?? "USD"} options={CURRENCIES} />
        </div>
        {pricing === "pax" ? (
          <div className="grid grid-cols-2 gap-3">
            <TextField label="Adulto" name="price_adult" type="number" step="0.01" min={0} required defaultValue={option?.price_adult ?? ""} />
            <TextField label="Niño" name="price_child" type="number" step="0.01" min={0} defaultValue={option?.price_child ?? ""} hint="Vacío: igual que el adulto" />
          </div>
        ) : (
          <div className="grid gap-2">
            <p className="text-[12.5px] text-fg-3">Se usa el vehículo más chico que alcanza; si ninguno alcanza, varias unidades del más grande (TB-05).</p>
            {slots.map((slot, index) => (
              <div key={slot} className="grid grid-cols-[minmax(0,1fr)_90px_110px] gap-2">
                <TextField label={index === 0 ? "Vehículo" : ""} name={`vehicle_name_${slot}`} maxLength={60} defaultValue={option?.vehicles[index]?.name ?? ""} placeholder={index === 0 ? "Auto (1–3)" : index === 1 ? "Van (4–10)" : "Bus (11–30)"} />
                <TextField label={index === 0 ? "Máx. pax" : ""} name={`vehicle_pax_${slot}`} type="number" min={1} max={60} defaultValue={option?.vehicles[index]?.max_pax ?? ""} />
                <TextField label={index === 0 ? "Precio" : ""} name={`vehicle_price_${slot}`} type="number" step="0.01" min={0} defaultValue={option?.vehicles[index]?.price ?? ""} />
              </div>
            ))}
          </div>
        )}
        <SelectField label="Proveedor" name="provider_id" clearable searchable placeholder="Sin proveedor" defaultValue={option?.provider?.id ?? ""} options={data.options.providers.map((provider) => ({ value: provider.id, label: `${provider.name} · ${provider.type}` }))} />
      </PanelSection>
      <Switch name="in_trip_sale" label="Se vende en ruta" defaultChecked={option?.in_trip_sale ?? true} />
      <Switch name="active" label="Activa" defaultChecked={option?.active ?? true} />
    </Panel>
  );
}

function usePaged<T>(items: T[]) {
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState(6);
  const pages = Math.max(1, Math.ceil(items.length / rows));
  const current = Math.min(page, pages);
  return { slice: items.slice((current - 1) * rows, current * rows), pager: items.length > 6 ? <Pager page={current} pages={pages} total={items.length} rows={rows} onPage={setPage} onRows={(value) => { setRows(value); setPage(1); }} entityLabel="filas" /> : null };
}

function Head({ children }: { children: ReactNode }) {
  return <th className="px-3 py-2 text-left text-[12px] font-semibold text-fg-3">{children}</th>;
}

function ToursTable({ data, editable }: { data: TripCatalogView; editable: boolean }) {
  const tours = data.legs.flatMap((leg) => leg.tours);
  const { slice, pager } = usePaged(tours);
  if (tours.length === 0) return <p className="rounded-[14px] border border-dashed border-line px-4 py-6 text-center text-[13px] text-fg-3">Aún no hay tours por ciudad.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-[13px]">
        <thead className="border-b border-line">
          <tr>
            <Head>Tour</Head>
            <Head>Ciudad y horario</Head>
            <Head>Precio</Head>
            <Head>Venta</Head>
            {editable && <Head> </Head>}
          </tr>
        </thead>
        <tbody>
          {slice.map((tour) => (
            <tr key={tour.id} className={cn("border-b border-line-2 transition hover:bg-surface-2/60", !tour.active && "opacity-55")}>
              <td className="px-3 py-2.5">
                <b className="font-semibold">{tour.name}</b>
                <span className="block text-[12px] text-fg-3">
                  {tour.code}
                  {tour.provider?.name ? ` · ${tour.provider.name}` : ""}
                </span>
              </td>
              <td className="px-3 py-2.5 text-fg-2">
                {tour.city} · {tour.day_offset === 0 ? "llegada" : `día ${tour.day_offset + 1}`} · {tour.start_time}
                <span className="block text-[12px] text-fg-3">
                  {Number(tour.duration_hours)} h{tour.min_age ? ` · desde ${tour.min_age} años` : ""}
                  {tour.capacity ? ` · cupo ${tour.capacity}` : ""}
                </span>
              </td>
              <td className="px-3 py-2.5 font-mono tabular-nums">
                {formatMoney(tour.price_adult, tour.currency)}
                <span className="block text-[12px] text-fg-3">niño {Number(tour.price_child) > 0 ? formatMoney(tour.price_child, tour.currency) : "sin costo"}</span>
              </td>
              <td className="px-3 py-2.5">
                {!tour.active ? <Badge tone="mute">Inactivo</Badge> : tour.in_trip_sale ? <Badge tone="t4">También en ruta</Badge> : <Badge tone="t1">Solo al reservar</Badge>}
              </td>
              {editable && (
                <td className="px-3 py-2.5 text-right">
                  <TourAction data={data} tour={tour} />
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {pager}
    </div>
  );
}

function priceOf(option: TripOption): string {
  if (option.pricing === "vehiculo") return option.vehicles.map((vehicle) => `${vehicle.name} ${formatMoney(vehicle.price, option.currency)}`).join(" · ");
  return `${formatMoney(option.price_adult ?? 0, option.currency)} adulto${option.price_child ? ` · ${formatMoney(option.price_child, option.currency)} niño` : ""}`;
}

function TransportTable({ data, editable }: { data: TripCatalogView; editable: boolean }) {
  const { slice, pager } = usePaged(data.transport);
  if (data.transport.length === 0) return <p className="rounded-[14px] border border-dashed border-line px-4 py-6 text-center text-[13px] text-fg-3">Aún no hay opciones de movilidad.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-[13px]">
        <thead className="border-b border-line">
          <tr>
            <Head>Opción</Head>
            <Head>Trayecto</Head>
            <Head>Cobro</Head>
            <Head>Venta</Head>
            {editable && <Head> </Head>}
          </tr>
        </thead>
        <tbody>
          {slice.map((option) => (
            <tr key={option.id} className={cn("border-b border-line-2 transition hover:bg-surface-2/60", !option.active && "opacity-55")}>
              <td className="px-3 py-2.5">
                <b className="font-semibold">{option.name}</b>
                <span className="block text-[12px] text-fg-3">
                  {option.code} · {option.mode_label}
                  {option.duration_hours ? ` · ${Number(option.duration_hours)} h` : ""}
                </span>
              </td>
              <td className="px-3 py-2.5 text-fg-2">{option.to_city ? `${option.from_city} → ${option.to_city}` : `Local en ${option.from_city}`}</td>
              <td className="px-3 py-2.5 tabular-nums">
                <span className="block text-[12px] text-fg-3">{option.pricing === "vehiculo" ? "Por vehículo" : "Por pasajero"}</span>
                {priceOf(option)}
              </td>
              <td className="px-3 py-2.5">{!option.active ? <Badge tone="mute">Inactiva</Badge> : option.in_trip_sale ? <Badge tone="t4">También en ruta</Badge> : <Badge tone="t1">Solo al reservar</Badge>}</td>
              {editable && (
                <td className="px-3 py-2.5 text-right">
                  <TransportAction data={data} option={option} />
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {pager}
    </div>
  );
}

export function TripSection({ data }: { data: TripCatalogView }) {
  const [view, setView] = useState<View>("noches");
  const editable = data.can.update && data.product.status !== "ARCHIVED";
  const seasons = data.legs.flatMap((leg) => leg.hotels.flatMap((hotel) => hotel.season_rates.map((rate) => ({ ...rate, hotel: hotel.name, city: leg.city }))));
  const tabs: { id: View; label: string; count: number }[] = [
    { id: "noches", label: "Noches por ciudad", count: data.summary.legs },
    { id: "temporadas", label: "Temporadas de hotel", count: data.summary.season_rates },
    { id: "tours", label: "Tours", count: data.summary.tours },
    { id: "movilidad", label: "Movilidad", count: data.summary.transport },
  ];

  return (
    <div className="flex flex-col gap-4">
      {!data.rules.trip_builder.on && (
        <p className="rounded-[14px] border border-warn/30 bg-warn/[0.06] px-4 py-3 text-[13px] text-fg-2">
          {data.rules.trip_builder.plan_allows ? "La regla «Viaje por tramos» está apagada: el sitio vende noches fijas y no muestra tours ni movilidad." : "El plan actual no incluye el armador de viajes por tramos. Se activa desde el plan Professional o con el add-on."} Puedes dejar todo configurado igual.
        </p>
      )}
      <MetricCardRow>
        <MetricCard tone="t1" icon={<MoonStar size={18} />} label="Tramos con noches a elegir" value={`${data.summary.flexible_legs} de ${data.summary.legs}`} active={view === "noches"} onClick={() => setView("noches")} />
        <MetricCard tone="t2" icon={<SunMedium size={18} />} label="Temporadas de hotel" value={data.summary.season_rates} active={view === "temporadas"} onClick={() => setView("temporadas")} />
        <MetricCard tone="t3" icon={<Compass size={18} />} label={`Tours · ${data.summary.tours_in_trip} en ruta`} value={data.summary.tours} active={view === "tours"} onClick={() => setView("tours")} />
        <MetricCard tone="t4" icon={<Bus size={18} />} label="Opciones de movilidad" value={data.summary.transport} active={view === "movilidad"} onClick={() => setView("movilidad")} />
      </MetricCardRow>
      <p className="-mt-2 flex items-center gap-1.5 text-[12px] text-fg-3">
        <Route size={13} /> Venta en ruta {data.rules.in_trip_sales.on ? `activa · hasta ${data.rules.in_trip_sales.min_hours_before} h antes` : "apagada"}
        <InfoTip label="De dónde salen los números">Se cuentan los tramos del alojamiento de este producto, las temporadas cargadas en sus hoteles, los tours por ciudad (y cuántos se venden en ruta) y las opciones de movilidad, activas o no.</InfoTip>
      </p>

      <Card className="p-0">
        <div role="tablist" className="scroll-thin flex gap-1 overflow-x-auto border-b border-line px-5">
          {tabs.map((tab) => (
            <button key={tab.id} type="button" role="tab" aria-selected={view === tab.id} data-testid={`trip-tab:${tab.id}`} onClick={() => setView(tab.id)} className={cn("-mb-px flex flex-none items-center gap-1.5 border-b-2 px-2.5 py-3.5 text-[13.5px] font-medium transition", view === tab.id ? "border-brand font-semibold text-fg" : "border-transparent text-fg-3 hover:text-fg")}>
              {tab.label}
              <span className="rounded-md bg-surface-2 px-1.5 font-mono text-[11px] font-semibold text-fg-2">{tab.count}</span>
            </button>
          ))}
          <span className="ml-auto flex items-center gap-2 py-2">
            {editable && view === "temporadas" && <SeasonAction data={data} />}
            {editable && view === "tours" && <TourAction data={data} />}
            {editable && view === "movilidad" && <TransportAction data={data} />}
          </span>
        </div>
        <div className="p-5">
          {view === "noches" && (
            <ol className="grid gap-3 md:grid-cols-2">
              {data.legs.map((leg, index) => {
                const min = leg.min_nights ?? leg.nights;
                const max = leg.max_nights ?? leg.nights;
                return (
                  <li key={leg.id} className="lift rounded-[14px] border border-line p-4">
                    <div className="flex items-center gap-2">
                      <span className="grid h-7 min-w-7 place-items-center rounded-full bg-accent px-1.5 text-[12px] font-bold text-white">{index + 1}</span>
                      <b className="flex-1 text-[14px] font-semibold">{leg.city}</b>
                      {editable && <NightsAction data={data} leg={leg} />}
                    </div>
                    <div className="mt-3 flex items-end gap-1" aria-label={`De ${min} a ${max} noches`}>
                      {Array.from({ length: Math.max(max, leg.nights) }, (_, night) => (
                        <span key={night} title={`${night + 1} noche(s)`} className={cn("h-6 flex-1 rounded-md transition", night + 1 < min ? "bg-surface-2" : night + 1 === leg.nights ? "bg-accent" : "bg-[color-mix(in_srgb,var(--accent)_35%,transparent)]")} />
                      ))}
                    </div>
                    <p className="mt-2 text-[12.5px] text-fg-3">{leg.min_nights === null ? `${leg.nights} noche(s) fijas` : `De ${min} a ${max} noches · por defecto ${leg.nights}`}</p>
                  </li>
                );
              })}
            </ol>
          )}
          {view === "temporadas" &&
            (seasons.length === 0 ? (
              <p className="rounded-[14px] border border-dashed border-line px-4 py-6 text-center text-[13px] text-fg-3">Sin temporadas: cada noche se cobra con la tarifa base del hotel.</p>
            ) : (
              <ul className="grid gap-2 md:grid-cols-2">
                {seasons.map((rate) => (
                  <li key={rate.id} className="lift flex items-center gap-3 rounded-[14px] border border-line px-4 py-3">
                    <span className={cn("grid h-10 w-14 flex-none place-items-center rounded-xl font-mono text-[13px] font-bold", Number(rate.adjust_pct) >= 0 ? "bg-[color-mix(in_srgb,var(--t3)_14%,transparent)] text-t3" : "bg-[color-mix(in_srgb,var(--ok)_14%,transparent)] text-ok")}>
                      {Number(rate.adjust_pct) > 0 ? "+" : ""}
                      {Number(rate.adjust_pct)} %
                    </span>
                    <span className="min-w-0 flex-1">
                      <b className="block text-[13.5px] font-semibold">{rate.label}</b>
                      <span className="block truncate text-[12px] text-fg-3">
                        {rate.city} · {rate.hotel} · {formatDate(rate.date_from)} – {formatDate(rate.date_to)}
                      </span>
                    </span>
                    {editable && <ConfirmAction id={`season-del-${rate.id}`} label="Borrar temporada" title="Borrar temporada" description={`${rate.label} deja de aplicarse en ${rate.hotel}.`} submitLabel="Borrar" action={deleteSeasonRate} hidden={{ hotel: rate.hotel_id, rate: rate.id }} />}
                  </li>
                ))}
              </ul>
            ))}
          {view === "tours" && <ToursTable data={data} editable={editable} />}
          {view === "movilidad" && <TransportTable data={data} editable={editable} />}
          {view === "movilidad" && editable && (
            <p className="mt-3 flex items-center gap-1.5 text-[12px] text-fg-3">
              <Plus size={12} /> Para dejar de ofrecer una opción, desactívala: las ya vendidas se conservan en sus reservas.
            </p>
          )}
        </div>
      </Card>
    </div>
  );
}
