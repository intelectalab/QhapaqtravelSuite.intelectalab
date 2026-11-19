"use client";

import { CalendarClock, CircleCheck, Handshake, Inbox, Mail, MessageSquareText, Phone } from "lucide-react";
import { useState } from "react";
import { attendDemoRequest } from "@/app/plataforma/(consola)/solicitudes/actions";
import { DataTable } from "@/components/table/DataTable";
import { RowActions, RowIcon } from "@/components/table/RowActions";
import type { Column, FilterConfig, MetricFilter, SortOption } from "@/components/table/types";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { FieldList, SectionTitle } from "@/components/ui/Details";
import { SelectField } from "@/components/ui/SelectField";
import { SidePanel } from "@/components/ui/SidePanel";
import { TextArea } from "@/components/ui/TextArea";
import { DEMO_KIND, DEMO_STATUS, type DemoRequest, type DemoRequestsOverview } from "@/lib/demoRequests";
import { formatDateTime } from "@/lib/format";
import { ConsoleAction } from "./ConsoleAction";

const CYCLE: Record<string, string> = { month: "mensual", year: "anual" };

const whatsappHref = (phone: string) => `https://wa.me/${phone.replace(/\D/g, "")}`;

function StatusTag({ request }: { request: DemoRequest }) {
  const meta = DEMO_STATUS[request.status];
  return <Badge tone={meta.tone} status={request.status}>{meta.label}</Badge>;
}

function DemoRequestDetail({ request, open, onOpenChange }: { request: DemoRequest; open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <SidePanel open={open} onOpenChange={onOpenChange} title={request.company} description={`${DEMO_KIND[request.kind]} · ${request.code} · ${formatDateTime(request.created_at)}`} size="wide">
      <div className="flex flex-col gap-6">
        <section>
          <SectionTitle title="Contacto" />
          <FieldList
            fields={[
              { label: "Nombre", value: request.full_name },
              { label: "Correo", value: <a href={`mailto:${request.email}`} className="text-accent hover:underline">{request.email}</a> },
              { label: "Teléfono", value: request.phone ? <span className="flex items-center gap-3"><a href={`tel:${request.phone}`} className="text-accent hover:underline">{request.phone}</a><a href={whatsappHref(request.phone)} target="_blank" rel="noopener noreferrer" className="text-[12.5px] font-semibold text-accent hover:underline">WhatsApp</a></span> : "—" },
              { label: "Ciudad", value: request.city ?? "—" },
            ]}
          />
        </section>
        <section>
          <SectionTitle title="Agencia" />
          <FieldList
            fields={[
              { label: "Tipo", value: request.business_type },
              { label: "Equipo", value: `${request.team_size} personas` },
              { label: "Plan de interés", value: request.plan ? `${request.plan.name}${request.plan.billing_cycle ? ` · ${CYCLE[request.plan.billing_cycle]}` : ""}` : "Sin elegir" },
            ]}
          />
        </section>
        <section>
          <SectionTitle title="Mensaje" />
          <p className="whitespace-pre-line rounded-xl bg-surface-2 p-3.5 text-[13.5px] leading-relaxed text-fg-2">{request.message ?? "No dejó mensaje."}</p>
        </section>
        <section>
          <SectionTitle title="Atención" />
          <FieldList
            fields={[
              { label: "Estado", value: <StatusTag request={request} /> },
              { label: "Atendida por", value: request.handled_by ? `${request.handled_by} · ${formatDateTime(request.handled_at ?? request.created_at)}` : "Nadie todavía" },
              { label: "Nota", value: <span className="whitespace-normal">{request.notes ?? "—"}</span> },
            ]}
          />
        </section>
      </div>
    </SidePanel>
  );
}

function AttendAction({ request }: { request: DemoRequest }) {
  const [status, setStatus] = useState<string>(request.next_statuses[0] ?? "");
  if (request.next_statuses.length === 0) return <RowIcon tone="edit" label="Atender" disabledHint="Ya se convirtió en agencia" />;
  return (
    <ConsoleAction
      id={`demo-${request.code}`}
      label="Atender"
      icon={<MessageSquareText size={15} />}
      rowTone="edit"
      title={`Atender a ${request.company}`}
      description={`${request.full_name} · ${request.email}${request.phone ? ` · ${request.phone}` : ""}`}
      submitLabel="Guardar"
      action={attendDemoRequest}
      fields={{ code: request.code }}
    >
      <SelectField label="Nuevo estado" name="status" options={request.next_statuses.map((value) => ({ value, label: DEMO_STATUS[value].action }))} value={status} onChange={setStatus} />
      <TextArea label={status === "descartada" ? "Motivo" : "Nota interna"} name="notes" rows={4} maxLength={1000} required={status === "descartada"} defaultValue={request.notes ?? ""} hint={status === "descartada" ? "Obligatorio: queda en la auditoría." : "Qué se conversó o cuándo se vuelve a llamar."} />
    </ConsoleAction>
  );
}

function RequestRowActions({ request }: { request: DemoRequest }) {
  const [open, setOpen] = useState(false);
  return (
    <RowActions>
      <RowIcon tone="view" label="Ver solicitud" onClick={() => setOpen(true)} />
      <AttendAction request={request} />
      <DemoRequestDetail request={request} open={open} onOpenChange={setOpen} />
    </RowActions>
  );
}

const columns: Column<DemoRequest>[] = [
  {
    id: "company",
    header: "Agencia",
    mobile: "title",
    cell: (row) => (
      <div className="flex items-center gap-3">
        <Avatar name={row.company} />
        <div className="min-w-0">
          <b className="block truncate text-[13.5px]">{row.company}</b>
          <small className="block truncate text-xs text-fg-3">{row.full_name}{row.city ? ` · ${row.city}` : ""}</small>
        </div>
      </div>
    ),
  },
  { id: "kind", header: "Pide", cell: (row) => <span className="text-[13px]">{DEMO_KIND[row.kind]}<span className="block text-[12px] text-fg-3">{row.plan ? row.plan.name : "Sin plan elegido"}</span></span> },
  {
    id: "contact",
    header: "Contacto",
    wideOnly: true,
    cell: (row) => (
      <span className="flex flex-col gap-0.5 text-[12.5px]">
        <a href={`mailto:${row.email}`} className="inline-flex items-center gap-1.5 text-fg-2 hover:text-accent"><Mail size={13} />{row.email}</a>
        {row.phone && <a href={`tel:${row.phone}`} className="inline-flex items-center gap-1.5 text-fg-2 hover:text-accent"><Phone size={13} />{row.phone}</a>}
      </span>
    ),
  },
  { id: "team", header: "Equipo", align: "right", wideOnly: true, cell: (row) => <span className="font-mono text-[13px]">{row.team_size}</span> },
  { id: "created", header: "Llegó", cell: (row) => <span className="whitespace-nowrap text-[12.5px] text-fg-2">{formatDateTime(row.created_at)}</span> },
  { id: "status", header: "Estado", mobile: "detail", cell: (row) => <StatusTag request={row} /> },
  { id: "actions", header: "", cell: (row) => <RequestRowActions request={row} /> },
];

const filters: FilterConfig<DemoRequest>[] = [
  { id: "estado", label: "Estado", options: Object.entries(DEMO_STATUS).map(([value, meta]) => ({ value, label: meta.label })), value: (row) => row.status },
  { id: "tipo", label: "Pide", options: Object.entries(DEMO_KIND).map(([value, label]) => ({ value, label })), value: (row) => row.kind },
];

const sorts: SortOption<DemoRequest>[] = [{ id: "created", label: "Fecha de llegada", type: "date", value: (row) => row.created_at }];

export function DemoRequestsTable({ overview, initialStatus }: { overview: DemoRequestsOverview; initialStatus?: string }) {
  const [weekAgo] = useState(() => Date.now() - 7 * 24 * 60 * 60 * 1000);
  const metrics: MetricFilter<DemoRequest>[] = [
    { id: "new", label: "Por atender", tone: "info", icon: <Inbox size={19} />, info: <p>Solicitudes en estado Nueva: nadie las ha contactado. Salen también en la campana. Al presionarla ves solo esas.</p>, matches: (row) => row.status === "nueva" },
    { id: "contacted", label: "En conversación", tone: "sun", icon: <Handshake size={19} />, info: <p>Solicitudes marcadas como Contactada que aún no se convierten ni se descartan. Al presionarla ves solo esas.</p>, matches: (row) => row.status === "contactada" },
    { id: "converted", label: "Convertidas", tone: "ok", icon: <CircleCheck size={19} />, info: <p>Solicitudes que terminaron en una agencia dada de alta. Al presionarla ves solo esas.</p>, matches: (row) => row.status === "convertida" },
    { id: "week", label: "Últimos 7 días", tone: "t1", icon: <CalendarClock size={19} />, info: <p>Solicitudes que llegaron en los últimos 7 días, en cualquier estado. Al presionarla ves solo esas.</p>, matches: (row) => new Date(row.created_at).getTime() >= weekAgo },
  ];
  return (
    <DataTable
      screen="plataforma-solicitudes"
      rows={overview.items}
      columns={columns}
      getKey={(row) => row.code}
      entityLabel="solicitudes"
      searchText={(row) => `${row.code} ${row.company} ${row.full_name} ${row.email} ${row.city ?? ""}`}
      searchPlaceholder="Buscar agencia, persona o correo"
      initialFilters={initialStatus && initialStatus in DEMO_STATUS ? { estado: initialStatus } : undefined}
      metrics={metrics}
      filters={filters}
      sorts={sorts}
      emptyTitle="Aún no llegan solicitudes"
    />
  );
}
