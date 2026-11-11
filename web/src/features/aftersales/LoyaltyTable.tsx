"use client";

import { CalendarDays, CircleSlash, Crown, MapPin, Repeat2, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { createRebuy } from "@/app/(backoffice)/crm/postventa/actions";
import { DataTable } from "@/components/table/DataTable";
import { RowActions } from "@/components/table/RowActions";
import type { Column, FilterConfig, MetricFilter, SortOption } from "@/components/table/types";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { ChoiceGroup } from "@/components/ui/ChoiceGroup";
import { PanelAction } from "@/components/ui/PanelAction";
import { SelectField } from "@/components/ui/SelectField";
import { SwitchField } from "@/components/ui/SwitchField";
import { TextArea } from "@/components/ui/TextArea";
import { TextField } from "@/components/ui/TextField";
import { recencyBuckets, type LoyaltyMeta, type LoyaltyRow } from "@/lib/aftersales";
import { formatDate, formatMoney } from "@/lib/format";
import type { StepResult } from "@/lib/server/resource";

const initial: StepResult = { message: null, done: false };

const npsTone = (score: number) => (score >= 9 ? "ok" : score >= 7 ? "warn" : "bad");

function RebuyFields({ row, owners }: { row: LoyaltyRow; owners: { id: string; name: string }[] }) {
  const [confirmed, setConfirmed] = useState(false);
  const { proposal } = row;
  return (
    <>
      <input type="hidden" name="client_code" value={row.code} />
      <div className="grid grid-cols-3 gap-2 rounded-tile bg-surface-2 p-3 text-[12.5px]">
        <p>
          <span className="block text-fg-3">Última compra</span>
          <b>{row.last_purchase_date ? formatDate(row.last_purchase_date) : "Sin compras"}</b>
        </p>
        <p>
          <span className="block text-fg-3">Ticket promedio</span>
          <b>{row.purchases > 0 ? formatMoney(row.average_pen, "PEN") : "Sin historial"}</b>
        </p>
        <p className="min-w-0">
          <span className="block text-fg-3">Ya visitó</span>
          <b className="block truncate">{row.destinations.length > 0 ? row.destinations.join(", ") : "Ningún destino"}</b>
        </p>
      </div>
      {row.has_open_opportunity && (
        <div className="rounded-tile border border-warn/40 bg-[color-mix(in_srgb,var(--warn)_8%,var(--surface))] p-3">
          <p className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold text-warn">
            <TriangleAlert size={15} /> {row.open_opportunities.length === 1 ? "Ya tiene una oportunidad abierta" : `Ya tiene ${row.open_opportunities.length} oportunidades abiertas`}
          </p>
          <ul className="mb-3 flex flex-col gap-1 text-[12.5px]">
            {row.open_opportunities.map((opportunity) => (
              <li key={opportunity.code} className="flex items-center justify-between gap-2">
                <Link href={`/crm/oportunidades/${opportunity.code}`} className="truncate hover:text-accent hover:underline">
                  {opportunity.code} · {opportunity.title}
                </Link>
                <StatusBadge status={opportunity.stage} />
              </li>
            ))}
          </ul>
          <SwitchField label="Crear otra de recompra igualmente" name="confirm_open" checked={confirmed} onCheckedChange={setConfirmed} />
        </div>
      )}
      <TextField label="Título" name="title" required maxLength={200} defaultValue={proposal.title} />
      <TextField label="Destino sugerido" name="destination" maxLength={120} defaultValue={proposal.destination} icon={<MapPin size={17} />} hint="Según lo que ya visitó: el siguiente destino de la ruta." />
      <div className="grid grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] gap-3">
        <TextField label="Monto estimado" name="amount" type="number" min={1} step="0.01" required defaultValue={proposal.amount} hint={row.purchases > 0 ? "Su ticket promedio." : "Monto de referencia sin historial."} />
        <ChoiceGroup label="Moneda" name="currency" defaultValue={proposal.currency} options={[{ value: "PEN", label: "Soles" }, { value: "USD", label: "Dólares" }]} />
      </div>
      <TextField label="Cierre esperado" name="expected_close_date" type="date" required defaultValue={proposal.expected_close_date} icon={<CalendarDays size={17} />} hint="Entra en la etapa Calificación." />
      {owners.length > 0 && <SelectField label="Responsable" name="owner_id" options={owners.map((owner) => ({ value: owner.id, label: owner.name }))} defaultValue={proposal.owner_id} />}
      <TextArea label="Notas" name="notes" rows={3} maxLength={2000} defaultValue={proposal.notes} />
    </>
  );
}

export function RebuyAction({ row, owners }: { row: LoyaltyRow; owners: { id: string; name: string }[] }) {
  return (
    <PanelAction<StepResult>
      label="Crear recompra"
      icon={<Repeat2 size={15} />}
      size="sm"
      formId={`recompra-${row.code}`}
      title="Crear oportunidad de recompra"
      description={`${row.name} · origen Fidelización`}
      submitLabel="Crear oportunidad"
      action={createRebuy}
      initial={initial}
    >
      {() => <RebuyFields row={row} owners={owners} />}
    </PanelAction>
  );
}

export function LoyaltyTable({ rows, meta, owners }: { rows: LoyaltyRow[]; meta: LoyaltyMeta; owners: { id: string; name: string }[] }) {
  const columns: Column<LoyaltyRow>[] = [
    {
      id: "client",
      header: "Cliente",
      mobile: "title",
      cell: (row) => (
        <div className="min-w-0">
          <Link href={`/crm/clientes/${row.code}`} className="text-[13.5px] font-semibold hover:text-accent hover:underline">
            {row.name}
          </Link>
          <span className="block text-[12px] text-fg-3">{[row.segment ?? "Sin segmento", row.owner].filter(Boolean).join(" · ")}</span>
        </div>
      ),
    },
    {
      id: "last",
      header: "Última compra",
      cell: (row) =>
        row.last_purchase_date ? (
          <span className="text-[13px]">
            {formatDate(row.last_purchase_date)}
            <span className="block text-[12px] text-fg-3">hace {row.days_since} {row.days_since === 1 ? "día" : "días"}</span>
          </span>
        ) : (
          <span className="text-[13px] text-fg-3">Sin compras</span>
        ),
    },
    {
      id: "destinations",
      header: "Destinos",
      wideOnly: true,
      cell: (row) => <span className="line-clamp-2 max-w-[240px] text-[13px] text-fg-2">{row.destinations.length > 0 ? row.destinations.join(", ") : "—"}</span>,
    },
    { id: "total", header: "Comprado", align: "right", cell: (row) => <span className="font-mono text-[13px]">{formatMoney(row.total_pen, "PEN")}</span> },
    {
      id: "nps",
      header: "NPS",
      cell: (row) =>
        row.nps === null ? (
          <span className="text-fg-3">—</span>
        ) : (
          <Badge tone={npsTone(row.nps)} dot={false} className="font-mono">
            {row.nps}
          </Badge>
        ),
    },
    {
      id: "actions",
      header: "",
      align: "right",
      mobile: "hidden",
      cell: (row) => <RowActions>{meta.can.rebuy ? <RebuyAction row={row} owners={owners} /> : null}</RowActions>,
    },
  ];
  const metrics: MetricFilter<LoyaltyRow>[] = [
    { id: "dormant", label: "Sin comprar hace más de 180 días", tone: "warn", icon: <CircleSlash size={19} />, matches: (row) => row.days_since !== null && row.days_since > 180 },
    { id: "promoters", label: "Promotores sin oportunidad abierta", tone: "ok", icon: <Crown size={19} />, matches: (row) => row.nps !== null && row.nps >= 9 && !row.has_open_opportunity },
  ];
  const filters: FilterConfig<LoyaltyRow>[] = [
    { id: "segment", label: "Segmento", options: meta.segments.map((value) => ({ value, label: value })), value: (row) => row.segment ?? "" },
    { id: "last", label: "Última compra", options: meta.recency, value: (row) => recencyBuckets(row.days_since) },
    { id: "destination", label: "Destino visitado", options: meta.destinations.map((value) => ({ value, label: value })), value: (row) => row.destinations },
  ];
  const sorts: SortOption<LoyaltyRow>[] = [
    { id: "total", label: "Comprado", type: "number", value: (row) => row.total_pen },
    { id: "last", label: "Última compra", type: "date", value: (row) => row.last_purchase_date },
    { id: "nps", label: "NPS", type: "number", value: (row) => row.nps },
  ];
  return (
    <DataTable
      screen="postventa-segmentacion"
      rows={rows}
      columns={columns}
      getKey={(row) => row.code}
      entityLabel="clientes"
      searchText={(row) => `${row.name} ${row.code} ${row.destinations.join(" ")}`}
      searchPlaceholder="Buscar cliente o destino"
      metrics={metrics}
      filters={filters}
      sorts={sorts}
      csv={{
        fileName: "segmentacion-fidelizacion",
        columns: [
          { header: "Código", value: (row) => row.code },
          { header: "Cliente", value: (row) => row.name },
          { header: "Segmento", value: (row) => row.segment },
          { header: "Responsable", value: (row) => row.owner },
          { header: "Última compra", value: (row) => row.last_purchase_date },
          { header: "Días desde la compra", value: (row) => row.days_since },
          { header: "Destinos", value: (row) => row.destinations.join(" / ") },
          { header: "Compras", value: (row) => row.purchases },
          { header: "Comprado (S/)", value: (row) => row.total_pen },
          { header: "NPS", value: (row) => row.nps },
          { header: "Oportunidad abierta", value: (row) => row.has_open_opportunity },
        ],
      }}
    />
  );
}
