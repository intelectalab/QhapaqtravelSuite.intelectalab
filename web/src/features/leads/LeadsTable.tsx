"use client";

import { CircleCheckBig, PhoneCall, Sparkles, Target } from "lucide-react";
import Link from "next/link";
import { DataTable } from "@/components/table/DataTable";
import { RowActions, RowIcon } from "@/components/table/RowActions";
import { useCan } from "@/components/shell/SessionProvider";
import type { Column, FilterConfig, MetricFilter, SortOption } from "@/components/table/types";
import { Avatar } from "@/components/ui/Avatar";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { formatDate, shortName } from "@/lib/format";
import { scoreTone, type CrmCatalogs, type LeadRow } from "@/lib/leads";
import { LeadDiscardAction } from "./LeadEditActions";

const OPEN = ["nuevo", "contactado", "calificado"];
import { statusLabel, toneStyle } from "@/lib/tone";

const leadHref = (lead: LeadRow) => `/crm/leads/${lead.code}`;

const unique = (values: string[]) => [...new Set(values)].sort((a, b) => a.localeCompare(b, "es")).map((value) => ({ value, label: value }));

export function ScoreMeter({ score }: { score: number }) {
  return (
    <span style={toneStyle(scoreTone(score))} className="flex items-center gap-2">
      <span className="h-1.5 w-12 overflow-hidden rounded-full bg-surface-2">
        <span className="block h-full rounded-full bg-[var(--tint)]" style={{ width: `${score}%` }} />
      </span>
      <span className="font-mono text-[12.5px] font-semibold text-[var(--tint)]">{score}</span>
    </span>
  );
}

const buildColumns = (catalogs: CrmCatalogs | null): Column<LeadRow>[] => [
  {
    id: "lead",
    header: "Lead",
    mobile: "title",
    cell: (lead) => (
      <div className="flex items-center gap-3">
        <Avatar name={lead.name} />
        <div className="min-w-0">
          <Link href={leadHref(lead)} className="font-semibold hover:underline">
            {lead.name}
          </Link>
          <small className="block text-xs text-fg-3">
            {lead.code}
            {lead.company ? ` · ${lead.company}` : ""}
          </small>
        </div>
      </div>
    ),
  },
  {
    id: "source",
    header: "Fuente",
    wideOnly: true,
    cell: (lead) => (
      <span className="leading-tight">
        <b className="block font-medium">{lead.source}</b>
        <span className="text-xs text-fg-3">{lead.channel}</span>
      </span>
    ),
  },
  {
    id: "interest",
    header: "Interés",
    cell: (lead) => (
      <span className="leading-tight">
        <b className="block font-medium">{lead.interest}</b>
        <span className="text-xs text-fg-3">
          {lead.destination ?? "Sin destino"}
          {lead.travel_date ? ` · ${formatDate(lead.travel_date)}` : ""}
          {lead.pax > 0 ? ` · ${lead.pax} pax` : ""}
        </span>
      </span>
    ),
  },
  { id: "score", header: "Puntaje", cell: (lead) => <ScoreMeter score={lead.score} /> },
  {
    id: "owner",
    header: "Responsable",
    cell: (lead) =>
      lead.owner ? (
        <span className="flex items-center gap-2 text-[13px]">
          <Avatar name={lead.owner.name} size="xs" solid className="max-md:hidden" />
          {shortName(lead.owner.name)}
        </span>
      ) : (
        <Badge tone="warn">Sin asignar</Badge>
      ),
  },
  { id: "status", header: "Estado", cell: (lead) => <StatusBadge status={lead.status} /> },
  { id: "received", header: "Recibido", wideOnly: true, cell: (lead) => <span className="text-[13px] text-fg-2">{formatDate(lead.created_at)}</span> },
  {
    id: "actions",
    header: "",
    mobile: "hidden",
    align: "right",
    cell: (lead) => (
      <RowActions>
        <RowIcon tone="view" label="Ver ficha" href={leadHref(lead)} />
        {catalogs &&
          (OPEN.includes(lead.status) ? (
            <>
              <RowIcon tone="edit" label="Editar" href={`${leadHref(lead)}?editar=1`} />
              <LeadDiscardAction lead={lead} catalogs={catalogs} iconOnly />
            </>
          ) : (
            <>
              <RowIcon tone="edit" label="Editar" disabledHint={lead.status === "convertido" ? "Ya se convirtió" : "Reábrelo desde su ficha para editarlo"} />
              <RowIcon tone="delete" label="Descartar" disabledHint={lead.status === "convertido" ? "Ya se convirtió" : "Ya está fuera del recorrido"} />
            </>
          ))}
      </RowActions>
    ),
  },
];

const metrics: MetricFilter<LeadRow>[] = [
  { id: "new", label: "Sin contactar", tone: "info", icon: <PhoneCall size={19} />, matches: (lead) => lead.status === "nuevo" },
  { id: "contacted", label: "Contactados", tone: "accent", icon: <Sparkles size={19} />, matches: (lead) => lead.status === "contactado" },
  { id: "qualified", label: "Calificados", tone: "violet", icon: <Target size={19} />, matches: (lead) => lead.status === "calificado" },
  { id: "converted", label: "Convertidos", tone: "ok", icon: <CircleCheckBig size={19} />, matches: (lead) => lead.status === "convertido" },
];

const sorts: SortOption<LeadRow>[] = [
  { id: "received", label: "Fecha de ingreso", type: "date", value: (lead) => lead.created_at },
  { id: "score", label: "Puntaje", type: "number", value: (lead) => lead.score },
  { id: "travel", label: "Fecha de viaje", type: "date", value: (lead) => lead.travel_date },
  { id: "name", label: "Nombre", type: "text", value: (lead) => lead.name },
];

export function LeadsTable({ leads, catalogs }: { leads: LeadRow[]; catalogs: CrmCatalogs | null }) {
  const canManage = useCan("crm.leads.manage");
  const filters: FilterConfig<LeadRow>[] = [
    { id: "status", label: "Estado", options: unique(leads.map((lead) => lead.status)).map((option) => ({ ...option, label: statusLabel(option.value) })), value: (lead) => lead.status },
    { id: "source", label: "Fuente", options: unique(leads.map((lead) => lead.source)), value: (lead) => lead.source },
    { id: "owner", label: "Responsable", options: [{ value: "__none", label: "Sin asignar" }, ...unique(leads.flatMap((lead) => (lead.owner ? [lead.owner.name] : [])))], value: (lead) => lead.owner?.name ?? "__none" },
  ];

  return (
    <DataTable
      screen="leads"
      rows={leads}
      columns={buildColumns(canManage ? catalogs : null)}
      getKey={(lead) => lead.code}
      entityLabel="leads"
      searchText={(lead) => `${lead.name} ${lead.company ?? ""} ${lead.email ?? ""} ${lead.phone ?? ""} ${lead.code} ${lead.destination ?? ""}`}
      searchPlaceholder="Buscar nombre, empresa, correo o teléfono"
      metrics={metrics}
      filters={filters}
      sorts={sorts}
    />
  );
}
