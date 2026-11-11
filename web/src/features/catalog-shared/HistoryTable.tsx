"use client";

import { DataTable } from "@/components/table/DataTable";
import type { Column } from "@/components/table/types";
import type { CatalogHistoryEvent } from "@/lib/catalog-services";
import { capitalize, formatDateTime } from "@/lib/format";

const action = (event: CatalogHistoryEvent) => capitalize(event.action.replace(/_/g, " "));

export function HistoryTable({ screen, events, fileName }: { screen: string; events: CatalogHistoryEvent[]; fileName: string }) {
  const columns: Column<CatalogHistoryEvent>[] = [
    { id: "when", header: "Fecha", cell: (event) => <span className="font-mono text-[12.5px] text-fg-2">{formatDateTime(event.occurred_at)}</span> },
    { id: "action", header: "Acción", mobile: "title", cell: (event) => <b className="text-[13px] font-semibold">{action(event)}</b> },
    {
      id: "detail",
      header: "Detalle",
      className: "whitespace-normal",
      cell: (event) => (
        <span className="block max-w-[520px] text-[13px]">
          {event.after_value ?? "—"}
          {event.before_value && <small className="block text-[12px] text-fg-3">Antes: {event.before_value}</small>}
        </span>
      ),
    },
    { id: "actor", header: "Autor", cell: (event) => <span className="text-[13px] text-fg-2">{event.actor ?? "Sistema"}</span> },
  ];
  return (
    <DataTable
      screen={screen}
      rows={events}
      columns={columns}
      getKey={(event) => event.code}
      entityLabel="cambios"
      searchText={(event) => `${event.action} ${event.after_value ?? ""} ${event.before_value ?? ""} ${event.actor ?? ""}`}
      searchPlaceholder="Buscar en el historial"
      emptyTitle="Sin cambios registrados"
      csv={{
        fileName,
        columns: [
          { header: "Fecha", value: (event) => event.occurred_at },
          { header: "Acción", value: action },
          { header: "Detalle", value: (event) => event.after_value },
          { header: "Antes", value: (event) => event.before_value },
          { header: "Autor", value: (event) => event.actor ?? "Sistema" },
        ],
      }}
    />
  );
}
