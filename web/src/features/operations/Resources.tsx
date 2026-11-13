"use client";

import { Bus, CalendarCheck, CircleCheck, Clock3, IdCard, Phone, Plus, ShieldAlert, Smartphone, Star, Truck, UserRound, UserRoundX } from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { DataTable } from "@/components/table/DataTable";
import { RowActions, RowIcon } from "@/components/table/RowActions";
import type { Column, FilterConfig, MetricFilter, SortOption } from "@/components/table/types";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { ChoiceGroup } from "@/components/ui/ChoiceGroup";
import { SelectField } from "@/components/ui/SelectField";
import { SidePanel } from "@/components/ui/SidePanel";
import { Tabs } from "@/components/ui/Tabs";
import { TextField } from "@/components/ui/TextField";
import { cn } from "@/lib/cn";
import { formatDate, initials } from "@/lib/format";
import { DOCUMENT_STATE, LICENSE_CLASSES, PERSON_STATUS, VEHICLE_STATUS, type Assignment, type Driver, type Guide, type LinkableUser, type LinkedUser, type ResourceAvailability, type ResourceDeparture, type ResourceOverview, type Vehicle } from "@/lib/operations";
import { statusLabel, toneStyle, type Tone } from "@/lib/tone";
import { AvailabilityMatrix } from "./AvailabilityMatrix";
import { AssignAction, AssignmentQuickActions } from "./OrderActions";
import { TimeSlot } from "./OpsBits";
import { ConfirmNote, OpsStep, ToggleChips } from "./OpsStep";

type Kind = "guide" | "driver" | "vehicle";

const LABEL: Record<Kind, string> = { guide: "guía", driver: "conductor", vehicle: "vehículo" };

const unique = (values: string[]) => [...new Set(values)].sort((a, b) => a.localeCompare(b, "es"));

const missingResources = (row: Assignment) => [row.guide ? null : "guía", row.driver ? null : "conductor", row.vehicle ? null : "vehículo"].filter((item): item is string => item !== null);

function NextService({ next, upcoming }: { next: Assignment | null; upcoming: number }) {
  if (!next) return <span className="text-[12.5px] text-fg-3">Sin servicios próximos</span>;
  return (
    <span className="block min-w-0 text-[13px]">
      <b className="block truncate font-medium">{next.label}</b>
      <span className="text-xs text-fg-3">
        {formatDate(next.date)} {next.time ?? ""}
        {upcoming > 1 ? ` · ${upcoming - 1} más` : ""}
      </span>
    </span>
  );
}

type AgendaEntry = { source: "order"; key: string; date: string; time: string | null; assignment: Assignment } | { source: "departure"; key: string; date: string; time: string | null; departure: ResourceDeparture };

function AgendaPanel({ title, subtitle, assignments, departures }: { title: string; subtitle: string; assignments: Assignment[]; departures: ResourceDeparture[] }) {
  const [open, setOpen] = useState(false);
  const entries: AgendaEntry[] = [
    ...assignments.map((item): AgendaEntry => ({ source: "order", key: item.id, date: item.date, time: item.time, assignment: item })),
    ...departures.map((item): AgendaEntry => ({ source: "departure", key: `${item.ref}-${item.date}`, date: item.date, time: item.time, departure: item })),
  ].sort((a, b) => `${a.date} ${a.time ?? "99:99"}`.localeCompare(`${b.date} ${b.time ?? "99:99"}`));
  return (
    <>
      <RowIcon tone="view" label="Ver agenda" onClick={() => setOpen(true)} />
      <SidePanel open={open} onOpenChange={setOpen} title={title} description={subtitle}>
        {entries.length === 0 ? (
          <p className="text-[13.5px] text-fg-3">No tiene servicios ni salidas desde hoy.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {entries.map((entry, index) => (
              <li key={entry.key} style={{ animationDelay: `${index * 40}ms` }} className="lift animate-[rise-in_420ms_cubic-bezier(0.22,1,0.36,1)_backwards] rounded-[12px] bg-surface-2 px-3 py-2.5">
                {entry.source === "order" ? (
                  <>
                    <span className="flex items-center justify-between gap-2">
                      <b className="truncate text-[13.5px] font-semibold">{entry.assignment.label}</b>
                      <StatusBadge status={entry.assignment.status} />
                    </span>
                    <span className="text-xs text-fg-3">
                      {formatDate(entry.date)} · {entry.time ?? "—"} ·{" "}
                      <Link href={`/operaciones/ordenes/${entry.assignment.order_code}`} className="hover:text-accent hover:underline">
                        {entry.assignment.order_code}
                      </Link>
                    </span>
                  </>
                ) : (
                  <>
                    <span className="flex items-center justify-between gap-2">
                      <b className="truncate text-[13.5px] font-semibold">{entry.departure.label}</b>
                      <Badge tone="violet">Salida programada</Badge>
                    </span>
                    <span className="text-xs text-fg-3">
                      {formatDate(entry.date)} · {entry.time ?? "—"} ·{" "}
                      <Link href="/catalogo/salidas" className="hover:text-accent hover:underline">
                        {entry.departure.ref}
                      </Link>
                    </span>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </SidePanel>
    </>
  );
}

function ArchiveAction({ kind, id, name, upcoming }: { kind: Kind; id: string; name: string; upcoming: number }) {
  if (upcoming > 0) return <RowIcon tone="delete" label="Dar de baja" disabledHint={`Tiene ${upcoming} servicio(s) por delante`} />;
  return (
    <OpsStep step="resource_archive" target={`${kind}/${id}`} label="Dar de baja" title={`Dar de baja al ${LABEL[kind]}`} description={name} submitLabel="Dar de baja" trigger={(open) => <RowIcon tone="delete" label="Dar de baja" onClick={open} />}>
      <ConfirmNote tone="warn">Deja de aparecer en las listas de asignación. Su historial de servicios se conserva.</ConfirmNote>
    </OpsStep>
  );
}

function StatusChoice({ value, options }: { value: string; options: string[] }) {
  return <ChoiceGroup label="Estado" name="status" options={options.map((status) => ({ value: status, label: statusLabel(status) }))} defaultValue={value} />;
}

function UserLink({ users, current, resourceId, role }: { users: LinkableUser[] | undefined; current: string | null; resourceId?: string; role: string }) {
  if (!users) return null;
  const options = users.filter((user) => user.resource_id === null || user.resource_id === resourceId).map((user) => ({ value: user.value, label: user.label, hint: user.hint }));
  return <SelectField label="Usuario de la app" name="user_id" options={options} defaultValue={current ?? ""} placeholder="Sin usuario vinculado" searchable clearable hint={`Solo usuarios activos con el rol ${role} que no estén vinculados a otro recurso. Con el vínculo, ve sus servicios en la app del operador.`} />;
}

function AppAccess({ user }: { user: LinkedUser | null }) {
  if (!user) return <span className="text-[12.5px] text-fg-3">Sin usuario</span>;
  return (
    <span className="flex min-w-0 items-center gap-1.5 text-[12.5px]" title={user.email}>
      <Smartphone size={14} className="flex-none text-ok" />
      <span className="truncate">{user.name}</span>
    </span>
  );
}

export function GuideForm({ guide, languages, users, trigger }: { guide?: Guide; languages: ResourceOverview["languages"]; users?: LinkableUser[]; trigger?: (open: () => void) => ReactNode }) {
  return (
    <OpsStep step="guide_save" target={guide?.id ?? ""} formKey={guide?.id ?? "guide-new"} label="Nuevo guía" icon={<Plus size={16} strokeWidth={2.4} />} variant="primary" title={guide ? "Editar guía" : "Nuevo guía"} description={guide ? `${guide.name} · ${guide.code}` : "Queda disponible para asignar desde hoy."} submitLabel={guide ? "Guardar cambios" : "Registrar guía"} trigger={trigger}>
      <TextField label="Nombre completo" name="full_name" required minLength={3} maxLength={150} defaultValue={guide?.name ?? ""} icon={<UserRound size={17} />} />
      <ToggleChips label="Idiomas" name="languages" options={languages} defaultValue={guide?.languages ?? ["ES"]} hint="Se comparan con la nacionalidad de los pasajeros al asignar." />
      <div className="grid grid-cols-[1.3fr_0.7fr] gap-3">
        <TextField label="Carné oficial" name="license_number" required maxLength={40} defaultValue={guide?.license ?? ""} icon={<IdCard size={17} />} placeholder="GOT-CUS-0000" />
        <TextField label="Calificación" name="rating" type="number" step="0.1" min="0" max="5" defaultValue={guide?.rating ?? ""} icon={<Star size={16} />} />
      </div>
      <TextField label="Teléfono" name="phone" maxLength={30} defaultValue={guide?.phone ?? ""} icon={<Phone size={16} />} />
      <UserLink users={users} current={guide?.user?.id ?? null} resourceId={guide?.id} role="Guía" />
      <StatusChoice value={guide?.status ?? "disponible"} options={PERSON_STATUS} />
    </OpsStep>
  );
}

export function DriverForm({ driver, users, trigger }: { driver?: Driver; users?: LinkableUser[]; trigger?: (open: () => void) => ReactNode }) {
  return (
    <OpsStep step="driver_save" target={driver?.id ?? ""} formKey={driver?.id ?? "driver-new"} label="Nuevo conductor" icon={<Plus size={16} strokeWidth={2.4} />} variant="primary" title={driver ? "Editar conductor" : "Nuevo conductor"} description={driver ? `${driver.name} · ${driver.code}` : "La licencia se valida contra la fecha de cada servicio."} submitLabel={driver ? "Guardar cambios" : "Registrar conductor"} trigger={trigger}>
      <TextField label="Nombre completo" name="full_name" required minLength={3} maxLength={150} defaultValue={driver?.name ?? ""} icon={<UserRound size={17} />} />
      <div className="grid grid-cols-[0.8fr_1.2fr] gap-3">
        <SelectField label="Categoría" name="license_class" options={LICENSE_CLASSES.map((value) => ({ value, label: value }))} defaultValue={driver?.license_class ?? "A-IIIb"} />
        <TextField label="Licencia" name="license_number" required maxLength={40} defaultValue={driver?.license ?? ""} icon={<IdCard size={17} />} />
      </div>
      <TextField label="Vence" name="license_expires_on" type="date" required defaultValue={driver?.expires_on ?? ""} />
      <TextField label="Teléfono" name="phone" maxLength={30} defaultValue={driver?.phone ?? ""} icon={<Phone size={16} />} />
      <UserLink users={users} current={driver?.user?.id ?? null} resourceId={driver?.id} role="Conductor" />
      <StatusChoice value={driver?.status ?? "disponible"} options={PERSON_STATUS} />
    </OpsStep>
  );
}

export function VehicleForm({ vehicle, carriers, trigger }: { vehicle?: Vehicle; carriers: ResourceOverview["carriers"]; trigger?: (open: () => void) => ReactNode }) {
  return (
    <OpsStep step="vehicle_save" target={vehicle?.id ?? ""} formKey={vehicle?.id ?? "vehicle-new"} label="Nuevo vehículo" icon={<Plus size={16} strokeWidth={2.4} />} variant="primary" title={vehicle ? "Editar vehículo" : "Nuevo vehículo"} description={vehicle ? `${vehicle.plate} · ${vehicle.type}` : "La capacidad se compara con el tamaño del grupo al asignar."} submitLabel={vehicle ? "Guardar cambios" : "Registrar vehículo"} trigger={trigger}>
      <div className="grid grid-cols-[0.9fr_1.1fr] gap-3">
        <TextField label="Placa" name="plate" required minLength={5} maxLength={12} defaultValue={vehicle?.plate ?? ""} placeholder="X4F-821" />
        <TextField label="Plazas" name="capacity" type="number" min="1" max="80" required defaultValue={vehicle?.capacity ?? ""} icon={<Bus size={16} />} />
      </div>
      <TextField label="Tipo" name="vehicle_type" required minLength={3} maxLength={60} defaultValue={vehicle?.type ?? ""} placeholder="Sprinter 19 pax" />
      <SelectField label="Transportista" name="provider_id" options={carriers.map((carrier) => ({ value: carrier.id, label: carrier.name }))} defaultValue={vehicle?.provider_id ?? ""} placeholder="Flota propia" />
      <TextField label="SOAT vence" name="soat_expires_on" type="date" required defaultValue={vehicle?.soat_expires_on ?? ""} />
      <StatusChoice value={vehicle?.status ?? "disponible"} options={VEHICLE_STATUS} />
    </OpsStep>
  );
}

function DocBadge({ state, date }: { state: Driver["document"]; date: string }) {
  const meta = DOCUMENT_STATE[state];
  return (
    <span className="flex flex-col items-start gap-0.5">
      <Badge tone={meta.tone}>{meta.label}</Badge>
      <span className="text-xs text-fg-3">{formatDate(date)}</span>
    </span>
  );
}

function Avatar({ name, tone }: { name: string; tone: Tone }) {
  return (
    <span style={toneStyle(tone)} className="grid h-9 w-9 flex-none place-items-center rounded-[11px] bg-[var(--tint)] text-[12px] font-bold text-white transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110">
      {initials(name)}
    </span>
  );
}

function personMetrics<T extends { status: string; upcoming: number }>(extra: MetricFilter<T>[] = []): MetricFilter<T>[] {
  return [
    { id: "available", label: "Disponibles", tone: "ok", icon: <CircleCheck size={19} />, matches: (row) => row.status === "disponible" },
    { id: "busy", label: "Con servicios próximos", tone: "t1", icon: <CalendarCheck size={19} />, matches: (row) => row.upcoming > 0 },
    { id: "off", label: "Fuera de servicio", tone: "mute", icon: <UserRoundX size={19} />, matches: (row) => ["vacaciones", "mantenimiento"].includes(row.status) },
    ...extra,
  ];
}

export function ResourcesBoard({ data, availability }: { data: ResourceOverview; availability: ResourceAvailability | null }) {
  const can = data.can.assign;
  const agenda = (key: "guide" | "driver" | "vehicle", id: string) => data.assignments.filter((item) => item[key]?.id === id && item.date >= data.today && item.status !== "completada");
  const departuresOf = (kind: "guide" | "driver" | "vehicle", id: string) => (data.departures ?? []).filter((item) => item.kind === kind && item.resource_id === id);

  const guideColumns: Column<Guide>[] = [
    { id: "name", header: "Guía", mobile: "title", cell: (row) => (<span className="group flex items-center gap-3"><Avatar name={row.name} tone="t1" /><span className="min-w-0"><b className="block truncate text-[13.5px] font-semibold">{row.name}</b><span className="text-xs text-fg-3">{row.code} · {row.license}</span></span></span>) },
    { id: "languages", header: "Idiomas", cell: (row) => <span className="flex flex-wrap gap-1">{row.languages.map((code) => <span key={code} className="rounded-md bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-fg-2">{code}</span>)}</span> },
    { id: "app", header: "App del operador", wideOnly: true, cell: (row) => <AppAccess user={row.user} /> },
    { id: "rating", header: "Calificación", wideOnly: true, cell: (row) => (row.rating === null ? <span className="text-fg-3">—</span> : <span className="inline-flex items-center gap-1 text-[13px] font-semibold"><Star size={13} className="fill-current text-warn" />{row.rating.toFixed(1)}</span>) },
    { id: "next", header: "Próximo servicio", cell: (row) => <NextService next={row.next} upcoming={row.upcoming} /> },
    { id: "status", header: "Estado", cell: (row) => <StatusBadge status={row.status} /> },
    { id: "actions", header: "", mobile: "hidden", align: "right", cell: (row) => (<RowActions><AgendaPanel title={row.name} subtitle={`Agenda desde hoy · ${row.phone ?? "sin teléfono"}`} assignments={agenda("guide", row.id)} departures={departuresOf("guide", row.id)} />{can && <GuideForm guide={row} languages={data.languages} users={data.users?.guide} trigger={(open) => <RowIcon tone="edit" label="Editar" onClick={open} />} />}{can && <ArchiveAction kind="guide" id={row.id} name={row.name} upcoming={row.upcoming} />}</RowActions>) },
  ];

  const driverColumns: Column<Driver>[] = [
    { id: "name", header: "Conductor", mobile: "title", cell: (row) => (<span className="group flex items-center gap-3"><Avatar name={row.name} tone="t4" /><span className="min-w-0"><b className="block truncate text-[13.5px] font-semibold">{row.name}</b><span className="text-xs text-fg-3">{row.code} · {row.license_class ?? ""} {row.license}</span></span></span>) },
    { id: "license", header: "Licencia", cell: (row) => <DocBadge state={row.document} date={row.expires_on} /> },
    { id: "app", header: "App del operador", wideOnly: true, cell: (row) => <AppAccess user={row.user} /> },
    { id: "next", header: "Próximo servicio", cell: (row) => <NextService next={row.next} upcoming={row.upcoming} /> },
    { id: "status", header: "Estado", cell: (row) => <StatusBadge status={row.status} /> },
    { id: "actions", header: "", mobile: "hidden", align: "right", cell: (row) => (<RowActions><AgendaPanel title={row.name} subtitle={`Agenda desde hoy · ${row.phone ?? "sin teléfono"}`} assignments={agenda("driver", row.id)} departures={departuresOf("driver", row.id)} />{can && <DriverForm driver={row} users={data.users?.driver} trigger={(open) => <RowIcon tone="edit" label="Editar" onClick={open} />} />}{can && <ArchiveAction kind="driver" id={row.id} name={row.name} upcoming={row.upcoming} />}</RowActions>) },
  ];

  const vehicleColumns: Column<Vehicle>[] = [
    { id: "plate", header: "Vehículo", mobile: "title", cell: (row) => (<span className="group flex items-center gap-3"><span style={toneStyle("violet")} className="grid h-9 w-9 flex-none place-items-center rounded-[11px] bg-[var(--tint)] text-white transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110"><Truck size={16} /></span><span className="min-w-0"><b className="block truncate font-mono text-[13.5px] font-semibold">{row.plate}</b><span className="text-xs text-fg-3">{row.type} · {row.capacity} plazas</span></span></span>) },
    { id: "provider", header: "Transportista", wideOnly: true, cell: (row) => <span className="text-[13px]">{row.provider ?? "Flota propia"}</span> },
    { id: "soat", header: "SOAT", cell: (row) => <DocBadge state={row.document} date={row.soat_expires_on} /> },
    { id: "next", header: "Próximo servicio", cell: (row) => <NextService next={row.next} upcoming={row.upcoming} /> },
    { id: "status", header: "Estado", cell: (row) => <StatusBadge status={row.status} /> },
    { id: "actions", header: "", mobile: "hidden", align: "right", cell: (row) => (<RowActions><AgendaPanel title={row.plate} subtitle={`${row.type} · agenda desde hoy`} assignments={agenda("vehicle", row.id)} departures={departuresOf("vehicle", row.id)} />{can && <VehicleForm vehicle={row} carriers={data.carriers} trigger={(open) => <RowIcon tone="edit" label="Editar" onClick={open} />} />}{can && <ArchiveAction kind="vehicle" id={row.id} name={row.plate} upcoming={row.upcoming} />}</RowActions>) },
  ];

  const assignmentColumns: Column<Assignment>[] = [
    { id: "service", header: "Servicio", mobile: "title", cell: (row) => (<span className="block min-w-0"><b className="block truncate text-[13.5px] font-semibold">{row.label}</b><span className="text-xs text-fg-3"><Link href={`/operaciones/ordenes/${row.order_code}`} className="hover:text-accent hover:underline">{row.order_code}</Link> · {row.order_title}</span></span>) },
    { id: "when", header: "Fecha", cell: (row) => (<span className="text-[13px]">{formatDate(row.date)}<span className="block"><TimeSlot time={row.time} className="text-xs" /></span></span>) },
    { id: "resources", header: "Recursos", cell: (row) => { const people = [row.guide?.name, row.driver?.name, row.vehicle?.name].filter(Boolean); const missing = missingResources(row); return (<span className="block max-w-[260px]">{people.length > 0 && <span className="block truncate text-[12.5px] text-fg-2" title={people.join(" · ")}>{people.join(" · ")}</span>}{missing.length > 0 && <span className="block text-[12px] font-medium text-warn">{people.length === 0 ? "Sin recursos" : `Falta ${missing.join(" y ")}`}</span>}</span>); } },
    { id: "pax", header: "Pax", align: "right", wideOnly: true, cell: (row) => <span className="font-mono text-[13px]">{row.passengers}</span> },
    { id: "status", header: "Estado", cell: (row) => <StatusBadge status={row.status} /> },
    {
      id: "actions",
      header: "",
      mobile: "hidden",
      align: "right",
      cell: (row) => {
        const open = can && data.options && !["completada", "en_curso"].includes(row.status) && !["completada", "cancelada"].includes(row.order_status);
        return (
          <RowActions>
            <RowIcon tone="view" label="Ver orden" href={`/operaciones/ordenes/${row.order_code}`} />
            {open && data.options ? <AssignAction assignment={row} options={data.options} trigger={(trigger) => <RowIcon tone="edit" label={row.status === "pendiente" ? "Asignar" : "Reasignar"} icon={<Truck size={15} />} onClick={trigger} />} /> : can ? <RowIcon tone="edit" label="Asignar" icon={<Truck size={15} />} disabledHint="El servicio ya se ejecutó" /> : null}
            {open && <AssignmentQuickActions assignment={row} />}
          </RowActions>
        );
      },
    },
  ];

  const upcomingAssignments = data.assignments.filter((row) => row.date >= data.today);
  const alerts = [...data.drivers.filter((row) => row.document !== "vigente").map((row) => ({ id: row.id, text: `Licencia de ${row.name}`, state: row.document, date: row.expires_on })), ...data.vehicles.filter((row) => row.document !== "vigente").map((row) => ({ id: row.id, text: `SOAT de ${row.plate}`, state: row.document, date: row.soat_expires_on }))];

  return (
    <>
      {alerts.length > 0 && (
        <section className="mb-5 flex flex-wrap gap-2">
          {alerts.map((alert, index) => (
            <span key={alert.id} style={{ ...toneStyle(DOCUMENT_STATE[alert.state].tone), animationDelay: `${index * 60}ms` }} className="inline-flex animate-[rise-in_420ms_cubic-bezier(0.22,1,0.36,1)_backwards] items-center gap-2 rounded-full border border-[color-mix(in_srgb,var(--tint)_35%,transparent)] bg-[color-mix(in_srgb,var(--tint)_10%,var(--surface))] px-3 py-1.5 text-[12.5px] transition hover:-translate-y-0.5">
              <Clock3 size={14} className="text-[var(--tint)]" />
              <b className="font-semibold">{alert.text}</b>
              <span className="text-fg-2">{DOCUMENT_STATE[alert.state].label.toLowerCase()} · {formatDate(alert.date)}</span>
            </span>
          ))}
        </section>
      )}
      {availability && <AvailabilityMatrix data={availability} />}
      <Card padded={false}>
        <Tabs
          tabs={[
            {
              id: "assignments",
              label: "Asignaciones",
              count: upcomingAssignments.length,
              content: (
                <DataTable
                  screen="operaciones-asignaciones"
                  rows={upcomingAssignments}
                  columns={assignmentColumns}
                  getKey={(row) => row.id}
                  entityLabel="asignaciones"
                  searchText={(row) => `${row.label} ${row.order_code} ${row.order_title} ${row.guide?.name ?? ""} ${row.driver?.name ?? ""} ${row.vehicle?.name ?? ""}`}
                  searchPlaceholder="Buscar servicio, orden o recurso"
                  metrics={[
                    { id: "pending", label: "Recursos incompletos", tone: "warn", icon: <UserRoundX size={19} />, matches: (row) => missingResources(row).length > 0 && !["completada", "cancelada"].includes(row.status) },
                    { id: "assigned", label: "Por confirmar", tone: "info", icon: <Clock3 size={19} />, matches: (row) => row.status === "asignada" },
                    { id: "confirmed", label: "Confirmadas", tone: "ok", icon: <CircleCheck size={19} />, matches: (row) => row.status === "confirmada" },
                    { id: "today", label: "Hoy", tone: "t4", icon: <CalendarCheck size={19} />, matches: (row) => row.date === data.today },
                  ]}
                  filters={[{ id: "status", label: "Estado", options: unique(upcomingAssignments.map((row) => row.status)).map((value) => ({ value, label: statusLabel(value) })), value: (row) => row.status }, { id: "order", label: "Orden", options: unique(upcomingAssignments.map((row) => row.order_code)).map((value) => ({ value, label: value })), value: (row) => row.order_code }]}
                  sorts={[{ id: "date", label: "Fecha", type: "date", value: (row) => `${row.date} ${row.time ?? ""}` }] satisfies SortOption<Assignment>[]}
                />
              ),
            },
            {
              id: "guides",
              label: "Guías",
              count: data.guides.length,
              content: (
                <>
                  {can && <div className={cn("mb-4 flex justify-end")}><GuideForm languages={data.languages} users={data.users?.guide} /></div>}
                  <DataTable screen="operaciones-guias" rows={data.guides} columns={guideColumns} getKey={(row) => row.id} entityLabel="guías" searchText={(row) => `${row.name} ${row.code} ${row.license} ${row.languages.join(" ")}`} searchPlaceholder="Buscar guía o idioma" metrics={personMetrics<Guide>()} filters={[{ id: "language", label: "Idioma", options: data.languages, value: (row) => row.languages }, { id: "status", label: "Estado", options: PERSON_STATUS.map((value) => ({ value, label: statusLabel(value) })), value: (row) => row.status }] satisfies FilterConfig<Guide>[]} sorts={[{ id: "rating", label: "Calificación", type: "number", value: (row) => row.rating }, { id: "upcoming", label: "Servicios próximos", type: "number", value: (row) => row.upcoming }]} />
                </>
              ),
            },
            {
              id: "drivers",
              label: "Conductores",
              count: data.drivers.length,
              content: (
                <>
                  {can && <div className="mb-4 flex justify-end"><DriverForm users={data.users?.driver} /></div>}
                  <DataTable screen="operaciones-conductores" rows={data.drivers} columns={driverColumns} getKey={(row) => row.id} entityLabel="conductores" searchText={(row) => `${row.name} ${row.code} ${row.license}`} searchPlaceholder="Buscar conductor o licencia" metrics={personMetrics<Driver>([{ id: "license", label: "Licencia por vencer", tone: "bad", icon: <IdCard size={19} />, matches: (row) => row.document !== "vigente" }])} filters={[{ id: "status", label: "Estado", options: PERSON_STATUS.map((value) => ({ value, label: statusLabel(value) })), value: (row) => row.status }]} sorts={[{ id: "expires", label: "Vencimiento de licencia", type: "date", value: (row) => row.expires_on }]} />
                </>
              ),
            },
            {
              id: "vehicles",
              label: "Vehículos",
              count: data.vehicles.length,
              content: (
                <>
                  {can && <div className="mb-4 flex justify-end"><VehicleForm carriers={data.carriers} /></div>}
                  <DataTable screen="operaciones-vehiculos" rows={data.vehicles} columns={vehicleColumns} getKey={(row) => row.id} entityLabel="vehículos" searchText={(row) => `${row.plate} ${row.type} ${row.provider ?? ""}`} searchPlaceholder="Buscar placa o tipo" metrics={personMetrics<Vehicle>([{ id: "soat", label: "SOAT por vencer", tone: "bad", icon: <ShieldAlert size={19} />, matches: (row) => row.document !== "vigente" }])} filters={[{ id: "status", label: "Estado", options: VEHICLE_STATUS.map((value) => ({ value, label: statusLabel(value) })), value: (row) => row.status }]} sorts={[{ id: "capacity", label: "Plazas", type: "number", value: (row) => row.capacity }, { id: "soat", label: "Vencimiento de SOAT", type: "date", value: (row) => row.soat_expires_on }]} />
                </>
              ),
            },
          ]}
        />
      </Card>
    </>
  );
}
