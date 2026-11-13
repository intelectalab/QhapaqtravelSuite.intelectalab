"use client";

import { AlarmClock, ExternalLink, Hourglass, Inbox } from "lucide-react";
import Link from "next/link";
import { DataTable } from "@/components/table/DataTable";
import { Button } from "@/components/ui/Button";
import { RowActions } from "@/components/table/RowActions";
import type { Column, FilterConfig, MetricFilter, SortOption } from "@/components/table/types";
import { Badge } from "@/components/ui/Badge";
import { BOOK_STATUS_TONE, DEADLINE, type ClaimSheet, type ClaimsOverview, type Deadline } from "@/lib/claims";
import { formatDate } from "@/lib/format";
import { ClaimAlertsAction, ClaimCloseAction, ClaimDetailAction, ClaimFormAction, ClaimLinkAction, ClaimResendAction } from "./ClaimForms";

const unique = (values: (string | null)[]) => [...new Set(values.filter((value): value is string => Boolean(value)))];

export function ClaimsTable({ overview, publicUrl }: { overview: ClaimsOverview; publicUrl?: string | null }) {
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
          <Link href={`/crm/reclamaciones/${encodeURIComponent(row.code)}`} className="mt-1 block max-w-[380px] truncate text-[13.5px] font-semibold hover:text-accent">
            {row.detail}
          </Link>
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
          <ClaimDetailAction sheet={row} canManage={overview.can.manage} owners={overview.options.owners ?? []} />
          {overview.can.manage && row.book_status === "received" && <ClaimDetailAction sheet={row} canManage owners={overview.options.owners ?? []} respondNow />}
          <ClaimFormAction overview={overview} sheet={row} />
          {overview.can.manage && <ClaimLinkAction sheet={row} overview={overview} />}
          {row.book_status === "answered" ? <ClaimResendAction sheet={row} /> : null}
          <ClaimCloseAction sheet={row} reasons={overview.options.close_reasons} />
        </RowActions>
      ),
    },
  ];
  const metrics: MetricFilter<ClaimSheet>[] = [
    { id: "open", label: "Sin respuesta", tone: "info", icon: <Inbox size={19} />, matches: (row) => row.book_status === "received" || row.book_status === "in_review" },
    { id: "soon", label: "Por vencer", tone: "warn", icon: <Hourglass size={19} />, matches: (row) => row.deadline === "por_vencer" },
    { id: "late", label: "Vencidas", tone: "bad", icon: <AlarmClock size={19} />, matches: (row) => row.deadline === "vencido" },
  ];
  const filters: FilterConfig<ClaimSheet>[] = [
    { id: "type", label: "Tipo", options: unique(rows.map((row) => row.type)).map((value) => ({ value, label: value })), value: (row) => row.type },
    { id: "sede", label: "Sede", options: unique(rows.map((row) => row.sede)).map((value) => ({ value, label: value })), value: (row) => row.sede ?? "" },
    { id: "status", label: "Estado", options: unique(rows.map((row) => row.book_status_label)).map((value) => ({ value, label: value })), value: (row) => row.book_status_label },
    { id: "deadline", label: "Plazo", options: (Object.keys(DEADLINE) as Deadline[]).map((value) => ({ value, label: DEADLINE[value].label })), value: (row) => row.deadline },
  ];
  const sorts: SortOption<ClaimSheet>[] = [
    { id: "received", label: "Fecha de recepción", type: "date", value: (row) => row.received_at },
    { id: "due", label: "Vencimiento", type: "date", value: (row) => row.due_date },
  ];
  const toolbarEnd = (
    <span className="flex flex-wrap items-center gap-2">
      {publicUrl && (
        <Button href={publicUrl} target="_blank" variant="ghost" size="sm" icon={<ExternalLink size={14} />}>
          Formulario público
        </Button>
      )}
      {overview.can.manage && <ClaimAlertsAction pending={rows.filter((row) => row.deadline === "por_vencer" || row.deadline === "vencido").length} />}
    </span>
  );
  return <DataTable screen="reclamaciones" rows={rows} columns={columns} getKey={(row) => row.code} entityLabel="hojas" searchText={(row) => `${row.book_number} ${row.consumer.name} ${row.detail} ${row.consumer.doc_number ?? ""}`} searchPlaceholder="Buscar número, consumidor o documento" metrics={metrics} filters={filters} sorts={sorts} toolbarEnd={toolbarEnd} />;
}
