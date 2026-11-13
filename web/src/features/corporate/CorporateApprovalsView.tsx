"use client";

import { CircleCheck, CircleX, Clock, ShieldAlert, Timer } from "lucide-react";
import { decideApproval } from "@/app/(portal)/portal/corporativo/actions";
import { DataTable } from "@/components/table/DataTable";
import { RowActions, RowIcon } from "@/components/table/RowActions";
import type { Column, FilterConfig, MetricFilter, SortOption } from "@/components/table/types";
import { Badge } from "@/components/ui/Badge";
import { TextArea } from "@/components/ui/TextArea";
import { budgetLabel, budgetTone, num, type CorporateApproval, type CorporateApprovalsMeta } from "@/lib/corporate";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import type { Tone } from "@/lib/tone";
import { CorporateStep } from "./CorporateForms";

const STATUS_TONE: Record<CorporateApproval["status"], Tone> = { pendiente: "warn", aprobada: "ok", rechazada: "bad", vencida: "mute", cancelada: "mute" };

function Summary({ row }: { row: CorporateApproval }) {
  return (
    <dl className="grid gap-1.5 rounded-tile bg-surface-2 px-3.5 py-3 text-[13px]">
      <div className="flex justify-between gap-3">
        <dt className="text-fg-3">Viaje</dt>
        <dd className="text-right">{row.title}</dd>
      </div>
      <div className="flex justify-between gap-3">
        <dt className="text-fg-3">Centro de costo</dt>
        <dd>{row.cost_center ? `${row.cost_center.code} · ${row.cost_center.name}` : "—"}</dd>
      </div>
      <div className="flex justify-between gap-3">
        <dt className="text-fg-3">Importe</dt>
        <dd className="font-mono font-semibold">{formatMoney(row.amount, row.currency)}</dd>
      </div>
      {row.budget?.exceeded && <dd className="text-[12.5px] font-medium text-bad">Con esta compra el centro de costo supera su presupuesto.</dd>}
    </dl>
  );
}

function DecisionActions({ row }: { row: CorporateApproval }) {
  if (!row.can_decide) return <RowIcon tone="edit" label="Aprobar" icon={<CircleCheck size={15} />} disabledHint={row.status === "pendiente" ? "Solo el aprobador de ese centro de costo o el administrador" : "La solicitud ya está cerrada"} />;
  return (
    <>
      <CorporateStep id={`aprobar-${row.code}`} label="Aprobar" title={`Aprobar ${row.code}`} description="La agencia podrá confirmar la reserva en cuanto apruebes." submitLabel="Aprobar compra" action={decideApproval} trigger={(open) => <RowIcon tone="edit" label="Aprobar" icon={<CircleCheck size={15} />} onClick={open} />}>
        <input type="hidden" name="code" value={row.code} />
        <input type="hidden" name="decision" value="approve" />
        <input type="hidden" name="lock_version" value={row.lock_version} />
        <Summary row={row} />
        <TextArea label="Nota para la agencia" name="note" rows={3} maxLength={500} placeholder="Opcional" />
      </CorporateStep>
      <CorporateStep id={`rechazar-${row.code}`} label="Rechazar" title={`Rechazar ${row.code}`} description="La agencia verá el motivo para ajustar la propuesta." submitLabel="Rechazar compra" action={decideApproval} trigger={(open) => <RowIcon tone="delete" label="Rechazar" icon={<CircleX size={15} />} onClick={open} />}>
        <input type="hidden" name="code" value={row.code} />
        <input type="hidden" name="decision" value="reject" />
        <input type="hidden" name="lock_version" value={row.lock_version} />
        <Summary row={row} />
        <TextArea label="Motivo" name="reason" rows={4} required minLength={5} maxLength={500} placeholder="Por ejemplo: fuera del presupuesto del trimestre" />
      </CorporateStep>
    </>
  );
}

export function CorporateApprovalsView({ approvals, meta }: { approvals: CorporateApproval[]; meta: CorporateApprovalsMeta }) {
  const columns: Column<CorporateApproval>[] = [
    {
      id: "trip",
      header: "Solicitud",
      mobile: "title",
      cell: (row) => (
        <span className="min-w-0">
          <b className="block font-semibold">{row.title}</b>
          <small className="block text-xs text-fg-3">
            <span className="font-mono">
              {row.code} · {row.reference}
            </span>
            {row.requested_by ? ` · pide ${row.requested_by}` : ""}
          </small>
        </span>
      ),
    },
    {
      id: "center",
      header: "Centro de costo",
      cell: (row) => (
        <span className="grid justify-items-start gap-0.5">
          <span className="font-mono text-[12.5px]">{row.cost_center?.code ?? "—"}</span>
          {row.budget && row.budget.state !== "en_rango" && row.budget.state !== "sin_presupuesto" && <Badge tone={budgetTone(row.budget.state)}>{budgetLabel(row.budget.state)}</Badge>}
        </span>
      ),
    },
    { id: "amount", header: "Importe", align: "right", cell: (row) => <span className="font-mono text-[13px] font-semibold">{formatMoney(row.amount, row.currency)}</span> },
    {
      id: "requested",
      header: "Solicitada",
      wideOnly: true,
      cell: (row) => (
        <span className="text-[12.5px]">
          {formatDateTime(row.requested_at)}
          {row.status === "pendiente" && <small className="block text-fg-3">Vence {formatDate(row.expires_at)}</small>}
        </span>
      ),
    },
    {
      id: "status",
      header: "Estado",
      cell: (row) => (
        <span className="grid justify-items-start gap-0.5" title={row.reason ?? undefined}>
          <Badge tone={STATUS_TONE[row.status]}>{row.status_label}</Badge>
          {row.reason && <small className="max-w-[220px] truncate text-[11.5px] text-fg-3">{row.reason}</small>}
          {row.approver && row.status !== "pendiente" && <small className="text-[11.5px] text-fg-3">{row.approver}</small>}
        </span>
      ),
    },
    {
      id: "actions",
      header: "",
      align: "right",
      mobile: "hidden",
      cell: (row) => <RowActions>{row.status === "pendiente" ? <DecisionActions row={row} /> : null}</RowActions>,
    },
  ];
  const metrics: MetricFilter<CorporateApproval>[] = [
    { id: "pendiente", label: "Pendientes", tone: "warn", icon: <Clock size={19} />, matches: (row) => row.status === "pendiente" },
    { id: "aprobada", label: "Aprobadas", tone: "ok", icon: <CircleCheck size={19} />, matches: (row) => row.status === "aprobada" },
    { id: "rechazada", label: "Rechazadas", tone: "bad", icon: <CircleX size={19} />, matches: (row) => row.status === "rechazada" },
    { id: "cerrada", label: "Vencidas o canceladas", tone: "mute", icon: <Timer size={19} />, matches: (row) => row.status === "vencida" || row.status === "cancelada" },
  ];
  const filters: FilterConfig<CorporateApproval>[] = [{ id: "center", label: "Centro de costo", options: [...new Set(approvals.map((row) => row.cost_center?.code ?? ""))].filter(Boolean).map((value) => ({ value, label: value })), value: (row) => row.cost_center?.code ?? "" }];
  const sorts: SortOption<CorporateApproval>[] = [
    { id: "requested", label: "Fecha de solicitud", type: "date", value: (row) => row.requested_at },
    { id: "amount", label: "Importe", type: "number", value: (row) => num(row.amount) },
  ];

  return (
    <div className="flex flex-col gap-4">
      <p className="flex items-start gap-2 rounded-tile bg-surface-2 px-3.5 py-3 text-[13px] text-fg-2">
        <ShieldAlert size={16} className="mt-0.5 flex-none text-fg-3" />
        {meta.require_approval && meta.threshold
          ? `Las compras desde ${formatMoney(meta.threshold, meta.currency)} necesitan la aprobación de la empresa antes de que la agencia confirme la reserva. Cada solicitud vence en ${meta.ttl_hours} horas.`
          : "La empresa no exige aprobación previa. Aquí verás las solicitudes que la agencia te envíe."}
      </p>
      <DataTable screen="portal-corporativo-aprobaciones" rows={approvals} columns={columns} getKey={(row) => row.code} entityLabel="solicitudes" searchText={(row) => `${row.code} ${row.reference} ${row.title} ${row.requested_by ?? ""}`} searchPlaceholder="Buscar solicitud o viaje" metrics={metrics} filters={filters} sorts={sorts} emptyTitle="Sin solicitudes de aprobación" />
    </div>
  );
}
