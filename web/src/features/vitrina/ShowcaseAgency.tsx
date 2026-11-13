"use client";

import { BadgeCheck, CalendarCheck, CircleSlash, Globe, Pause, Percent, Play, Plus, Sparkles, Star, Ticket, UserCheck, Users } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { markAttendance, saveListing, toggleListing } from "@/app/(backoffice)/canales/vitrina/actions";
import { DataTable } from "@/components/table/DataTable";
import { RowActions, RowIcon } from "@/components/table/RowActions";
import type { Column, FilterConfig, MetricFilter, SortOption } from "@/components/table/types";
import { Card, CardHeader } from "@/components/ui/Card";
import { ChipToggleGroup } from "@/components/ui/ChipToggleGroup";
import { PanelAction } from "@/components/ui/PanelAction";
import { SelectField } from "@/components/ui/SelectField";
import { SimpleTable } from "@/components/ui/SimpleTable";
import { SwitchField } from "@/components/ui/SwitchField";
import { TextArea } from "@/components/ui/TextArea";
import { TextField } from "@/components/ui/TextField";
import { TintTile } from "@/components/ui/Tinted";
import { TileGrid } from "@/features/channels/ChannelUi";
import { formatDate, formatMoney } from "@/lib/format";
import type { StepResult } from "@/lib/server/resource";
import { cityLabel, FEE_BASIS, LANGUAGE_LABELS, monthLabel, type AgencyShowcase, type ShowcaseBooking, type ShowcaseFees, type ShowcaseListing } from "@/lib/vitrina";
import { initialStep, Meter, QuickAction, TabCard, VitrinaBadge } from "./VitrinaUi";

const CITIES = ["lima", "cusco", "arequipa", "puno", "trujillo", "huaraz", "iquitos"];

export function AgencyTiles({ data }: { data: AgencyShowcase }) {
  return (
    <TileGrid>
      <TintTile icon={Globe} tone="t1" label="Publicados" value={data.kpis.published} note={`${data.kpis.in_review} en revisión`} info={<p>Tours de su agencia aprobados por la plataforma y visibles en la vitrina.</p>} />
      <TintTile icon={Ticket} tone="info" label="Reservas de la vitrina" value={data.kpis.bookings} note={`${data.kpis.pax} personas`} info={<p>Reservas recibidas en la vitrina, sin contar las canceladas por el viajero.</p>} />
      <TintTile icon={Users} tone="ok" label="Asistencia" value={data.kpis.attendance_pct === null ? "—" : `${data.kpis.attendance_pct} %`} note="Asistió entre asistió y no-show" info={<p>Se calcula con las reservas que ya marcó como «asistió» o «no se presentó». Mejora su posición en el ranking.</p>} />
      <TintTile icon={Percent} tone="sun" label="Cargo del mes" value={formatMoney(data.kpis.month_fee, "PEN")} note={`Plan ${data.plan.label} · ${data.plan.commission_pct} % en tours de pago`} info={<p>Suma de cargos por asistente y comisiones de tours de pago con salida este mes. Se factura el día 1.</p>} />
    </TileGrid>
  );
}

export function UpgradeBanner({ data }: { data: AgencyShowcase }) {
  if (data.plan.has_plan) return null;
  return (
    <section className="mb-5 flex flex-col gap-4 rounded-card border border-[color-mix(in_srgb,var(--t1)_30%,transparent)] bg-[color-mix(in_srgb,var(--t1)_7%,var(--surface))] p-5 lg:flex-row lg:items-center">
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 text-[15px] font-semibold"><Sparkles size={17} className="text-[var(--t1)]" /> Su agencia puede vender más con un plan</p>
        <ul className="mt-2 grid gap-1.5 text-[13px] text-fg-2 sm:grid-cols-2">
          {data.benefits.slice(1, 5).map(([title, note]) => (
            <li key={title}><b className="text-fg">{title}.</b> {note}</li>
          ))}
        </ul>
      </div>
      <div className="flex flex-none gap-2">
        <Link href="/admin/suscripcion" className="inline-flex h-10 items-center rounded-[11px] bg-brand px-4 text-[13.5px] font-semibold text-white transition-transform duration-300 hover:-translate-y-0.5">Probar 30 días</Link>
        <Link href="/admin/suscripcion" className="inline-flex h-10 items-center rounded-[11px] border border-line bg-surface px-4 text-[13.5px] font-semibold transition-transform duration-300 hover:-translate-y-0.5">Ver planes</Link>
      </div>
    </section>
  );
}

export function ListingFormAction({ listing, options }: { listing?: ShowcaseListing; options: AgencyShowcase["options"] }) {
  const [paid, setPaid] = useState(listing?.model === "pago");
  const [own, setOwn] = useState(Boolean(listing));
  return (
    <PanelAction<StepResult>
      label={listing ? "Editar" : "Publicar tour"}
      icon={<Plus size={16} strokeWidth={2.4} />}
      variant="primary"
      formId={listing ? `vt-listing-${listing.code}` : "vt-listing-new"}
      title={listing ? "Editar publicación" : "Publicar tour en la vitrina"}
      description={listing ? `${listing.code} · al guardar vuelve a revisión de la plataforma.` : "Pasa a revisión de la plataforma antes de publicarse."}
      submitLabel={listing ? "Guardar y enviar a revisión" : "Enviar a revisión"}
      action={saveListing}
      initial={initialStep}
      trigger={listing ? (open) => <RowIcon tone="edit" label="Editar" onClick={open} /> : undefined}
    >
      {() => (
        <>
          {listing && <input type="hidden" name="code" value={listing.code} />}
          <TextField label="Título" name="title" required minLength={5} maxLength={160} defaultValue={listing?.title} placeholder="Free tour Centro Histórico de Lima" />
          <div className="grid grid-cols-2 gap-3">
            <SelectField label="Ciudad" name="city" options={CITIES.map((value) => ({ value, label: cityLabel(value) }))} defaultValue={listing?.city ?? "lima"} />
            <TextField label="Zona" name="zone" maxLength={80} defaultValue={listing?.zone ?? undefined} placeholder="Barranco" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <SelectField label="Tema" name="theme" options={options.themes.map((value) => ({ value, label: value }))} defaultValue={listing?.theme ?? options.themes[0]} />
            <SelectField label="Tipo" name="model" options={[{ value: "propina", label: "Free tour (propina)" }, { value: "pago", label: "De pago" }]} defaultValue={listing?.model ?? "propina"} onChange={(value) => setPaid(value === "pago")} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <TextField label="Precio por persona (S/)" name="price" type="number" min={0} step="0.01" disabled={!paid} defaultValue={listing && listing.model === "pago" ? listing.price : undefined} />
            <TextField label="Duración (h)" name="duration_hours" type="number" min={0.5} max={24} step="0.5" defaultValue={listing?.duration_hours ?? 2} />
            <TextField label="Cupo por salida" name="capacity" type="number" min={1} max={200} defaultValue={listing?.capacity ?? 20} />
          </div>
          <ChipToggleGroup label="Idiomas" name="languages" options={options.languages.map((value) => ({ value, label: LANGUAGE_LABELS[value] ?? value }))} defaultValue={listing?.languages ?? ["es"]} />
          <TextField label="Horarios de salida" name="start_times" required defaultValue={listing?.start_times.join(", ") ?? "10:00"} hint="Separados por coma, en formato 24 h: 10:00, 15:30." />
          <TextField label="Punto de encuentro" name="meeting_point" required minLength={10} maxLength={300} defaultValue={listing?.meeting_point} />
          <TextArea label="Lo que verá" name="highlights" rows={4} required defaultValue={listing?.highlights.join("\n")} hint="Un punto por línea." />
          {!listing && (
            <>
              <input type="hidden" name="own_content" value={own ? "1" : "0"} />
              <SwitchField label="Declaro que las fotos y los textos son propios" name="own_content_switch" checked={own} onCheckedChange={setOwn} hint="La plataforma revisa fotos, punto de encuentro y licencia antes de publicar." />
            </>
          )}
        </>
      )}
    </PanelAction>
  );
}

export function ListingsTable({ data }: { data: AgencyShowcase }) {
  const columns: Column<ShowcaseListing>[] = [
    {
      id: "title",
      header: "Tour",
      mobile: "title",
      cell: (row) => (
        <span className="min-w-0">
          <b className="block truncate text-[13.5px] font-semibold">{row.title}</b>
          <span className="text-[12px] text-fg-3">/{row.slug}</span>
          {row.reject_reason && <span className="mt-0.5 block text-[12px] text-bad">{row.reject_reason}</span>}
        </span>
      ),
    },
    { id: "city", header: "Ciudad", cell: (row) => <span className="text-[13px]">{cityLabel(row.city)}{row.zone ? ` · ${row.zone}` : ""}</span> },
    { id: "model", header: "Tipo", cell: (row) => <span className="text-[13px]">{row.model === "pago" ? `De pago · ${formatMoney(row.price, row.currency)}` : "Free tour"}</span> },
    { id: "times", header: "Horarios", wideOnly: true, cell: (row) => <span className="font-mono text-[12.5px]">{row.start_times.join(" · ")}</span> },
    { id: "reviews", header: "Reseñas", align: "right", wideOnly: true, cell: (row) => (row.reviews ? <span className="inline-flex items-center gap-1 text-[13px]"><Star size={13} className="fill-[var(--t2)] text-[var(--t2)]" />{row.rating?.toFixed(1)} ({row.reviews})</span> : <span className="text-fg-3">—</span>) },
    { id: "status", header: "Estado", mobile: "detail", cell: (row) => <VitrinaBadge status={row.status} /> },
    {
      id: "actions",
      header: "",
      cell: (row) => (
        <RowActions>
          {row.can_pause && <QuickAction id={`vt-pause-${row.code}`} label="Pausar" title="Pausar publicación" description={`${row.title}. Deja de mostrarse en la vitrina hasta que la reanude.`} submitLabel="Pausar" action={toggleListing} fields={{ code: row.code, action: "pausar" }} icon={<Pause size={14} />} tone="mute" />}
          {row.can_resume && <QuickAction id={`vt-resume-${row.code}`} label="Reanudar" title="Reanudar publicación" description={`${row.title}. Vuelve a mostrarse en la vitrina.`} submitLabel="Reanudar" action={toggleListing} fields={{ code: row.code, action: "reanudar" }} icon={<Play size={14} />} tone="ok" />}
          <ListingFormAction listing={row} options={data.options} />
        </RowActions>
      ),
    },
  ];
  const metrics: MetricFilter<ShowcaseListing>[] = [
    { id: "live", label: "Publicados", tone: "ok", icon: <Globe size={19} />, matches: (row) => row.status === "publicado" },
    { id: "review", label: "En revisión", tone: "sun", icon: <BadgeCheck size={19} />, matches: (row) => row.status === "en_revision" },
    { id: "rejected", label: "Rechazados", tone: "bad", icon: <CircleSlash size={19} />, matches: (row) => row.status === "rechazado" },
  ];
  const filters: FilterConfig<ShowcaseListing>[] = [{ id: "model", label: "Tipo", options: [{ value: "propina", label: "Free tour" }, { value: "pago", label: "De pago" }], value: (row) => row.model }];
  const sorts: SortOption<ShowcaseListing>[] = [
    { id: "updated", label: "Actualización", type: "date", value: (row) => row.updated_at },
    { id: "title", label: "Título", value: (row) => row.title },
  ];
  return <DataTable screen="canales-vitrina" rows={data.items} columns={columns} getKey={(row) => row.code} entityLabel="publicaciones" searchText={(row) => `${row.title} ${row.slug} ${row.city} ${row.zone ?? ""}`} searchPlaceholder="Buscar tour, ciudad o zona" metrics={metrics} filters={filters} sorts={sorts} emptyTitle="Aún no publica tours en la vitrina" />;
}

export function BookingsTable({ rows }: { rows: ShowcaseBooking[] }) {
  const columns: Column<ShowcaseBooking>[] = [
    { id: "code", header: "Reserva", mobile: "title", cell: (row) => <span><b className="font-mono text-[12.5px]">{row.code}</b><span className="block text-[12px] text-fg-3">{row.listing.title}</span></span> },
    { id: "date", header: "Salida", cell: (row) => <span className="whitespace-nowrap text-[13px]">{formatDate(row.service_date)} · {row.start_time}</span> },
    { id: "traveler", header: "Viajero", cell: (row) => <span className="text-[13px]">{row.traveler_name}<span className="block text-[12px] text-fg-3">{row.traveler_email} · {LANGUAGE_LABELS[row.language] ?? row.language}</span></span> },
    { id: "pax", header: "Pax", align: "right", cell: (row) => <span className="font-mono text-[13px]">{row.pax}</span> },
    { id: "fee", header: "Cargo", align: "right", wideOnly: true, cell: (row) => <span className="text-[13px]">{Number(row.fee_amount) > 0 ? formatMoney(row.fee_amount, "PEN") : "—"}<span className="block text-[11.5px] text-fg-3">{FEE_BASIS[row.fee_basis]}{row.commission_pct ? ` · ${row.commission_pct} %` : ""}</span></span> },
    { id: "status", header: "Estado", mobile: "detail", cell: (row) => <VitrinaBadge status={row.status} /> },
    {
      id: "actions",
      header: "",
      cell: (row) =>
        row.can_mark ? (
          <RowActions>
            <QuickAction id={`vt-att-${row.code}`} label="Asistió" title="Marcar asistencia" description={`${row.traveler_name} · ${row.pax} personas. Solo quien asistió puede reseñar el tour.`} submitLabel="Asistió" action={markAttendance} fields={{ code: row.code, status: "asistio" }} icon={<UserCheck size={14} />} tone="ok" />
            <QuickAction id={`vt-ns-${row.code}`} label="No-show" title="Marcar no-show" description={`${row.traveler_name} no se presentó. Si era un cargo por asistente, no se cobra.`} submitLabel="No se presentó" action={markAttendance} fields={{ code: row.code, status: "no_show" }} icon={<CircleSlash size={14} />} tone="warn" />
          </RowActions>
        ) : null,
    },
  ];
  const metrics: MetricFilter<ShowcaseBooking>[] = [
    { id: "pending", label: "Por marcar", tone: "info", icon: <CalendarCheck size={19} />, matches: (row) => row.can_mark },
    { id: "went", label: "Asistieron", tone: "ok", icon: <UserCheck size={19} />, matches: (row) => row.status === "asistio" },
    { id: "noshow", label: "No-show", tone: "warn", icon: <CircleSlash size={19} />, matches: (row) => row.status === "no_show" },
  ];
  const sorts: SortOption<ShowcaseBooking>[] = [{ id: "date", label: "Salida", type: "date", value: (row) => row.service_date }];
  return <DataTable screen="canales-vitrina-reservas" rows={rows} columns={columns} getKey={(row) => row.code} entityLabel="reservas" searchText={(row) => `${row.code} ${row.traveler_name} ${row.traveler_email} ${row.listing.title}`} searchPlaceholder="Buscar reserva, viajero o tour" metrics={metrics} sorts={sorts} emptyTitle="Sin reservas de la vitrina" />;
}

export function FeesPanel({ fees }: { fees: ShowcaseFees }) {
  return (
    <SimpleTable
      columns={[{ header: "Mes" }, { header: "Reservas", align: "right" }, { header: "Cupo gratis" }, { header: "Por asistente", align: "right" }, { header: "Comisiones", align: "right" }, { header: "Total", align: "right" }]}
      rows={fees.months.map((month) => ({
        key: month.month,
        cells: [
          <span key="m" className="capitalize">{monthLabel(month.month)}</span>,
          <span key="b" className="font-mono">{month.bookings}</span>,
          <span key="q" className="flex min-w-[120px] flex-col gap-1"><span className="text-[12px] text-fg-3">{month.free_used} de {month.free_quota}</span><Meter value={month.free_used} max={month.free_quota} tone={month.free_used >= month.free_quota ? "warn" : "t1"} /></span>,
          formatMoney(month.attendee_fees, month.currency),
          formatMoney(month.commissions, month.currency),
          <b key="t">{formatMoney(month.total, month.currency)}</b>,
        ],
      }))}
      empty="Aún no hay cargos: las reservas de la vitrina aparecerán aquí por mes."
    />
  );
}

export function BenefitsPanel({ data }: { data: AgencyShowcase }) {
  const plans = Object.entries(data.rules.commission_pct);
  return (
    <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
      <Card>
        <CardHeader title={`Lo que le da su plan ${data.plan.label} en la vitrina`} />
        <div className="grid gap-3 sm:grid-cols-2">
          {plans.map(([plan, pct]) => {
            const mine = plan === data.plan.code;
            return (
              <div key={plan} className={`lift rounded-tile border p-4 ${mine ? "border-brand bg-[color-mix(in_srgb,var(--brand)_7%,var(--surface))]" : "border-line"}`}>
                <p className="text-[12.5px] font-semibold text-fg-3">{plan === "none" ? "Sin plan" : plan.charAt(0).toUpperCase() + plan.slice(1)}{mine ? " · su plan" : ""}</p>
                <p className="mt-1 text-[22px] font-bold tracking-tight">{pct} %</p>
                <p className="text-[12px] text-fg-3">comisión en tours de pago</p>
                <p className="mt-2 text-[12.5px] text-fg-2">{plan === "none" ? `${data.rules.free_monthly_bookings} reservas gratis al mes; luego ${formatMoney(data.rules.fee_per_attendee, data.rules.fee_currency)} por asistente.` : "Free tours sin cargo por asistente."}</p>
              </div>
            );
          })}
        </div>
      </Card>
      <Card>
        <CardHeader title="Por qué suscribirse" />
        <ul className="flex flex-col gap-3">
          {data.benefits.map(([title, note]) => (
            <li key={title} className="flex gap-2.5 text-[13px]"><BadgeCheck size={16} className="mt-0.5 flex-none text-ok" /><span><b>{title}</b><span className="block text-fg-3">{note}</span></span></li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

export function AgencyShowcaseTabs({ data, bookings, fees }: { data: AgencyShowcase; bookings: ShowcaseBooking[]; fees: ShowcaseFees }) {
  return (
    <TabCard
      tabs={[
        { id: "publicaciones", label: "Publicaciones", count: data.items.length, content: <ListingsTable data={data} /> },
        { id: "reservas", label: "Reservas", count: bookings.length, content: <BookingsTable rows={bookings} /> },
        { id: "cargos", label: "Cargos y comisiones", content: <FeesPanel fees={fees} /> },
        { id: "beneficios", label: "Beneficios del plan", content: <BenefitsPanel data={data} /> },
      ]}
    />
  );
}
