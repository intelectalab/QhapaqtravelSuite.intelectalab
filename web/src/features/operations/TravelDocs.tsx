"use client";

import { BadgeCheck, CircleAlert, Clock3, Eye, FileSearch, FileWarning, Plane, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { DataTable } from "@/components/table/DataTable";
import { RowActions, RowIcon } from "@/components/table/RowActions";
import type { Column, FilterConfig, MetricFilter, SortOption } from "@/components/table/types";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { TextArea } from "@/components/ui/TextArea";
import { TextField } from "@/components/ui/TextField";
import { formatDate } from "@/lib/format";
import type { TravelDocList, TravelDocRow, TravelDocument } from "@/lib/operations";
import { statusLabel } from "@/lib/tone";
import { DateRange, Meter } from "./OpsBits";
import { ConfirmNote, OpsStep } from "./OpsStep";
import { UploadDocAction } from "./TravelDocActions";

const href = (code: string) => `/operaciones/documentos-viaje/${code}`;

export function DocumentActions({ document, passenger, target, fileHref }: { document: TravelDocument; passenger: string; target: string; fileHref: string }) {
  return (
    <RowActions>
      {document.has_file ? <RowIcon tone="view" label="Ver archivo" icon={<Eye size={15} />} href={fileHref} /> : <RowIcon tone="view" label="Ver archivo" icon={<Eye size={15} />} disabledHint="Todavía no hay archivo" />}
      <UploadDocAction document={document} passenger={passenger} target={target} />
      {document.status === "completo" || !document.has_file ? (
        <RowIcon tone="edit" label="Validar" icon={<BadgeCheck size={15} />} disabledHint={document.status === "completo" ? "Ya está validado" : document.type === "minor_auth" ? "Carga primero la partida de nacimiento o el permiso notarial" : "Carga primero el archivo del documento"} />
      ) : (
        <OpsStep step="doc_validate" target={target} formKey={`${document.id}-ok`} label="Validar" title={`Validar ${document.label.toLowerCase()}`} description={passenger} submitLabel="Validar documento" trigger={(open) => <RowIcon tone="edit" label="Validar" icon={<BadgeCheck size={15} />} onClick={open} />}>
          <ConfirmNote>Archivo recibido: <b>{document.file}</b></ConfirmNote>
          {document.min_expiry && <ConfirmNote>Para validarlo debe vencer después del <b>{formatDate(document.min_expiry)}</b>.</ConfirmNote>}
          <div className="grid grid-cols-2 gap-3">
            <TextField label="Número" name="doc_number" maxLength={40} defaultValue={document.number ?? ""} />
            <TextField label="Vence" name="expiry_date" type="date" required={document.type === "id_doc"} defaultValue={document.expiry ?? ""} />
          </div>
        </OpsStep>
      )}
      <OpsStep step="doc_observe" target={target} formKey={`${document.id}-obs`} label="Observar" title={`Observar ${document.label.toLowerCase()}`} description={passenger} submitLabel="Registrar observación" trigger={(open) => <RowIcon tone="delete" label="Observar" icon={<FileWarning size={15} />} onClick={open} />}>
        <ConfirmNote>El documento queda pendiente de corrección y el cliente recibe un correo con el motivo.</ConfirmNote>
        <TextArea label="Qué falta o qué corregir" name="reason" rows={3} required minLength={5} maxLength={500} defaultValue={document.observation ?? ""} placeholder="La foto del pasaporte está cortada; enviar la página completa." />
      </OpsStep>
    </RowActions>
  );
}

export function TravelDocsTable({ data }: { data: TravelDocList }) {
  const columns: Column<TravelDocRow>[] = [
    {
      id: "reservation",
      header: "Reserva",
      mobile: "title",
      cell: (row) => (
        <span className="block min-w-0">
          <Link href={href(row.code)} className="block truncate font-semibold hover:underline">
            {row.title}
          </Link>
          <small className="text-xs text-fg-3">
            {row.code} · {row.client}
          </small>
        </span>
      ),
    },
    { id: "trip", header: "Viaje", cell: (row) => (<span><DateRange from={row.travel_from} to={row.travel_to} /><span className="block text-xs text-fg-3">{row.days_to_travel > 0 ? `Sale en ${row.days_to_travel} días` : row.days_to_travel === 0 ? "Sale hoy" : "En curso o terminado"}</span></span>) },
    { id: "progress", header: "Documentos", cell: (row) => <Meter value={row.documents.complete} total={row.documents.total} tone={row.progress === 100 ? "ok" : row.documents.observed > 0 ? "bad" : "warn"} label={`${row.documents.received} por revisar · ${row.documents.pending} pendientes · ${row.documents.observed} observados`} /> },
    {
      id: "alerts",
      header: "Alertas",
      cell: (row) => {
        const alerts = [row.documents.received > 0 && `${row.documents.received} por revisar`, row.documents.observed > 0 && `${row.documents.observed} observados`, row.expired > 0 && `${row.expired} vencen en el viaje`, row.attention > 0 && `${row.attention} con atención especial`].filter(Boolean);
        return alerts.length ? <span className="block max-w-[220px] text-[12.5px] text-fg-2">{alerts.join(" · ")}</span> : <span className="text-[12.5px] text-ok">Sin alertas</span>;
      },
    },
    { id: "mapi", header: "Entradas MAPI", wideOnly: true, cell: (row) => (row.mapi ? <Badge tone={row.mapi.used ? "mute" : row.mapi.blocked ? "bad" : "ok"}>{row.mapi.used ? "Utilizadas" : row.mapi.blocked ? "Bloqueadas" : "Habilitadas"}</Badge> : <span className="text-[12.5px] text-fg-3">No aplica</span>) },
    { id: "status", header: "Reserva", wideOnly: true, cell: (row) => <StatusBadge status={row.status} /> },
    { id: "actions", header: "", mobile: "hidden", align: "right", cell: (row) => (<RowActions><RowIcon tone="view" label="Ver checklist" href={href(row.code)} />{data.can.manage && (row.progress < 100 ? <RowIcon tone="edit" label="Revisar documentos" icon={<FileSearch size={15} />} href={href(row.code)} /> : <RowIcon tone="edit" label="Revisar documentos" icon={<FileSearch size={15} />} disabledHint="Checklist completo" />)}</RowActions>) },
  ];

  const metrics: MetricFilter<TravelDocRow>[] = [
    { id: "ready", label: "Listos para viajar", tone: "ok", icon: <ShieldCheck size={19} />, matches: (row) => row.documents.total > 0 && row.progress === 100 },
    { id: "review", label: "Con archivos por revisar", tone: "info", icon: <Clock3 size={19} />, matches: (row) => row.documents.received > 0 },
    { id: "observed", label: "Observados o vencidos", tone: "bad", icon: <CircleAlert size={19} />, matches: (row) => row.documents.observed > 0 || row.expired > 0 },
    { id: "soon", label: "Salen en 15 días", tone: "warn", icon: <Plane size={19} />, matches: (row) => row.days_to_travel >= 0 && row.days_to_travel <= 15 && row.progress < 100 },
  ];

  const filters: FilterConfig<TravelDocRow>[] = [{ id: "status", label: "Estado de la reserva", options: [...new Set(data.items.map((row) => row.status))].map((value) => ({ value, label: statusLabel(value) })), value: (row) => row.status }];

  const sorts: SortOption<TravelDocRow>[] = [
    { id: "travel", label: "Fecha de viaje", type: "date", value: (row) => row.travel_from },
    { id: "progress", label: "Avance", type: "number", value: (row) => row.progress },
  ];

  return <DataTable screen="operaciones-documentos" rows={data.items} columns={columns} getKey={(row) => row.code} entityLabel="reservas" searchText={(row) => `${row.code} ${row.title} ${row.client} ${row.owner}`} searchPlaceholder="Buscar reserva o cliente" metrics={metrics} filters={filters} sorts={sorts} />;
}
