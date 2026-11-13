"use client";

import { AlertTriangle, CircleCheck, Globe2, KeyRound, Link2, Pause, Play, Plus, Power, RefreshCw, Share2, Ticket, XCircle } from "lucide-react";
import { useActionState, useState, type ReactNode } from "react";
import { otaConnectionStep, saveOtaConnection, saveOtaMapping } from "@/app/(backoffice)/canales/ota/actions";
import { DataTable } from "@/components/table/DataTable";
import { RowIcon } from "@/components/table/RowActions";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { PanelAction } from "@/components/ui/PanelAction";
import { SelectField } from "@/components/ui/SelectField";
import { SwitchField } from "@/components/ui/SwitchField";
import { Tabs } from "@/components/ui/Tabs";
import { TextField } from "@/components/ui/TextField";
import { TintTile } from "@/components/ui/Tinted";
import { cn } from "@/lib/cn";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { labelOptions, type OtaBooking, type OtaConnection, type OtaMapping, type OtaOverview, type Option } from "@/lib/growth";
import type { StepResult } from "@/lib/server/resource";
import { toneStyle } from "@/lib/tone";
import { KpiRow, PlanNotice, StatusPill } from "./GrowthUi";

const initial: StepResult = { message: null, done: false };

export interface MappingSet {
  code: string;
  mappings: OtaMapping[];
  products: (Option & { mapped: boolean })[];
}

function ConnectionForm({ overview, connection }: { overview: OtaOverview; connection?: OtaConnection }) {
  const [sync, setSync] = useState(connection?.sync_availability ?? true);
  return (
    <PanelAction<StepResult>
      label="Conectar OTA"
      icon={<Plus size={16} strokeWidth={2.4} />}
      variant={connection ? "ghost" : "primary"}
      size={connection ? "sm" : "md"}
      formId={connection ? `ota-${connection.code}` : "ota-nueva"}
      title={connection ? `Editar ${connection.name}` : "Conectar una OTA"}
      description="La clave se guarda cifrada y se verifica con la OTA. Nunca se muestra de nuevo."
      submitLabel={connection ? "Guardar cambios" : "Conectar y verificar"}
      action={saveOtaConnection}
      initial={initial}
      testId={connection ? undefined : "ota-create"}
      trigger={connection ? (open) => <Button size="sm" variant="ghost" onClick={open}>Editar</Button> : undefined}
    >
      {() => (
        <>
          {connection && <input type="hidden" name="code" value={connection.code} />}
          {connection && <input type="hidden" name="lock_version" value={connection.lock_version} />}
          <input type="hidden" name="sync_availability" value={sync ? "1" : "0"} />
          {!connection && <SelectField label="OTA" name="ota" options={labelOptions(overview.catalogs.otas)} defaultValue="viator" />}
          <TextField label="Nombre" name="name" required minLength={3} maxLength={120} defaultValue={connection?.name} icon={<Share2 size={17} />} />
          <TextField label="Cuenta de proveedor" name="account_ref" maxLength={120} defaultValue={connection?.account_ref ?? undefined} hint="El código de proveedor que te asignó la OTA." />
          <TextField label={connection ? "Nueva clave de la API" : "Clave de la API"} name="api_key" required={!connection} minLength={8} maxLength={500} revealable icon={<KeyRound size={17} />} hint={connection ? "Déjala vacía para conservar la actual." : undefined} />
          <div className="grid grid-cols-2 gap-3">
            <TextField label="Comisión de la OTA (%)" name="commission_pct" type="number" step="0.01" min={0} max={60} defaultValue={connection?.commission_pct ?? "20"} />
            <TextField label="Margen sobre la tarifa (%)" name="markup_pct" type="number" step="0.01" min={-20} max={100} defaultValue={connection?.markup_pct ?? "0"} />
          </div>
          <SwitchField label="Publicar disponibilidad" name="sync_switch" checked={sync} onCheckedChange={setSync} hint="Se publica la disponibilidad real menos los bloqueos vigentes." />
        </>
      )}
    </PanelAction>
  );
}

function StepButton({ connection, step, label, icon, disabled }: { connection: OtaConnection; step: string; label: string; icon: ReactNode; disabled?: boolean }) {
  const [state, run, pending] = useActionState(otaConnectionStep, initial);
  return (
    <form action={run} className="contents">
      <input type="hidden" name="code" value={connection.code} />
      <input type="hidden" name="lock_version" value={connection.lock_version} />
      <input type="hidden" name="step" value={step} />
      <Button type="submit" size="sm" variant="secondary" icon={icon} disabled={pending || disabled} title={state.message ?? undefined}>
        {pending ? "Un momento…" : label}
      </Button>
      {state.message && <p className="basis-full text-[12px] text-bad">{state.message}</p>}
    </form>
  );
}

function MappingForm({ connection, set, overview }: { connection: OtaConnection; set: MappingSet | undefined; overview: OtaOverview }) {
  const [mode, setMode] = useState("markup");
  return (
    <PanelAction<StepResult>
      label="Mapear productos"
      formId={`mapeo-${connection.code}`}
      title={`Mapeo de productos · ${connection.name}`}
      description="Une cada producto del catálogo con su código en la OTA y define cómo se calcula el precio."
      submitLabel="Guardar mapeo"
      action={saveOtaMapping}
      initial={initial}
      trigger={(open) => <Button size="sm" variant="secondary" icon={<Link2 size={14} />} onClick={open} disabled={connection.status === "desconectado"}>Mapear</Button>}
    >
      {() => (
        <>
          <input type="hidden" name="code" value={connection.code} />
          <ul className="grid gap-2">
            {(set?.mappings ?? []).length === 0 && <li className="text-[13px] text-fg-3">Aún no hay productos mapeados.</li>}
            {(set?.mappings ?? []).map((mapping) => (
              <li key={mapping.product.code} className="flex items-center justify-between gap-3 rounded-xl border border-line px-3.5 py-2.5 text-[13px]">
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{mapping.product.name}</span>
                  <span className="block font-mono text-[11.5px] text-fg-3">{mapping.ota_product_ref}{mapping.ota_option_ref ? ` · ${mapping.ota_option_ref}` : ""} · {mapping.price_mode_label}</span>
                </span>
                <StatusPill status={mapping.status} label={mapping.status_label} />
              </li>
            ))}
          </ul>
          <p className="border-t border-line pt-3 text-[13px] font-semibold">Agregar o actualizar un mapeo</p>
          <SelectField label="Producto del catálogo" name="product" searchable options={(set?.products ?? []).map((product) => ({ value: product.value, label: product.label, hint: product.mapped ? "Ya mapeado: se actualiza" : undefined }))} placeholder="Elegir producto" />
          <div className="grid grid-cols-2 gap-3">
            <TextField label="Código en la OTA" name="ota_product_ref" required maxLength={120} />
            <TextField label="Opción (si aplica)" name="ota_option_ref" maxLength={120} />
          </div>
          <SelectField label="Precio para la OTA" name="price_mode" options={labelOptions(overview.catalogs.price_modes)} value={mode} onChange={setMode} />
          {mode === "fijo" && <TextField label="Precio fijo" name="fixed_price" type="number" step="0.01" min={0} required />}
          <SelectField label="Estado" name="status" options={labelOptions(overview.catalogs.mapping_statuses)} defaultValue="pendiente" />
        </>
      )}
    </PanelAction>
  );
}

function ConnectionCard({ connection, overview, set, index }: { connection: OtaConnection; overview: OtaOverview; set: MappingSet | undefined; index: number }) {
  const off = connection.status === "desconectado";
  return (
    <li style={{ ...toneStyle(connection.status === "error" ? "bad" : connection.status === "conectado" ? "t1" : "mute"), animationDelay: `${index * 60}ms` }} className={cn("lift flex animate-[rise-in_420ms_cubic-bezier(0.22,1,0.36,1)_backwards] flex-col gap-3 rounded-tile border border-line bg-surface p-4", off && "bg-surface-2/40")}>
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 flex-none place-items-center rounded-xl bg-[color-mix(in_srgb,var(--tint)_14%,transparent)] text-[var(--tint)]">
          <Globe2 size={19} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="font-semibold leading-snug">{connection.name}</p>
            <StatusPill status={connection.status} label={connection.status_label} />
          </div>
          <p className="mt-0.5 text-[12.5px] text-fg-3">
            {connection.ota_label} · <span className="font-mono">{connection.code}</span>
            {connection.account_ref ? ` · ${connection.account_ref}` : ""}
          </p>
        </div>
      </div>
      <dl className="grid grid-cols-3 gap-2 text-center">
        {[
          { label: "Productos", value: `${connection.mappings.active}/${connection.mappings.total}` },
          { label: "Reservas", value: connection.bookings.total },
          { label: "Comisión", value: `${Number(connection.commission_pct)} %` },
        ].map((item) => (
          <div key={item.label} className="rounded-xl bg-surface-2 px-2 py-2">
            <dt className="text-[11px] text-fg-3">{item.label}</dt>
            <dd className="text-[15px] font-bold">{item.value}</dd>
          </div>
        ))}
      </dl>
      {connection.last_error && (
        <p className="flex items-start gap-1.5 rounded-lg bg-[color-mix(in_srgb,var(--bad)_8%,var(--surface))] px-3 py-2 text-[12.5px] text-bad">
          <AlertTriangle size={14} className="mt-0.5 flex-none" />
          {connection.last_error}
        </p>
      )}
      <p className="text-[12px] text-fg-3">{connection.last_sync_at ? `Última sincronización ${formatDateTime(connection.last_sync_at)}` : "Aún sin sincronizar"}</p>
      {!off && (
        <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-line pt-3">
          <StepButton connection={connection} step="sync" label="Sincronizar" icon={<RefreshCw size={14} />} disabled={!["conectado", "error"].includes(connection.status)} />
          {connection.status === "conectado" && <StepButton connection={connection} step="pausar" label="Pausar" icon={<Pause size={14} />} />}
          {connection.status === "pausado" && <StepButton connection={connection} step="reanudar" label="Reanudar" icon={<Play size={14} />} />}
          <MappingForm connection={connection} set={set} overview={overview} />
          <ConnectionForm overview={overview} connection={connection} />
          <StepButton connection={connection} step="desconectar" label="Desconectar" icon={<Power size={14} />} />
        </div>
      )}
    </li>
  );
}

function BookingsTable({ bookings, overview }: { bookings: OtaBooking[]; overview: OtaOverview }) {
  return (
    <DataTable
      screen="canales-ota-reservas"
      rows={bookings}
      getKey={(booking) => booking.id}
      entityLabel="reservas recibidas"
      searchText={(booking) => `${booking.ota_booking_ref} ${booking.product?.name ?? ""} ${booking.reservation ?? ""}`}
      searchPlaceholder="Buscar por referencia o producto"
      metrics={[
        { id: "confirmada", label: "Confirmadas", tone: "ok", icon: <CircleCheck size={18} />, matches: (booking) => booking.status === "confirmada" },
        { id: "rechazada", label: "Rechazadas o con error", tone: "bad", icon: <XCircle size={18} />, matches: (booking) => booking.status === "rechazada" || booking.status === "error" },
      ]}
      filters={[
        { id: "status", label: "Estado", options: labelOptions(overview.catalogs.booking_statuses), value: (booking) => booking.status },
        { id: "connection", label: "Conexión", options: overview.connections.map((connection) => ({ value: connection.code, label: connection.name })), value: (booking) => booking.connection.code },
      ]}
      sorts={[{ id: "received", label: "Recibida", type: "date", value: (booking) => booking.received_at }]}
      emptyTitle="Aún no llegan reservas de las OTAs"
      columns={[
        { id: "ref", header: "Referencia", mobile: "title", cell: (booking) => <div><p className="font-mono font-semibold">{booking.ota_booking_ref}</p><p className="text-[12px] text-fg-3">{booking.connection.ota_label}</p></div> },
        { id: "product", header: "Producto", cell: (booking) => <span className="text-[13px]">{booking.product?.name ?? "Sin mapeo"}</span> },
        { id: "travel", header: "Viaje", cell: (booking) => <span className="text-[13px] text-fg-2">{booking.travel_date ? formatDate(booking.travel_date) : "—"}{booking.pax ? ` · ${booking.pax} pax` : ""}</span> },
        { id: "amount", header: "Monto", align: "right", cell: (booking) => (booking.gross_amount ? <span className="text-[13px] font-semibold">{formatMoney(booking.gross_amount, booking.currency ?? "USD")}</span> : <span className="text-fg-3">—</span>) },
        { id: "status", header: "Estado", cell: (booking) => <div><StatusPill status={booking.status} label={booking.status_label} />{booking.error && <p className="mt-1 max-w-[240px] truncate text-[11.5px] text-bad" title={booking.error}>{booking.error}</p>}</div> },
        { id: "reservation", header: "Reserva", align: "right", cell: (booking) => (booking.reservation ? <RowIcon tone="view" label={`Ver ${booking.reservation}`} href={`/reservas/${booking.reservation}`} /> : <span className="text-fg-3">—</span>) },
      ]}
    />
  );
}

export function OtaBoard({ overview, bookings, mappings }: { overview: OtaOverview; bookings: OtaBooking[]; mappings: MappingSet[] }) {
  const { kpis } = overview;
  return (
    <>
      <PlanNotice enabled={overview.enabled} feature="La conexión con OTAs" />
      <KpiRow>
        <TintTile icon={Share2} tone="t1" label="OTAs conectadas" value={kpis.connected} note={`de ${overview.connections.length} conexiones`} info={<p>Conexiones con la clave verificada que publican disponibilidad y reciben reservas.</p>} />
        <TintTile icon={Link2} tone="violet" label="Productos publicados" value={kpis.mapped} info={<p>Mapeos activos: productos del catálogo enlazados con su código en alguna OTA.</p>} />
        <TintTile icon={Ticket} tone="ok" label="Reservas en 30 días" value={kpis.bookings_30} info={<p>Reservas que enviaron las OTAs en los últimos 30 días, confirmadas o no.</p>} />
        <TintTile icon={AlertTriangle} tone="bad" label="Errores" value={kpis.errors} info={<p>Conexiones con error de sincronización más reservas rechazadas o con error en los últimos 30 días.</p>} />
      </KpiRow>
      <section className="overflow-hidden rounded-card border border-line bg-surface shadow-card">
        <Tabs
          tabs={[
            {
              id: "conexiones",
              label: "Conexiones",
              count: overview.connections.length,
              content: (
                <>
                  <div className="mb-4 flex justify-end">
                    <ConnectionForm overview={overview} />
                  </div>
                  {overview.connections.length === 0 ? (
                    <EmptyState icon={<Share2 size={22} />} title="Aún no hay OTAs conectadas" description="Conecta Viator, GetYourGuide, Expedia, Google Things to Do o Civitatis con la clave que te dio la OTA." />
                  ) : (
                    <ul className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
                      {overview.connections.map((connection, index) => (
                        <ConnectionCard key={connection.code} connection={connection} overview={overview} set={mappings.find((set) => set.code === connection.code)} index={index} />
                      ))}
                    </ul>
                  )}
                </>
              ),
            },
            { id: "reservas", label: "Reservas recibidas", count: bookings.length, content: <BookingsTable bookings={bookings} overview={overview} /> },
          ]}
        />
      </section>
    </>
  );
}
