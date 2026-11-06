"use client";

import { CalendarClock, FilePen, Mail, MessageCircle, Send, Users } from "lucide-react";
import { DataTable } from "@/components/table/DataTable";
import { RowActions } from "@/components/table/RowActions";
import type { Column, FilterConfig, MetricFilter, SortOption } from "@/components/table/types";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Tabs } from "@/components/ui/Tabs";
import { formatDate, formatDateTime, formatMoney, formatPercent } from "@/lib/format";
import { rate, type Campaign, type MarketingOverview, type MarketingTemplate } from "@/lib/marketing";
import { toneStyle } from "@/lib/tone";
import { CampaignCancelAction, CampaignDetailAction, CampaignFormAction } from "./CampaignForms";

function CampaignsTable({ overview }: { overview: MarketingOverview }) {
  const rows = overview.campaigns;
  const columns: Column<Campaign>[] = [
    {
      id: "campaign",
      header: "Campaña",
      mobile: "title",
      cell: (row) => (
        <div className="min-w-0">
          <span className="flex items-center gap-2">
            <span style={toneStyle(row.channel === "email" ? "info" : "ok")} className="grid h-6 w-6 place-items-center rounded-md bg-[color-mix(in_srgb,var(--tint)_14%,transparent)] text-[var(--tint)]">
              {row.channel === "email" ? <Mail size={13} /> : <MessageCircle size={13} />}
            </span>
            <b className="max-w-[340px] truncate text-[13.5px]">{row.name}</b>
          </span>
          <span className="mt-0.5 block text-[12px] text-fg-3">
            {row.code} · {row.segment?.name ?? "Sin segmento"}
          </span>
        </div>
      ),
    },
    { id: "status", header: "Estado", cell: (row) => <StatusBadge status={row.status} label={row.status_label} /> },
    {
      id: "when",
      header: "Envío",
      cell: (row) => <span className="text-[13px]">{row.sent_at ? formatDateTime(row.sent_at, false) : row.scheduled_at ? formatDateTime(row.scheduled_at, false) : "Sin programar"}</span>,
    },
    { id: "sent", header: "Enviados", align: "right", cell: (row) => <span className="font-mono text-[13px]">{row.metrics.recipients || row.audience?.eligible || 0}</span> },
    {
      id: "open",
      header: "Apertura",
      align: "right",
      cell: (row) => (row.status === "enviada" ? <span className="font-mono text-[13px]" title={`${row.metrics.opened} aperturas · ${row.metrics.clicked} clics`}>{formatPercent(rate(row.metrics.opened, row.metrics.delivered), 0)}</span> : <span className="text-fg-3">—</span>),
    },
    {
      id: "revenue",
      header: "Ingresos",
      align: "right",
      cell: (row) => (row.status === "enviada" ? <span className="font-mono text-[13px] font-semibold" title={`${row.attribution.reservations} reservas atribuidas`}>{formatMoney(row.attribution.revenue)}</span> : <span className="text-fg-3">—</span>),
    },
    {
      id: "actions",
      header: "",
      align: "right",
      mobile: "hidden",
      cell: (row) => (
        <RowActions>
          <CampaignDetailAction campaign={row} canManage={overview.can.manage} />
          <CampaignFormAction overview={overview} campaign={row} />
          <CampaignCancelAction campaign={row} />
        </RowActions>
      ),
    },
  ];
  const metrics: MetricFilter<Campaign>[] = [
    { id: "sent", label: "Enviadas", tone: "ok", icon: <Send size={19} />, matches: (row) => row.status === "enviada" },
    { id: "scheduled", label: "Programadas", tone: "info", icon: <CalendarClock size={19} />, matches: (row) => row.status === "programada" },
    { id: "draft", label: "Borradores", tone: "mute", icon: <FilePen size={19} />, matches: (row) => row.status === "borrador" },
  ];
  const filters: FilterConfig<Campaign>[] = [{ id: "channel", label: "Canal", options: [{ value: "email", label: "Email" }, { value: "whatsapp", label: "WhatsApp" }], value: (row) => row.channel }];
  const sorts: SortOption<Campaign>[] = [
    { id: "created", label: "Fecha de creación", type: "date", value: (row) => row.created_at },
    { id: "revenue", label: "Ingresos", type: "number", value: (row) => row.attribution.revenue },
  ];
  return <DataTable screen="marketing-campanas" rows={rows} columns={columns} getKey={(row) => row.code} entityLabel="campañas" searchText={(row) => `${row.code} ${row.name} ${row.segment?.name ?? ""}`} searchPlaceholder="Buscar campaña o segmento" metrics={metrics} filters={filters} sorts={sorts} />;
}

function SegmentsGrid({ overview }: { overview: MarketingOverview }) {
  if (overview.segments.length === 0) return <EmptyState icon={<Users size={20} />} title="Aún no hay segmentos" />;
  return (
    <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {overview.segments.map((segment, index) => (
        <li key={segment.code} style={{ animationDelay: `${index * 60}ms` }} className="lift animate-[rise-in_420ms_cubic-bezier(0.22,1,0.36,1)_backwards] rounded-tile border border-line bg-surface p-4">
          <div className="flex items-start justify-between gap-2">
            <b className="text-[14px]">{segment.name}</b>
            <span className="font-mono text-[11.5px] text-fg-3">{segment.code}</span>
          </div>
          <p className="mt-1 text-[12.5px] text-fg-2">{segment.rules_text}</p>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg bg-surface-2 py-2" title="Contactos que cumplen las reglas">
              <b className="block text-[16px]">{segment.matched}</b>
              <span className="text-[11px] text-fg-3">Coinciden</span>
            </div>
            <div style={toneStyle("info")} className="rounded-lg bg-[color-mix(in_srgb,var(--tint)_10%,var(--surface))] py-2" title="Con correo y consentimiento de email">
              <b className="block text-[16px] text-[var(--tint)]">{segment.email}</b>
              <span className="text-[11px] text-fg-3">Email</span>
            </div>
            <div style={toneStyle("ok")} className="rounded-lg bg-[color-mix(in_srgb,var(--tint)_10%,var(--surface))] py-2" title="Con móvil y consentimiento de WhatsApp">
              <b className="block text-[16px] text-[var(--tint)]">{segment.whatsapp}</b>
              <span className="text-[11px] text-fg-3">WhatsApp</span>
            </div>
          </div>
          <p className="mt-2.5 text-[11.5px] text-fg-3">{segment.campaigns === 0 ? "Sin campañas" : `${segment.campaigns} ${segment.campaigns === 1 ? "campaña" : "campañas"}`} · coincidencia {segment.match === "all" ? "de todas las reglas" : "de alguna regla"}</p>
        </li>
      ))}
    </ul>
  );
}

function CodesList({ overview }: { overview: MarketingOverview }) {
  if (overview.codes.length === 0) return <EmptyState icon={<Send size={20} />} title="Sin códigos promocionales" description="Agrega un código al crear una campaña para medir su uso." />;
  return (
    <ul className="grid gap-3 md:grid-cols-2">
      {overview.codes.map((code) => (
        <li key={code.code} className="lift flex items-start gap-3 rounded-tile border border-dashed border-[color-mix(in_srgb,var(--t2)_60%,transparent)] bg-[color-mix(in_srgb,var(--t2)_8%,var(--surface))] p-4">
          <span className="rounded-lg bg-t2 px-2.5 py-1 font-mono text-[13px] font-bold text-t2-fg">{code.code}</span>
          <div className="min-w-0 text-[12.5px]">
            <p className="font-semibold">{code.product ?? "Código de campaña"}</p>
            <p className="text-fg-3">{code.kind ? `${code.kind}${code.value ? ` · ${code.value}` : ""}` : "Se valida al reservar"}{code.valid_to ? ` · hasta ${formatDate(code.valid_to)}` : ""}</p>
            <p className="mt-1 text-fg-2">{code.campaigns.map((campaign) => campaign.name).join(" · ")}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

function TemplatesTable({ templates }: { templates: MarketingTemplate[] }) {
  const columns: Column<MarketingTemplate>[] = [
    { id: "name", header: "Plantilla", mobile: "title", cell: (row) => <span><b className="text-[13.5px]">{row.name}</b><span className="block max-w-[420px] truncate text-[12px] text-fg-3">{row.subject ?? row.body}</span></span> },
    { id: "channel", header: "Canal", cell: (row) => <Badge tone={row.channel === "email" ? "info" : "ok"} dot={false}>{row.channel === "email" ? "Email" : "WhatsApp"}</Badge> },
    { id: "category", header: "Categoría", cell: (row) => <span className="text-[12.5px] text-fg-2">{row.category === "MARKETING" ? "Comercial" : row.category === "UTILITY" ? "Utilidad" : "Servicio"}</span> },
    { id: "status", header: "Estado", cell: (row) => <StatusBadge status={row.status} /> },
  ];
  return <DataTable screen="marketing-plantillas" rows={templates} columns={columns} getKey={(row) => row.code} entityLabel="plantillas" searchText={(row) => `${row.name} ${row.body}`} searchPlaceholder="Buscar plantilla" />;
}

export function MarketingWorkspace({ overview }: { overview: MarketingOverview }) {
  return (
    <Card padded={false} className="overflow-hidden">
      <Tabs
        tabs={[
          { id: "campaigns", label: "Campañas", count: overview.campaigns.length, content: <CampaignsTable overview={overview} /> },
          { id: "segments", label: "Segmentos", count: overview.segments.length, content: <SegmentsGrid overview={overview} /> },
          { id: "codes", label: "Cupones", count: overview.codes.length, content: <CodesList overview={overview} /> },
          { id: "templates", label: "Plantillas", count: overview.templates.length, content: <TemplatesTable templates={overview.templates} /> },
        ]}
      />
    </Card>
  );
}
