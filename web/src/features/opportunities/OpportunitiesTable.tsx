"use client";

import Link from "next/link";
import { DataTable } from "@/components/table/DataTable";
import { RowActions, RowIcon } from "@/components/table/RowActions";
import type { Column, FilterConfig, SortOption } from "@/components/table/types";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/cn";
import { formatDate, formatMoney, shortName } from "@/lib/format";
import { OPEN_STAGES, STAGE_TONE, type OpportunityBoard, type OpportunityItem } from "@/lib/opportunities";

const href = (item: OpportunityItem) => `/crm/oportunidades/${item.code}`;

const weighted = (item: OpportunityItem) => (item.amount_pen * item.probability) / 100;

const situation = (item: OpportunityItem) => (item.stage === "ganada" ? "ganada" : item.stage === "perdida" ? "perdida" : "abierta");

const SITUATIONS = [
  { value: "abierta", label: "Abiertas" },
  { value: "ganada", label: "Ganadas" },
  { value: "perdida", label: "Perdidas" },
];

export function OpportunitiesTable({ board, today }: { board: OpportunityBoard; today: string }) {
  const stageName = (code: string) => board.stages.find((stage) => stage.code === code)?.name ?? code;
  const columns: Column<OpportunityItem>[] = [
    {
      id: "title",
      header: "Oportunidad",
      mobile: "title",
      cell: (item) => (
        <div className="min-w-0">
          <Link href={href(item)} className="font-semibold hover:underline">
            {item.title}
          </Link>
          <small className="block text-xs text-fg-3">
            {item.code}
            {item.destination ? ` · ${item.destination}` : ""}
          </small>
        </div>
      ),
    },
    {
      id: "client",
      header: "Cliente",
      cell: (item) => (
        <Link href={`/crm/clientes/${item.client.code}`} className="text-[13px] hover:underline">
          {item.client.name}
        </Link>
      ),
    },
    { id: "stage", header: "Etapa", cell: (item) => <Badge tone={STAGE_TONE[item.stage]}>{stageName(item.stage)}</Badge> },
    {
      id: "amount",
      header: "Monto",
      align: "right",
      cell: (item) => (
        <span className="leading-tight">
          <b className="block font-mono text-[13px] font-semibold">{formatMoney(item.amount, item.currency)}</b>
          {item.currency !== "PEN" && <span className="text-[11.5px] text-fg-3">{formatMoney(item.amount_pen, "PEN", { compact: true })}</span>}
        </span>
      ),
    },
    {
      id: "weighted",
      header: "Ponderado",
      align: "right",
      wideOnly: true,
      cell: (item) => (
        <span className="leading-tight">
          <b className="block font-mono text-[13px]">{OPEN_STAGES.includes(item.stage) ? formatMoney(weighted(item), "PEN", { compact: true }) : "—"}</b>
          <span className="text-[11.5px] text-fg-3">{item.probability} %</span>
        </span>
      ),
    },
    {
      id: "close",
      header: "Cierre",
      cell: (item) => {
        const overdue = OPEN_STAGES.includes(item.stage) && item.expected_close_date < today;
        return <span className={cn("text-[13px]", overdue ? "font-semibold text-bad" : "text-fg-2")}>{formatDate(item.closed_at ?? item.expected_close_date)}</span>;
      },
    },
    { id: "quotes", header: "Cotizaciones", align: "right", wideOnly: true, cell: (item) => <span className="font-mono text-[13px] text-fg-2">{item.quotes_count ?? 0}</span> },
    {
      id: "owner",
      header: "Responsable",
      cell: (item) => (
        <span className="flex items-center gap-2 text-[13px]">
          <Avatar name={item.owner.name} size="xs" solid className="max-md:hidden" />
          {shortName(item.owner.name)}
        </span>
      ),
    },
    {
      id: "actions",
      header: "",
      mobile: "hidden",
      align: "right",
      cell: (item) => (
        <RowActions>
          <RowIcon tone="view" label="Ver ficha" href={href(item)} />
        </RowActions>
      ),
    },
  ];

  const unique = (values: string[]) => [...new Set(values)].sort((a, b) => a.localeCompare(b, "es")).map((value) => ({ value, label: value }));
  const filters: FilterConfig<OpportunityItem>[] = [
    { id: "situation", label: "Situación", options: SITUATIONS, value: situation },
    { id: "stage", label: "Etapa", options: board.stages.map((stage) => ({ value: stage.code, label: stage.name })), value: (item) => item.stage },
    { id: "owner", label: "Responsable", options: unique(board.items.map((item) => item.owner.name)), value: (item) => item.owner.name },
  ];
  const sorts: SortOption<OpportunityItem>[] = [
    { id: "close", label: "Fecha de cierre", type: "date", value: (item) => item.expected_close_date },
    { id: "amount", label: "Monto en soles", type: "number", value: (item) => item.amount_pen },
    { id: "weighted", label: "Ponderado", type: "number", value: (item) => (OPEN_STAGES.includes(item.stage) ? weighted(item) : 0) },
    { id: "title", label: "Título", type: "text", value: (item) => item.title },
  ];

  return (
    <DataTable
      screen="opportunities"
      rows={board.items}
      columns={columns}
      getKey={(item) => item.code}
      entityLabel="oportunidades"
      searchText={(item) => `${item.title} ${item.client.name} ${item.code} ${item.destination ?? ""}`}
      searchPlaceholder="Buscar título, cliente o destino"
      filters={filters}
      sorts={sorts}
      csv={{
        fileName: "oportunidades",
        columns: [
          { header: "Código", value: (item) => item.code },
          { header: "Oportunidad", value: (item) => item.title },
          { header: "Cliente", value: (item) => item.client.name },
          { header: "Etapa", value: (item) => stageName(item.stage) },
          { header: "Moneda", value: (item) => item.currency },
          { header: "Monto", value: (item) => item.amount },
          { header: "Monto en soles", value: (item) => item.amount_pen },
          { header: "Probabilidad", value: (item) => item.probability },
          { header: "Ponderado en soles", value: (item) => (OPEN_STAGES.includes(item.stage) ? Math.round(weighted(item)) : 0) },
          { header: "Cierre esperado", value: (item) => item.expected_close_date },
          { header: "Cerrada el", value: (item) => item.closed_at },
          { header: "Cotizaciones", value: (item) => item.quotes_count ?? 0 },
          { header: "Responsable", value: (item) => item.owner.name },
        ],
      }}
    />
  );
}
