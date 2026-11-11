"use client";

import { Baby, BellRing, CircleAlert, Clock3, FileCheck2, HeartHandshake, Lock, Send, Settings2, ShieldCheck, Users } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { runReminders, saveTravelDocRules } from "@/app/(backoffice)/operaciones/documentos-viaje/actions";
import { DataTable } from "@/components/table/DataTable";
import { RowActions, RowIcon } from "@/components/table/RowActions";
import type { Column, FilterConfig, MetricFilter, SortOption } from "@/components/table/types";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { FieldList } from "@/components/ui/Details";
import { ChipToggleGroup } from "@/components/ui/ChipToggleGroup";
import { PanelAction } from "@/components/ui/PanelAction";
import { SwitchField } from "@/components/ui/SwitchField";
import { TextField } from "@/components/ui/TextField";
import { TintTile } from "@/components/ui/Tinted";
import { formatDate, formatDateTime } from "@/lib/format";
import type { TravelDocList, TravelDocPassenger, TravelDocRow, TravelDocRules } from "@/lib/operations";
import type { StepResult } from "@/lib/server/resource";
import { statusLabel, type Tone } from "@/lib/tone";
import { ConfirmNote } from "./OpsStep";
import { TravelDocsTable } from "./TravelDocs";

const initial: StepResult = { message: null, done: false };

const href = (code: string) => `/operaciones/documentos-viaje/${code}`;

type Mapi = NonNullable<TravelDocRow["mapi"]>;

const PASSENGER_STATUS: Record<string, { label: string; tone: Tone }> = {
  completo: { label: "Completo", tone: "ok" },
  recibido: { label: "Por revisar", tone: "info" },
  pendiente: { label: "Pendiente", tone: "warn" },
  observado: { label: "Observado", tone: "bad" },
  vencido: { label: "Vencido", tone: "bad" },
};

const passengerLabel = (status: string) => PASSENGER_STATUS[status]?.label ?? statusLabel(status);

export const mapiState = (mapi: Mapi, date?: string, today?: string): { label: string; tone: Tone } => {
  if ((date && today && date < today) || (!date && mapi.used)) return { label: "Utilizada", tone: "mute" };
  return mapi.blocked ? { label: "Bloqueada", tone: "bad" } : { label: "Habilitada", tone: "ok" };
};

export function TravelDocTiles({ data }: { data: TravelDocList }) {
  const totals = data.items.reduce((sum, row) => ({ complete: sum.complete + row.documents.complete, total: sum.total + row.documents.total }), { complete: 0, total: 0 });
  const pending = data.passengers.filter((person) => person.status !== "completo");
  const blocked = data.items.filter((row) => row.mapi && row.mapi.blocked && !row.mapi.used);
  return (
    <section className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-3">
      <TintTile icon={FileCheck2} tone="ok" label="Avance documental" value={totals.total > 0 ? `${Math.round((totals.complete / totals.total) * 100)} %` : "—"} note={`${totals.complete} de ${totals.total} documentos validados`} info={<p>Documentos validados sobre todos los que piden las reservas con checklist, sin contar las canceladas.</p>} />
      <TintTile icon={Users} tone="warn" label="Pasajeros pendientes" value={pending.length} note={`De ${data.passengers.length} pasajeros`} info={<p>Pasajeros con algún documento pendiente, por revisar, observado o que vence antes del regreso.</p>} />
      <TintTile
        icon={Lock}
        tone={blocked.length ? "bad" : "ok"}
        label="Entradas MAPI retenidas"
        value={blocked.length}
        note="Reservas con ingreso por venir"
        info={blocked.length ? <p>No se emiten entradas a Machu Picchu sin la identidad validada de cada pasajero: {blocked.map((row) => row.code).join(", ")}.</p> : <p>Ninguna reserva con ingreso por venir tiene entradas retenidas.</p>}
      />
    </section>
  );
}

export function TravelPassengersTable({ data }: { data: TravelDocList }) {
  const rows = data.passengers;
  const columns: Column<TravelDocPassenger>[] = [
    {
      id: "name",
      header: "Pasajero",
      mobile: "title",
      cell: (row) => (
        <span className="block min-w-0">
          <span className="font-semibold">{row.name}</span>
          {row.minor && <Badge tone="violet" className="ml-2">Menor</Badge>}
          <small className="block text-xs text-fg-3">{[row.nationality, row.is_lead ? "Titular" : null].filter(Boolean).join(" · ") || "—"}</small>
        </span>
      ),
    },
    {
      id: "reservation",
      header: "Reserva",
      cell: (row) => (
        <Link href={href(row.reservation)} className="text-[13px] hover:underline">
          {row.reservation}
          <span className="block max-w-[200px] truncate text-xs text-fg-3">{row.reservation_title}</span>
        </Link>
      ),
    },
    {
      id: "doc",
      header: "Identidad",
      cell: (row) => (
        <span className="text-[13px]">
          <span className="font-mono">{row.doc ?? "—"}</span>
          <span className="block text-xs text-fg-3">{row.identity?.expiry ? `Vence ${formatDate(row.identity.expiry)}` : "Sin vencimiento registrado"}</span>
        </span>
      ),
    },
    { id: "missing", header: "Faltantes", wideOnly: true, cell: (row) => (row.missing.length ? <span className="block max-w-[240px] text-[12.5px] text-fg-2">{row.missing.map((item) => `${item.label} (${passengerLabel(item.status).toLowerCase()})`).join(", ")}</span> : <span className="text-[12.5px] text-ok">Nada pendiente</span>) },
    { id: "attention", header: "Atención especial", wideOnly: true, cell: (row) => (row.attention ? <Badge tone="warn">Requiere</Badge> : <span className="text-[12.5px] text-fg-3">No</span>) },
    { id: "status", header: "Estado", mobile: "detail", cell: (row) => <Badge tone={PASSENGER_STATUS[row.status]?.tone ?? "mute"}>{passengerLabel(row.status)}</Badge> },
    { id: "actions", header: "", mobile: "hidden", align: "right", cell: (row) => <RowActions><RowIcon tone="view" label="Ver checklist" href={href(row.reservation)} /></RowActions> },
  ];
  const metrics: MetricFilter<TravelDocPassenger>[] = [
    { id: "review", label: "Por revisar", tone: "info", icon: <Clock3 size={19} />, matches: (row) => row.status === "recibido" },
    { id: "observed", label: "Observados o vencidos", tone: "bad", icon: <CircleAlert size={19} />, matches: (row) => row.status === "observado" || row.status === "vencido" },
    { id: "minor", label: "Menores de edad", tone: "violet", icon: <Baby size={19} />, matches: (row) => row.minor },
    { id: "attention", label: "Con atención especial", tone: "warn", icon: <HeartHandshake size={19} />, matches: (row) => row.attention },
  ];
  const filters: FilterConfig<TravelDocPassenger>[] = [
    { id: "status", label: "Estado", options: [...new Set(rows.map((row) => row.status))].map((value) => ({ value, label: passengerLabel(value) })), value: (row) => row.status },
    { id: "nationality", label: "Nacionalidad", options: [...new Set(rows.map((row) => row.nationality ?? "Sin dato"))].sort().map((value) => ({ value, label: value })), value: (row) => row.nationality ?? "Sin dato" },
  ];
  const sorts: SortOption<TravelDocPassenger>[] = [
    { id: "travel", label: "Fecha de viaje", type: "date", value: (row) => row.travel_from },
    { id: "name", label: "Pasajero", value: (row) => row.name },
  ];
  return <DataTable screen="operaciones-documentos-pasajeros" rows={rows} columns={columns} getKey={(row) => row.id} entityLabel="pasajeros" searchText={(row) => `${row.name} ${row.doc ?? ""} ${row.reservation} ${row.nationality ?? ""}`} searchPlaceholder="Buscar pasajero, documento o reserva" metrics={metrics} filters={filters} sorts={sorts} emptyTitle="Sin pasajeros con checklist" />;
}

interface MapiEntry {
  key: string;
  row: TravelDocRow;
  service: Mapi["services"][number];
  mapi: Mapi;
}

export function MapiTable({ data }: { data: TravelDocList }) {
  const rows: MapiEntry[] = data.items.flatMap((row) => {
    const mapi = row.mapi;
    return mapi ? mapi.services.map((service) => ({ key: `${row.code}-${service.code}`, row, service, mapi })) : [];
  });
  const state = (entry: MapiEntry) => mapiState(entry.mapi, entry.service.date, data.today);
  const columns: Column<MapiEntry>[] = [
    {
      id: "reservation",
      header: "Reserva",
      mobile: "title",
      cell: (entry) => (
        <Link href={href(entry.row.code)} className="block min-w-0 hover:underline">
          <span className="font-semibold">{entry.row.code}</span>
          <span className="block max-w-[220px] truncate text-xs text-fg-3">{entry.row.title}</span>
        </Link>
      ),
    },
    { id: "service", header: "Servicio", cell: (entry) => <span className="text-[13px]">{entry.service.name}</span> },
    { id: "date", header: "Ingreso", cell: (entry) => <span className="text-[13px]">{formatDate(entry.service.date)}</span> },
    { id: "pax", header: "Pax", align: "right", wideOnly: true, cell: (entry) => <span className="font-mono text-[13px]">{entry.service.pax ?? entry.row.passengers}</span> },
    { id: "state", header: "Emisión", mobile: "detail", cell: (entry) => <Badge tone={state(entry).tone}>{state(entry).label}</Badge> },
    { id: "missing", header: "Pasajeros con faltantes", cell: (entry) => (entry.mapi.missing.length ? <span className="block max-w-[260px] text-[12.5px] text-fg-2">{entry.mapi.missing.map((item) => `${item.name}: ${item.documents.join(" y ").toLowerCase()}`).join(" · ")}</span> : <span className="text-[12.5px] text-ok">Todos listos</span>) },
  ];
  const filters: FilterConfig<MapiEntry>[] = [{ id: "state", label: "Emisión", options: ["Bloqueada", "Habilitada", "Utilizada"].map((value) => ({ value, label: value })), value: (entry) => state(entry).label }];
  const sorts: SortOption<MapiEntry>[] = [{ id: "date", label: "Fecha de ingreso", type: "date", value: (entry) => entry.service.date }];
  return <DataTable screen="operaciones-documentos-mapi" rows={rows} columns={columns} getKey={(entry) => entry.key} entityLabel="entradas" searchText={(entry) => `${entry.row.code} ${entry.row.title} ${entry.service.name}`} searchPlaceholder="Buscar reserva o servicio" filters={filters} sorts={sorts} emptyTitle="Sin reservas con entradas nominativas" />;
}

function TrekkingSwitch({ defaultValue }: { defaultValue: boolean }) {
  const [checked, setChecked] = useState(defaultValue);
  return <SwitchField label="Seguro obligatorio en trekking o altura" name="insurance_trekking" checked={checked} onCheckedChange={setChecked} hint="Para todo pasajero de programas de categoría Aventura, además de los extranjeros." />;
}

function RulesAction({ rules }: { rules: TravelDocRules }) {
  return (
    <PanelAction<StepResult>
      label="Editar reglas"
      icon={<Settings2 size={16} />}
      size="sm"
      formId="travel-doc-rules"
      title="Reglas y recordatorios"
      description="Se aplican al calcular qué documentos pide cada pasajero y al validar su pasaporte."
      submitLabel="Guardar"
      action={saveTravelDocRules}
      initial={initial}
    >
      {() => (
        <>
          <TextField label="Días de aviso antes del viaje" name="reminder_days" required defaultValue={rules.reminder_days.join(", ")} hint="Separados por comas, de 1 a 120. Hasta 6 avisos; también sale cada día por debajo del menor." placeholder="15, 7, 3" />
          <ChipToggleGroup label="Canales" name="channels" options={["Email", "WhatsApp"].map((value) => ({ value, label: value }))} defaultValue={rules.channels} hint="WhatsApp queda registrado, pero aún no tiene proveedor de envío conectado." />
          <TextField label="Vigencia mínima del pasaporte (meses)" name="passport_months" type="number" min="0" max="24" required defaultValue={rules.passport_months} hint="Meses que el pasaporte de un extranjero debe seguir vigente después del regreso." />
          <TextField label="Nacionalidades que piden visa" name="visa_nationalities" defaultValue={rules.visa_nationalities.join(", ")} hint="Separadas por comas. Vacío: no se pide visa a nadie." placeholder="China, India, Vietnamita" />
          <TrekkingSwitch defaultValue={rules.insurance_trekking} />
        </>
      )}
    </PanelAction>
  );
}

function RunRemindersAction() {
  return (
    <PanelAction<StepResult> label="Ejecutar ahora" icon={<Send size={16} />} size="sm" formId="travel-doc-run" title="Ejecutar recordatorios" description="Envía hoy los recordatorios que correspondan. Una reserva no recibe dos avisos automáticos el mismo día." submitLabel="Ejecutar" action={runReminders} initial={initial}>
      {() => <ConfirmNote>El resultado queda en el historial del proceso.</ConfirmNote>}
    </PanelAction>
  );
}

export function TravelDocRulesSection({ rules, canManage }: { rules: TravelDocRules; canManage: boolean }) {
  const job = rules.job;
  return (
    <div className="grid items-start gap-5 xl:grid-cols-2">
      <section className="lift rounded-tile border border-line p-4">
        <p className="mb-3 flex items-center gap-1.5 text-[14px] font-semibold">
          <ShieldCheck size={16} className="text-fg-3" /> Reglas aplicadas
        </p>
        <ul className="flex flex-col gap-2">
          {rules.rules.map((rule) => (
            <li key={rule.code} className="flex items-start gap-3 text-[13px]">
              <span className="flex-none rounded bg-surface-2 px-1.5 font-mono text-[11.5px] text-fg-2">{rule.code}</span>
              <span className="text-fg-2">{rule.text}</span>
            </li>
          ))}
        </ul>
      </section>
      <section className="lift rounded-tile border border-line p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 text-[14px] font-semibold">
            <BellRing size={16} className="text-fg-3" /> Recordatorio automático
          </p>
          {canManage && (
            <span className="flex gap-2">
              <RulesAction rules={rules} />
              {job && !job.paused && <RunRemindersAction />}
            </span>
          )}
        </div>
        <FieldList
          fields={[
            { label: "Avisos", value: rules.reminder_days.map((day) => `${day} días`).join(" · ") },
            { label: "Canales", value: rules.channels.join(" + ") },
            { label: "Pasaporte", value: `${rules.passport_months} meses después del regreso` },
            { label: "Visa", value: rules.visa_nationalities.length ? rules.visa_nationalities.join(", ") : "No se pide" },
            { label: "Seguro", value: rules.insurance_trekking ? "Extranjeros y trekking" : "Solo extranjeros" },
            { label: "Proceso", value: job ? `${job.name}${job.schedule ? ` · ${job.schedule}` : ""}` : "—" },
            { label: "Estado", value: job ? job.paused ? <Badge tone="warn">En pausa</Badge> : job.last_status ? <StatusBadge status={job.last_status} /> : "Sin ejecutar" : "—" },
            { label: "Última ejecución", value: job?.last_run_at ? formatDateTime(job.last_run_at) : "—" },
            { label: "Resultado", value: job?.last_result ?? "—" },
            { label: "Próxima", value: job?.next_run_at ? formatDateTime(job.next_run_at) : "—" },
          ]}
        />
        {!canManage && <p className="mt-3 text-[12.5px] text-fg-3">Operaciones cambia las reglas y ejecuta el proceso.</p>}
      </section>
    </div>
  );
}

export function TravelDocsWorkspace({ data, rules, section }: { data: TravelDocList; rules?: TravelDocRules | null; section: "reservations" | "passengers" | "mapi" | "rules" }) {
  if (section === "passengers") return <TravelPassengersTable data={data} />;
  if (section === "mapi") return <MapiTable data={data} />;
  if (section === "rules") return rules ? <TravelDocRulesSection rules={rules} canManage={data.can.manage} /> : null;
  return <TravelDocsTable data={data} />;
}
