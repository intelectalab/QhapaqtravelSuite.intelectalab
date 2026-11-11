"use client";

import { CircleCheckBig, Hourglass, MessageSquarePlus, Plus, Siren } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { commentIncident, reportIncident } from "@/app/(proveedor)/proveedor/actions";
import { DataTable } from "@/components/table/DataTable";
import { RowActions, RowIcon } from "@/components/table/RowActions";
import type { Column, FilterConfig, MetricFilter, SortOption } from "@/components/table/types";
import { ChoiceGroup } from "@/components/ui/ChoiceGroup";
import { PanelAction } from "@/components/ui/PanelAction";
import { SelectField } from "@/components/ui/SelectField";
import { TextArea } from "@/components/ui/TextArea";
import { TextField } from "@/components/ui/TextField";
import { STEP_INITIAL } from "@/features/catalog-shared/CatalogPanels";
import { PortalTitle } from "@/features/portal/PortalUi";
import { formatDateTime } from "@/lib/format";
import type { StepResult } from "@/lib/server/resource";
import { supplierStatus, type SupplierIncident, type SupplierIncidents } from "@/lib/supplier-portal";
import { SupplierBadge } from "./SupplierUi";

const OPEN = ["abierta", "en_proceso"];

export function ReportIncidentPanel({ data }: { data: SupplierIncidents }) {
  const router = useRouter();
  const [severity, setSeverity] = useState("media");
  return (
    <PanelAction<StepResult>
      label="Reportar incidencia"
      icon={<Plus size={16} />}
      variant="primary"
      formId="reportar-incidencia"
      title="Reportar incidencia"
      description="Operaciones de la agencia la recibe al instante y le responde por este canal."
      submitLabel="Reportar"
      action={reportIncident}
      initial={STEP_INITIAL}
      onDone={() => router.refresh()}
    >
      {() =>
        data.services.length === 0 ? (
          <p className="text-[13px] text-fg-3">No tiene servicios vigentes de los últimos 7 días a los cuales asociar una incidencia.</p>
        ) : (
          <>
            <SelectField label="Servicio relacionado" name="service" placeholder="Elija el servicio" searchable options={data.services} />
            <SelectField label="Tipo" name="type" defaultValue={data.types[0]} options={data.types.map((value) => ({ value, label: value }))} />
            <ChoiceGroup label="Impacto" name="severity" defaultValue="media" onChange={setSeverity} options={data.severities.map((value) => ({ value, label: supplierStatus(value, "severity").label }))} hint={`Operaciones responde en un máximo de ${data.sla_hours[severity] ?? 24} horas.`} />
            <TextField label="Asunto" name="title" required minLength={5} maxLength={150} placeholder="Sin habitaciones dobles disponibles" />
            <TextArea label="Descripción y propuesta" name="description" rows={4} required minLength={10} maxLength={2000} placeholder="Qué ocurrió y qué propone su establecimiento." />
          </>
        )
      }
    </PanelAction>
  );
}

export function CommentIncidentPanel({ code }: { code: string }) {
  const router = useRouter();
  return (
    <PanelAction<StepResult>
      label="Agregar comentario"
      icon={<MessageSquarePlus size={16} />}
      formId={`comentar-${code}`}
      title="Agregar comentario"
      description="El comentario llega a Operaciones y al responsable de la incidencia."
      submitLabel="Enviar comentario"
      action={commentIncident.bind(null, code)}
      initial={STEP_INITIAL}
      onDone={() => router.refresh()}
    >
      {() => <TextArea label="Comentario" name="message" rows={4} required minLength={2} maxLength={1000} placeholder="Confirmamos dos habitaciones triples desde mañana." />}
    </PanelAction>
  );
}

export function SupplierIncidentsView({ data }: { data: SupplierIncidents }) {
  const router = useRouter();
  const detail = (code: string) => `/proveedor/incidencias/${encodeURIComponent(code)}`;
  const columns: Column<SupplierIncident>[] = [
    {
      id: "subject",
      header: "Incidencia",
      mobile: "title",
      cell: (row) => (
        <Link href={detail(row.code)} className="block min-w-0 leading-tight">
          <b className="block max-w-[340px] truncate font-semibold hover:underline">{row.title}</b>
          <span className="text-[12px] text-fg-3">
            {row.code}
            {row.reservation ? ` · ${row.reservation}` : ""} · {row.type}
          </span>
        </Link>
      ),
    },
    { id: "severity", header: "Impacto", cell: (row) => <SupplierBadge status={row.severity} scope="severity" /> },
    { id: "status", header: "Estado", cell: (row) => <SupplierBadge status={row.status} scope="incident" /> },
    {
      id: "last",
      header: "Última actualización",
      mobile: "detail",
      cell: (row) => (
        <span className="block max-w-[320px] leading-tight">
          <span className="block truncate text-[13px]">{row.last?.message ?? "—"}</span>
          <span className="text-[12px] text-fg-3">{formatDateTime(row.last?.at ?? row.updated_at, false)}</span>
        </span>
      ),
    },
    {
      id: "actions",
      header: "",
      align: "right",
      cell: (row) => (
        <RowActions>
          <RowIcon tone="view" label="Ver incidencia" onClick={() => router.push(detail(row.code))} />
        </RowActions>
      ),
    },
  ];
  const metrics: MetricFilter<SupplierIncident>[] = [
    { id: "open", label: "Abiertas", icon: <Siren size={16} />, tone: "bad", matches: (row) => row.status === "abierta" },
    { id: "process", label: "En proceso", icon: <Hourglass size={16} />, tone: "warn", matches: (row) => row.status === "en_proceso" },
    { id: "done", label: "Resueltas", icon: <CircleCheckBig size={16} />, tone: "ok", matches: (row) => !OPEN.includes(row.status) },
  ];
  const filters: FilterConfig<SupplierIncident>[] = [
    { id: "status", label: "Estado", options: [...new Set(data.items.map((row) => row.status))].map((value) => ({ value, label: supplierStatus(value, "incident").label })), value: (row) => row.status },
    { id: "severity", label: "Impacto", options: data.severities.map((value) => ({ value, label: supplierStatus(value, "severity").label })), value: (row) => row.severity },
  ];
  const sorts: SortOption<SupplierIncident>[] = [
    { id: "created", label: "Fecha de reporte", type: "date", value: (row) => row.created_at },
    { id: "updated", label: "Última actualización", type: "date", value: (row) => row.last?.at ?? row.updated_at },
  ];

  return (
    <>
      <PortalTitle title="Incidencias" subtitle="Incidencias vinculadas a sus servicios. Operaciones de la agencia responde por este canal; las críticas también se escalan por teléfono." actions={<ReportIncidentPanel data={data} />} />
      <DataTable
        screen="proveedor-incidencias"
        rows={data.items}
        columns={columns}
        getKey={(row) => row.code}
        entityLabel="incidencias"
        metrics={metrics}
        filters={filters}
        sorts={sorts}
        searchText={(row) => `${row.code} ${row.title} ${row.reservation ?? ""}`}
        searchPlaceholder="Buscar incidencia o reserva"
        emptyTitle="No hay incidencias vinculadas a su empresa"
      />
    </>
  );
}
