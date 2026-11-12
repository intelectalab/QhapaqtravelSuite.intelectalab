"use client";

import { CalendarClock, Clock3, FilePen, Filter, Mail, MessageCircle, Send, Users } from "lucide-react";
import { DataTable } from "@/components/table/DataTable";
import { RowActions } from "@/components/table/RowActions";
import type { Column, FilterConfig, MetricFilter, SortOption } from "@/components/table/types";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { InfoTip } from "@/components/ui/InfoTip";
import { formatDate, formatDateTime, formatMoney, formatPercent } from "@/lib/format";
import { rate, TEMPLATE_STATUS, type Campaign, type MarketingOverview, type MarketingTemplate } from "@/lib/marketing";
import { toneStyle } from "@/lib/tone";
import { CampaignCancelAction, CampaignDetailAction, CampaignDuplicateAction, CampaignFormAction } from "./CampaignForms";
import { SegmentDeleteAction, SegmentDuplicateAction, SegmentFormAction } from "./SegmentForms";
import { TemplateFormAction, TemplateReviewAction } from "./TemplateForms";

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
      cell: (row) =>
        overview.can.manage ? (
        <RowActions>
          <CampaignDetailAction campaign={row} canManage={overview.can.manage} />
          <CampaignFormAction overview={overview} campaign={row} />
          <CampaignDuplicateAction campaign={row} />
          <CampaignCancelAction campaign={row} />
        </RowActions>
        ) : (
          <CampaignDetailAction campaign={row} canManage={false} />
        ),
    },
  ];
  const metrics: MetricFilter<Campaign>[] = [
    { id: "sent", label: "Enviadas", tone: "ok", icon: <Send size={19} />, matches: (row) => row.status === "enviada" },
    { id: "scheduled", label: "Programadas", tone: "info", icon: <CalendarClock size={19} />, matches: (row) => row.status === "programada" },
    { id: "draft", label: "Borradores", tone: "mute", icon: <FilePen size={19} />, matches: (row) => row.status === "borrador" },
    { id: "sending", label: "Enviando", tone: "sun", icon: <Clock3 size={19} />, matches: (row) => row.status === "enviando" },
  ];
  const filters: FilterConfig<Campaign>[] = [{ id: "channel", label: "Canal", options: [{ value: "email", label: "Email" }, { value: "whatsapp", label: "WhatsApp" }], value: (row) => row.channel }];
  const sorts: SortOption<Campaign>[] = [
    { id: "created", label: "Fecha de creación", type: "date", value: (row) => row.created_at },
    { id: "revenue", label: "Ingresos", type: "number", value: (row) => row.attribution.revenue },
  ];
  return <DataTable screen="marketing-campanas" rows={rows} columns={columns} getKey={(row) => row.code} entityLabel="campañas" searchText={(row) => `${row.code} ${row.name} ${row.segment?.name ?? ""}`} searchPlaceholder="Buscar campaña o segmento" metrics={metrics} filters={filters} sorts={sorts} />;
}

function RuleChips({ parts, match, fallback }: { parts: string[]; match: "all" | "any"; fallback: string }) {
  if (parts.length === 0) return <p className="mt-1 text-[12.5px] text-fg-2">{fallback}</p>;
  const shown = parts.slice(0, 3);
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      {shown.map((part, index) => (
        <span key={part} className="flex items-center gap-1.5">
          {index > 0 && <span className="text-[11px] text-fg-3">{match === "any" ? "o" : "y"}</span>}
          <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2.5 py-0.5 text-[12px] text-fg-2">
            <Filter size={11} className="text-[var(--tint,var(--t1))]" />
            {part}
          </span>
        </span>
      ))}
      {parts.length > shown.length && (
        <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[12px] font-semibold text-fg-3" title={parts.slice(3).join(" · ")}>
          +{parts.length - shown.length}
        </span>
      )}
    </div>
  );
}

function SegmentsGrid({ overview }: { overview: MarketingOverview }) {
  const manage = overview.can.manage;
  return (
    <>
      {manage && (
        <div className="mb-4 flex items-center justify-end gap-2">
          <InfoTip label="Cómo funcionan">Las reglas se evalúan en cada envío. Un segmento usado por campañas se conserva como evidencia.</InfoTip>
          <SegmentFormAction fields={overview.segment_fields} />
        </div>
      )}
      {overview.segments.length === 0 ? (
        <EmptyState icon={<Users size={20} />} title="Aún no hay segmentos" description="Crea uno con reglas de tipo de contacto, destino, gasto o consentimiento." />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {overview.segments.map((segment, index) => (
            <li key={segment.code} style={{ animationDelay: `${index * 60}ms` }} className="lift flex animate-[rise-in_420ms_cubic-bezier(0.22,1,0.36,1)_backwards] flex-col rounded-tile border border-line bg-surface p-4">
              <div className="flex items-start justify-between gap-2">
                <b className="text-[14px]">{segment.name}</b>
                <span className="font-mono text-[11.5px] text-fg-3">{segment.code}</span>
              </div>
              <RuleChips parts={segment.rules_parts ?? []} match={segment.match} fallback={segment.rules_text} />
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
              <div className="mt-auto flex items-end justify-between gap-2 pt-3">
                <p className="text-[11.5px] text-fg-3">
                  {segment.campaigns === 0 ? "Sin campañas" : `${segment.campaigns} ${segment.campaigns === 1 ? "campaña" : "campañas"}`} · {segment.match === "all" ? "todas las reglas" : "alguna regla"}
                  <span className="block">Actualizado {formatDate(segment.updated_at)}{segment.owner ? ` · ${segment.owner}` : ""}</span>
                </p>
                {manage && (
                  <RowActions>
                    <SegmentFormAction fields={overview.segment_fields} segment={segment} />
                    <SegmentDuplicateAction segment={segment} />
                    <SegmentDeleteAction segment={segment} />
                  </RowActions>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
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

function TemplatesTable({ overview }: { overview: MarketingOverview }) {
  const manage = overview.can.manage;
  const columns: Column<MarketingTemplate>[] = [
    {
      id: "name",
      header: "Plantilla",
      mobile: "title",
      cell: (row) => (
        <span className="min-w-0">
          <b className={row.channel === "whatsapp" ? "font-mono text-[13px]" : "text-[13.5px]"}>{row.name}</b>
          <span className="block max-w-[420px] truncate text-[12px] text-fg-3">
            {row.code}
            {row.provider_template_id ? ` · ID Meta ${row.provider_template_id}` : ""} · {row.subject ?? row.body}
          </span>
        </span>
      ),
    },
    { id: "channel", header: "Canal", cell: (row) => <Badge tone={row.channel === "email" ? "info" : "ok"} dot={false}>{row.channel === "email" ? "Email" : "WhatsApp"}</Badge> },
    { id: "category", header: "Categoría", cell: (row) => <span className="text-[12.5px] text-fg-2">{row.category_label}</span> },
    { id: "status", header: "Estado", cell: (row) => <Badge tone={TEMPLATE_STATUS[row.status].tone}>{TEMPLATE_STATUS[row.status].label}</Badge> },
    { id: "uses", header: "Uso", align: "right", cell: (row) => <span className="font-mono text-[13px]" title="Campañas que usan la plantilla">{row.uses}</span> },
    { id: "updated", header: "Actualizada", cell: (row) => <span className="text-[12.5px] text-fg-2">{formatDate(row.updated_at)}</span> },
    ...(manage
      ? [
          {
            id: "actions",
            header: "",
            align: "right" as const,
            mobile: "hidden" as const,
            cell: (row: MarketingTemplate) => (
              <RowActions>
                <TemplateFormAction variables={overview.variables} template={row} />
                <TemplateReviewAction template={row} />
              </RowActions>
            ),
          },
        ]
      : []),
  ];
  const filters: FilterConfig<MarketingTemplate>[] = [
    { id: "channel", label: "Canal", options: [{ value: "email", label: "Email" }, { value: "whatsapp", label: "WhatsApp" }], value: (row) => row.channel },
    { id: "status", label: "Estado", options: Object.entries(TEMPLATE_STATUS).map(([value, item]) => ({ value, label: item.label })), value: (row) => row.status },
  ];
  return (
    <DataTable
      screen="marketing-plantillas"
      rows={overview.templates}
      columns={columns}
      getKey={(row) => row.code}
      entityLabel="plantillas"
      searchText={(row) => `${row.code} ${row.name} ${row.body}`}
      searchPlaceholder="Buscar plantilla"
      filters={filters}
      toolbarEnd={manage ? <TemplateFormAction variables={overview.variables} /> : undefined}
    />
  );
}

export function MarketingWorkspace({ overview, section }: { overview: MarketingOverview; section: "campaigns" | "segments" | "codes" | "templates" }) {
  if (section === "campaigns") return <CampaignsTable overview={overview} />;
  if (section === "templates") return <TemplatesTable overview={overview} />;
  return <Card>{section === "segments" ? <SegmentsGrid overview={overview} /> : <CodesList overview={overview} />}</Card>;
}
