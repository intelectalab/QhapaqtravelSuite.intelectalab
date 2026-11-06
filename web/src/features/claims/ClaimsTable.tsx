"use client";

import { AlarmClock, Hourglass, Inbox } from "lucide-react";
import { DataTable } from "@/components/table/DataTable";
import { RowActions } from "@/components/table/RowActions";
import type { Column, FilterConfig, MetricFilter, SortOption } from "@/components/table/types";
import { Badge } from "@/components/ui/Badge";
import { BOOK_STATUS_TONE, DEADLINE, type ClaimSheet, type ClaimsOverview } from "@/lib/claims";
import { formatDate } from "@/lib/format";
import { ClaimCloseAction, ClaimDetailAction, ClaimFormAction } from "./ClaimForms";

const unique = (values: (string | null)[]) => [...new Set(values.filter((value): value is string => Boolean(value)))];

export function ClaimsTable({ overview }: { overview: ClaimsOverview }) {
  const rows = overview.claims;
  const columns: Column<ClaimSheet>[] = [
    {
      id: "sheet",
      header: "Hoja",
      mobile: "title",
      cell: (row) => (
        <div className="min-w-0">
          <span className="flex items-center gap-2">
            <Badge tone={row.type_code === "reclamo" ? "warn" : "violet"} dot={false}>
              {row.type}
            </Badge>
            <span className="font-mono text-[12px] text-fg-3">{row.book_number}</span>
          </span>
          <span className="mt-1 block max-w-[380px] truncate text-[13.5px] font-semibold">{row.detail}</span>
        </div>
      ),
    },
    {
      id: "consumer",
      header: "Consumidor",
      cell: (row) => (
        <span className="text-[13px]">
          {row.consumer.name}
          <span className="block text-[12px] text-fg-3">{row.sede} · {row.channel_label}</span>
        </span>
      ),
    },
    { id: "received", header: "Recibida", cell: (row) => <span className="text-[13px]">{formatDate(row.received_on)}</span> },
    {
      id: "deadline",
      header: "Plazo",
      cell: (row) => (
        <span className="flex flex-col gap-1">
          <Badge tone={DEADLINE[row.deadline].tone}>{DEADLINE[row.deadline].label}</Badge>
          {row.due_date && !row.response && row.book_status !== "closed" && <span className="text-[11.5px] text-fg-3">{row.days_left !== null && row.days_left >= 0 ? `Quedan ${row.days_left} días hábiles` : `Venció el ${formatDate(row.due_date)}`}</span>}
        </span>
      ),
    },
    { id: "status", header: "Estado", cell: (row) => <Badge tone={BOOK_STATUS_TONE[row.book_status]}>{row.book_status_label}</Badge> },
    {
      id: "actions",
      header: "",
      align: "right",
      mobile: "hidden",
      cell: (row) => (
        <RowActions>
          <ClaimDetailAction sheet={row} canManage={overview.can.manage} />
          <ClaimFormAction overview={overview} sheet={row} />
          <ClaimCloseAction sheet={row} />
        </RowActions>
      ),
    },
  ];
  const metrics: MetricFilter<ClaimSheet>[] = [
    { id: "open", label: "Sin respuesta", tone: "info", icon: <Inbox size={19} />, matches: (row) => row.book_status === "received" || row.book_status === "in_review" },
    { id: "soon", label: "Por vencer", tone: "warn", icon: <Hourglass size={19} />, matches: (row) => row.deadline === "por_vencer" },
    { id: "late", label: "Vencidas", tone: "bad", icon: <AlarmClock size={19} />, matches: (row) => row.deadline === "vencido" || row.deadline === "respondido_fuera_de_plazo" },
  ];
  const filters: FilterConfig<ClaimSheet>[] = [
    { id: "type", label: "Tipo", options: unique(rows.map((row) => row.type)).map((value) => ({ value, label: value })), value: (row) => row.type },
    { id: "sede", label: "Sede", options: unique(rows.map((row) => row.sede)).map((value) => ({ value, label: value })), value: (row) => row.sede ?? "" },
    { id: "status", label: "Estado", options: unique(rows.map((row) => row.book_status_label)).map((value) => ({ value, label: value })), value: (row) => row.book_status_label },
  ];
  const sorts: SortOption<ClaimSheet>[] = [
    { id: "received", label: "Fecha de recepción", type: "date", value: (row) => row.received_at },
    { id: "due", label: "Vencimiento", type: "date", value: (row) => row.due_date },
  ];
  return <DataTable screen="reclamaciones" rows={rows} columns={columns} getKey={(row) => row.code} entityLabel="hojas" searchText={(row) => `${row.book_number} ${row.consumer.name} ${row.detail} ${row.consumer.doc_number ?? ""}`} searchPlaceholder="Buscar número, consumidor o documento" metrics={metrics} filters={filters} sorts={sorts} />;
}
