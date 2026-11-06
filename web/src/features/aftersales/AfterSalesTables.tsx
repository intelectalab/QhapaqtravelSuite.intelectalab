"use client";

import { Bot, CircleAlert, Smile, ThumbsDown } from "lucide-react";
import Link from "next/link";
import { DataTable } from "@/components/table/DataTable";
import { RowActions, RowIcon } from "@/components/table/RowActions";
import type { Column, FilterConfig, MetricFilter, SortOption } from "@/components/table/types";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { CATEGORY_LABEL, CATEGORY_TONE, type AfterSalesOverview, type CaseItem, type SurveyItem } from "@/lib/aftersales";
import { formatDate, formatDateTime } from "@/lib/format";
import { statusLabel } from "@/lib/tone";
import { CaseDetailAction, CaseFormAction, SurveyAction } from "./AfterSalesForms";

const unique = (values: string[]) => [...new Set(values)];

export function ScoreBadge({ score, category }: { score: number; category: SurveyItem["category"] }) {
  return (
    <span title={CATEGORY_LABEL[category]} className="inline-flex items-center gap-2">
      <Badge tone={CATEGORY_TONE[category]} dot={false} className="font-mono">
        {score}
      </Badge>
      <span className="text-[12px] text-fg-3">{CATEGORY_LABEL[category]}</span>
    </span>
  );
}

export function CasesTable({ overview }: { overview: AfterSalesOverview }) {
  const rows = overview.cases;
  const columns: Column<CaseItem>[] = [
    {
      id: "case",
      header: "Caso",
      mobile: "title",
      cell: (row) => (
        <div className="min-w-0">
          <span className="block max-w-[380px] truncate text-[13.5px] font-semibold">{row.subject}</span>
          <span className="text-[12px] text-fg-3">
            {row.code} · {row.type}
            {row.origin === "nps_auto" && " · por NPS"}
          </span>
        </div>
      ),
    },
    {
      id: "client",
      header: "Cliente",
      cell: (row) =>
        row.client ? (
          <Link href={`/crm/clientes/${row.client.code}`} className="text-[13px] hover:text-accent hover:underline">
            {row.client.name}
            {row.reservation && <span className="block text-[12px] text-fg-3">{row.reservation}</span>}
          </Link>
        ) : (
          <span className="text-fg-3">—</span>
        ),
    },
    { id: "priority", header: "Prioridad", cell: (row) => <StatusBadge status={row.priority} /> },
    { id: "status", header: "Estado", cell: (row) => <StatusBadge status={row.status} label={row.status_label} /> },
    { id: "owner", header: "Responsable", cell: (row) => <span className="text-[13px]">{row.owner.name}<span className="block text-[12px] text-fg-3">{formatDate(row.created_at)}</span></span> },
    {
      id: "actions",
      header: "",
      align: "right",
      mobile: "hidden",
      cell: (row) => (
        <RowActions>
          <CaseDetailAction item={row} />
          {overview.can.manage && row.status !== "cerrada" ? <CaseFormAction overview={overview} item={row} /> : <RowIcon tone="edit" label="Editar" disabledHint="El caso está cerrado" />}
        </RowActions>
      ),
    },
  ];
  const metrics: MetricFilter<CaseItem>[] = [
    { id: "open", label: "Abiertos", tone: "info", icon: <CircleAlert size={19} />, matches: (row) => row.status === "abierta" || row.status === "en_proceso" },
    { id: "nps", label: "Por NPS de detractor", tone: "bad", icon: <Bot size={19} />, matches: (row) => row.origin === "nps_auto" },
  ];
  const filters: FilterConfig<CaseItem>[] = [
    { id: "type", label: "Tipo", options: unique(rows.map((row) => row.type)).map((value) => ({ value, label: value })), value: (row) => row.type },
    { id: "status", label: "Estado", options: unique(rows.map((row) => row.status)).map((value) => ({ value, label: statusLabel(value) })), value: (row) => row.status },
  ];
  const sorts: SortOption<CaseItem>[] = [{ id: "created", label: "Fecha de registro", type: "date", value: (row) => row.created_at }];
  return <DataTable screen="postventa-casos" rows={rows} columns={columns} getKey={(row) => row.code} entityLabel="casos" searchText={(row) => `${row.code} ${row.subject} ${row.client?.name ?? ""}`} searchPlaceholder="Buscar caso o cliente" metrics={metrics} filters={filters} sorts={sorts} />;
}

export function SurveysTable({ overview }: { overview: AfterSalesOverview }) {
  const rows = overview.surveys;
  const columns: Column<SurveyItem>[] = [
    {
      id: "client",
      header: "Cliente",
      mobile: "title",
      cell: (row) => (
        <div className="min-w-0">
          <Link href={`/crm/clientes/${row.client.code}`} className="text-[13.5px] font-semibold hover:text-accent hover:underline">
            {row.client.name}
          </Link>
          <span className="block text-[12px] text-fg-3">{row.reservation ? `${row.reservation.code} · ${row.reservation.title}` : "Sin reserva asociada"}</span>
        </div>
      ),
    },
    { id: "score", header: "Puntaje", cell: (row) => <ScoreBadge score={row.score} category={row.category} /> },
    { id: "comment", header: "Comentario", wideOnly: true, cell: (row) => <span className="line-clamp-2 max-w-[360px] text-[13px] text-fg-2">{row.comment ?? "—"}</span> },
    { id: "channel", header: "Canal", cell: (row) => <span className="text-[13px]">{row.channel}<span className="block text-[12px] text-fg-3">{formatDateTime(row.responded_at, false)}</span></span> },
    {
      id: "actions",
      header: "",
      align: "right",
      mobile: "hidden",
      cell: (row) => <RowActions>{overview.can.manage ? <SurveyAction overview={overview} survey={row} /> : null}</RowActions>,
    },
  ];
  const metrics: MetricFilter<SurveyItem>[] = [
    { id: "promoters", label: "Promotores", tone: "ok", icon: <Smile size={19} />, matches: (row) => row.category === "promotor" },
    { id: "detractors", label: "Detractores", tone: "bad", icon: <ThumbsDown size={19} />, matches: (row) => row.category === "detractor" },
  ];
  const sorts: SortOption<SurveyItem>[] = [
    { id: "date", label: "Fecha", type: "date", value: (row) => row.responded_at },
    { id: "score", label: "Puntaje", type: "number", value: (row) => row.score },
  ];
  return <DataTable screen="postventa-encuestas" rows={rows} columns={columns} getKey={(row) => row.code} entityLabel="encuestas" searchText={(row) => `${row.client.name} ${row.comment ?? ""} ${row.code}`} searchPlaceholder="Buscar cliente o comentario" metrics={metrics} sorts={sorts} />;
}
