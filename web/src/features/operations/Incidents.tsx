"use client";

import { Clock3, Hand, Lock, MessageSquarePlus, Pencil, Plus, RotateCcw, Siren, TimerOff, Wrench } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { DataTable } from "@/components/table/DataTable";
import { RowActions, RowIcon } from "@/components/table/RowActions";
import type { Column, FilterConfig, MetricFilter, SortOption } from "@/components/table/types";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { ChoiceGroup } from "@/components/ui/ChoiceGroup";
import { SelectField } from "@/components/ui/SelectField";
import { TextArea } from "@/components/ui/TextArea";
import { TextField } from "@/components/ui/TextField";
import { formatDateTime } from "@/lib/format";
import { OPEN_INCIDENT, SEVERITY_HOURS, SEVERITY_LABEL, type IncidentDetail, type IncidentList, type IncidentRow, type Person } from "@/lib/operations";
import { statusLabel, statusTone } from "@/lib/tone";
import { PersonChip, SlaBar } from "./OpsBits";
import { ConfirmNote, OpsStep } from "./OpsStep";

const href = (code: string) => `/operaciones/incidencias/${code}`;

const unique = (values: string[]) => [...new Set(values)].sort((a, b) => a.localeCompare(b, "es"));

const severityOptions = Object.entries(SEVERITY_LABEL).map(([value, label]) => ({ value, label }));

function IncidentFields({ types, assignees, incident }: { types: string[]; assignees: Person[]; incident?: IncidentDetail }) {
  return (
    <>
      <ChoiceGroup label="Severidad" name="severity" options={severityOptions} defaultValue={incident?.severity ?? "media"} hint={`Plazo de atención: crítica ${SEVERITY_HOURS.critica} h, alta ${SEVERITY_HOURS.alta} h, media ${SEVERITY_HOURS.media} h, baja ${SEVERITY_HOURS.baja} h.`} />
      <SelectField label="Tipo" name="type" options={types.map((value) => ({ value, label: value }))} defaultValue={incident?.type ?? "Otro"} />
      <TextField label="Título" name="title" required minLength={5} maxLength={200} defaultValue={incident?.title ?? ""} placeholder="Retraso del tren de las 05:05" />
      <TextArea label="Qué pasó" name="description" rows={4} required minLength={5} maxLength={4000} defaultValue={incident?.description ?? ""} placeholder="Hechos, pasajeros afectados y acciones tomadas." />
      <SelectField label="Responsable" name="assignee_id" options={assignees.map((person) => ({ value: person.id, label: person.name }))} defaultValue={incident?.assignee_id ?? ""} placeholder="Coordinador de la orden" />
    </>
  );
}

export function IncidentCreateAction({ data }: { data: IncidentList }) {
  return (
    <OpsStep step="incident_create" label="Registrar incidencia" icon={<Plus size={16} strokeWidth={2.4} />} variant="primary" title="Registrar incidencia" description="Las críticas alertan a gerencia al instante." submitLabel="Registrar">
      <SelectField label="Orden operativa" name="order_code" options={data.orders} placeholder="Elegir orden" />
      <IncidentFields types={data.types} assignees={data.assignees} />
    </OpsStep>
  );
}

export function IncidentEditAction({ incident, trigger }: { incident: IncidentDetail; trigger?: (open: () => void) => ReactNode }) {
  return (
    <OpsStep step="incident_update" target={incident.code} formKey={`${incident.code}-edit`} label="Editar" icon={<Pencil size={16} />} title="Editar incidencia" description={`${incident.code} · reclasificar recalcula el plazo desde el registro`} submitLabel="Guardar cambios" trigger={trigger}>
      <IncidentFields types={incident.types} assignees={incident.assignees} incident={incident} />
    </OpsStep>
  );
}

export function IncidentFlowActions({ incident }: { incident: IncidentDetail }) {
  const open = OPEN_INCIDENT.includes(incident.status);
  const needsResolution = ["alta", "critica"].includes(incident.severity) && !incident.resolution;
  return (
    <>
      {open && <IncidentEditAction incident={incident} />}
      {incident.status === "abierta" && (
        <OpsStep step="incident_take" target={incident.code} version={incident.lock_version} label="Pasar a en proceso" icon={<Hand size={16} />} title="Pasar a en proceso" description={incident.title} submitLabel="Pasar a en proceso">
          <ConfirmNote>{incident.assignee ? `${incident.assignee.name} sigue como responsable.` : "Quedarás como responsable."}</ConfirmNote>
        </OpsStep>
      )}
      {open && (
        <OpsStep step="incident_resolve" target={incident.code} version={incident.lock_version} label="Registrar resolución" icon={<Wrench size={16} />} title="Registrar resolución" description={incident.title} submitLabel="Marcar resuelta">
          <TextArea label="Cómo se resolvió" name="resolution" rows={4} required minLength={5} maxLength={2000} placeholder="Se reprogramó la salida a las 03:00 y se informó a los pasajeros." />
        </OpsStep>
      )}
      {incident.status !== "cerrada" && (
        <OpsStep step="incident_close" target={incident.code} version={incident.lock_version} label="Cerrar" icon={<Lock size={16} />} variant="primary" title="Cerrar incidencia" description={incident.title} submitLabel="Cerrar incidencia">
          {needsResolution && <ConfirmNote tone="warn">Las incidencias altas y críticas necesitan su resolución registrada antes de cerrarse.</ConfirmNote>}
          {incident.severity === "critica" && incident.evidence_files.length === 0 && <ConfirmNote tone="warn">Una incidencia crítica necesita al menos una evidencia.</ConfirmNote>}
          <TextArea label={incident.resolution ? "Comentario de cierre (opcional)" : "Comentario de cierre"} name="comment" rows={3} maxLength={1000} placeholder="Sin impacto en el servicio." />
        </OpsStep>
      )}
      {incident.status === "cerrada" && (
        <OpsStep step="incident_reopen" target={incident.code} version={incident.lock_version} label="Reabrir" icon={<RotateCcw size={16} />} title="Reabrir incidencia" description={incident.title} submitLabel="Reabrir">
          <TextArea label="Motivo" name="reason" rows={3} required minLength={5} maxLength={500} placeholder="El pasajero volvió a presentar síntomas." />
        </OpsStep>
      )}
    </>
  );
}

export function IncidentCommentAction({ code }: { code: string }) {
  return (
    <OpsStep step="incident_comment" target={code} formKey={`${code}-comment`} label="Comentar" icon={<MessageSquarePlus size={15} />} size="sm" variant="ghost" title="Agregar a la bitácora" submitLabel="Guardar comentario">
      <TextArea label="Comentario" name="message" rows={4} required minLength={2} maxLength={1000} placeholder="Médico confirmó que puede continuar el itinerario." />
    </OpsStep>
  );
}

export function SeverityBadge({ severity }: { severity: string }) {
  return <Badge tone={statusTone(severity)}>{SEVERITY_LABEL[severity] ?? severity}</Badge>;
}

export function IncidentsTable({ data }: { data: IncidentList }) {
  const columns: Column<IncidentRow>[] = [
    {
      id: "incident",
      header: "Incidencia",
      mobile: "title",
      cell: (row) => (
        <span className="block min-w-0">
          <Link href={href(row.code)} className="block truncate font-semibold hover:underline">
            {row.title}
          </Link>
          <small className="block text-xs text-fg-3">
            {row.code} · {row.type}
            {row.order && <> · <Link href={`/operaciones/ordenes/${row.order.code}`} className="hover:text-accent hover:underline">{row.order.code}</Link></>}
          </small>
        </span>
      ),
    },
    { id: "severity", header: "Severidad", cell: (row) => <SeverityBadge severity={row.severity} /> },
    {
      id: "sla",
      header: "Plazo",
      cell: (row) => {
        const closed = !OPEN_INCIDENT.includes(row.status);
        return (
          <span className="flex w-[150px] flex-col gap-1">
            <span className={closed ? "text-[12px] text-fg-3" : row.overdue ? "text-[12px] font-semibold text-bad" : "text-[12px] text-fg-2"}>{closed ? "Atendida" : row.overdue ? "Vencido" : `Vence ${formatDateTime(row.sla_due_at, false)}`}</span>
            <SlaBar pct={row.sla_pct} overdue={row.overdue} closed={closed} />
          </span>
        );
      },
    },
    { id: "assignee", header: "Responsable", wideOnly: true, cell: (row) => (row.assignee ? <PersonChip name={row.assignee.name} color={row.assignee.color} /> : <span className="text-[12.5px] text-fg-3">Sin asignar</span>) },
    { id: "status", header: "Estado", cell: (row) => <StatusBadge status={row.status} /> },
    {
      id: "actions",
      header: "",
      mobile: "hidden",
      align: "right",
      cell: (row) => (
        <RowActions>
          <RowIcon tone="view" label="Ver incidencia" href={href(row.code)} />
          {data.can.manage && (OPEN_INCIDENT.includes(row.status) ? <RowIcon tone="edit" label="Gestionar" href={href(row.code)} icon={<Pencil size={15} />} /> : <RowIcon tone="edit" label="Gestionar" disabledHint="Ya está atendida" />)}
          {data.can.manage && (row.status !== "cerrada" ? <RowIcon tone="delete" label="Cerrar" href={href(row.code)} icon={<Lock size={15} />} /> : <RowIcon tone="delete" label="Cerrar" icon={<Lock size={15} />} disabledHint="Ya está cerrada" />)}
        </RowActions>
      ),
    },
  ];

  const metrics: MetricFilter<IncidentRow>[] = [
    { id: "open", label: "Abiertas", tone: "info", icon: <Clock3 size={19} />, matches: (row) => row.status === "abierta" },
    { id: "critical", label: "Críticas abiertas", tone: "bad", icon: <Siren size={19} />, matches: (row) => OPEN_INCIDENT.includes(row.status) && row.severity === "critica" },
    { id: "process", label: "En proceso", tone: "sun", icon: <Wrench size={19} />, matches: (row) => row.status === "en_proceso" },
    { id: "overdue", label: "Plazo vencido", tone: "warn", icon: <TimerOff size={19} />, matches: (row) => row.overdue },
  ];

  const filters: FilterConfig<IncidentRow>[] = [
    { id: "status", label: "Estado", options: unique(data.items.map((row) => row.status)).map((value) => ({ value, label: statusLabel(value) })), value: (row) => row.status },
    { id: "severity", label: "Severidad", options: severityOptions, value: (row) => row.severity },
    { id: "type", label: "Tipo", options: unique(data.items.map((row) => row.type)).map((value) => ({ value, label: value })), value: (row) => row.type },
  ];

  const sorts: SortOption<IncidentRow>[] = [
    { id: "due", label: "Vencimiento del plazo", type: "date", value: (row) => row.sla_due_at },
    { id: "created", label: "Registro", type: "date", value: (row) => row.created_at },
  ];

  return <DataTable screen="operaciones-incidencias" rows={data.items} columns={columns} getKey={(row) => row.code} entityLabel="incidencias" searchText={(row) => `${row.code} ${row.title} ${row.type} ${row.order?.code ?? ""} ${row.reservation?.code ?? ""}`} searchPlaceholder="Buscar incidencia, orden o reserva" metrics={metrics} filters={filters} sorts={sorts} />;
}

export function OrderIncidentCreateAction({ orderCode, types, assignees }: { orderCode: string; types: string[]; assignees: Person[] }) {
  return (
    <OpsStep step="incident_create" formKey={`${orderCode}-incident`} label="Nueva incidencia" icon={<Plus size={16} strokeWidth={2.4} />} size="sm" title="Registrar incidencia" description={`Orden ${orderCode}. Las críticas alertan a gerencia al instante.`} submitLabel="Registrar">
      <input type="hidden" name="order_code" value={orderCode} />
      <IncidentFields types={types} assignees={assignees} />
    </OpsStep>
  );
}
