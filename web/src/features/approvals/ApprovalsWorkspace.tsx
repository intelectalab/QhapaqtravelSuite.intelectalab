"use client";

import { AlarmClock, Hourglass, MessageSquareReply, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { DataTable } from "@/components/table/DataTable";
import { RowActions, RowIcon } from "@/components/table/RowActions";
import type { Column, FilterConfig, MetricFilter, SortOption } from "@/components/table/types";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { SectionPanel } from "@/components/ui/SectionPanel";
import { SLA_META, TYPE_TONES, type ApprovalItem, type ApprovalRule, type ApprovalsOverview } from "@/lib/approvals";
import { formatDateTime, formatMoney } from "@/lib/format";
import { statusLabel } from "@/lib/tone";
import { ApprovalDetailAction, ApprovalFlowActions, ApprovalFormAction, ApprovalWithdrawAction, RuleDeleteAction, RuleFormAction, RulesResetAction } from "./ApprovalForms";

const unique = (values: string[]) => [...new Set(values)];

function ApprovalTable({ rows, screen, overview }: { rows: ApprovalItem[]; screen: string; overview: ApprovalsOverview }) {
  const columns: Column<ApprovalItem>[] = [
    {
      id: "request",
      header: "Solicitud",
      mobile: "title",
      cell: (row) => (
        <div className="min-w-0">
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone={TYPE_TONES[row.type] ?? "mute"} dot={false}>
              {row.type_label}
            </Badge>
            {row.href ? (
              <Link href={row.href} className="font-mono text-[12px] text-fg-3 hover:text-accent hover:underline">
                {row.code}
              </Link>
            ) : (
              <span className="font-mono text-[12px] text-fg-3">{row.code}</span>
            )}
          </span>
          <span className="mt-1 block max-w-[440px] truncate text-[13.5px] font-semibold">{row.title}</span>
        </div>
      ),
    },
    {
      id: "requester",
      header: "Solicitó",
      cell: (row) => (
        <span className="text-[13px]">
          {row.requester}
          <span className="block text-[12px] text-fg-3">{formatDateTime(row.created_at, false)}</span>
        </span>
      ),
    },
    {
      id: "amount",
      header: "Monto",
      align: "right",
      cell: (row) => <span className="font-mono text-[13px] font-semibold">{formatMoney(row.amount, row.currency)}</span>,
    },
    {
      id: "sla",
      header: "Plazo",
      cell: (row) => (
        <span title={row.due_at ? `Vence ${formatDateTime(row.due_at)}` : undefined}>
          <Badge tone={SLA_META[row.sla].tone}>{SLA_META[row.sla].label}</Badge>
        </span>
      ),
    },
    {
      id: "status",
      header: "Estado",
      cell: (row) => (
        <span className="flex flex-col gap-1">
          <StatusBadge status={row.status} />
          {row.levels > 1 && <span className="text-[11.5px] text-fg-3">Nivel {row.level} de {row.levels}</span>}
          {row.delegated_to && <span className="text-[11.5px] text-fg-3">Delegada a {row.delegated_to.name}</span>}
        </span>
      ),
    },
    {
      id: "actions",
      header: "",
      align: "right",
      mobile: "hidden",
      cell: (row) => {
        const open = row.status === "pendiente" || row.status === "info";
        const generic = row.is_generic === true;
        return (
          <RowActions>
            <ApprovalDetailAction item={row} cancelReasons={overview.cancel_reasons} />
            <ApprovalFlowActions item={row} />
            {generic && row.can_edit ? <ApprovalFormAction item={row} overview={overview} /> : <RowIcon tone="edit" label="Editar" disabledHint={generic ? "Solo quien la pidió la edita mientras está pendiente" : "Se edita en el módulo de origen"} />}
            {row.can_withdraw ? <ApprovalWithdrawAction item={row} /> : <RowIcon tone="delete" label="Retirar" disabledHint={!open ? "Ya está resuelta" : row.mine ? "Se resuelve en su módulo de origen" : "Solo quien la pidió puede retirarla"} />}
          </RowActions>
        );
      },
    },
  ];

  const metrics: MetricFilter<ApprovalItem>[] = [
    { id: "overdue", label: "Vencidas", tone: "bad", icon: <AlarmClock size={19} />, matches: (row) => row.sla === "overdue" },
    { id: "warning", label: "Por vencer", tone: "warn", icon: <Hourglass size={19} />, matches: (row) => row.sla === "warning" },
    { id: "decide", label: "Puedo decidir", tone: "ok", icon: <ShieldCheck size={19} />, matches: (row) => row.can_decide },
    { id: "answer", label: "Consultas por responder", tone: "info", icon: <MessageSquareReply size={19} />, matches: (row) => row.can_answer },
  ];

  const filters: FilterConfig<ApprovalItem>[] = [
    { id: "type", label: "Tipo", options: unique(rows.map((row) => row.type)).map((value) => ({ value, label: rows.find((row) => row.type === value)?.type_label ?? value })), value: (row) => row.type },
    { id: "status", label: "Estado", options: unique(rows.map((row) => row.status)).map((value) => ({ value, label: statusLabel(value) })), value: (row) => row.status },
  ];

  const sorts: SortOption<ApprovalItem>[] = [
    { id: "due", label: "Plazo", type: "date", value: (row) => row.due_at },
    { id: "created", label: "Fecha de solicitud", type: "date", value: (row) => row.created_at },
    { id: "amount", label: "Monto en soles", type: "number", value: (row) => row.amount_pen },
  ];

  return (
    <DataTable
      screen={screen}
      rows={rows}
      columns={columns}
      getKey={(row) => row.key}
      entityLabel="solicitudes"
      searchText={(row) => `${row.code} ${row.title} ${row.requester} ${row.type_label}`}
      searchPlaceholder="Buscar solicitud, código o persona"
      metrics={metrics}
      filters={filters}
      sorts={sorts}
      emptyTitle="Nada pendiente aquí"
    />
  );
}

function RulesTable({ rules, canManage, types }: { rules: ApprovalRule[]; canManage: boolean; types: ApprovalsOverview["types"] }) {
  const columns: Column<ApprovalRule>[] = [
    {
      id: "type",
      header: "Tipo",
      mobile: "title",
      cell: (row) => (
        <span className="flex items-center gap-2">
          <Badge tone={TYPE_TONES[row.type] ?? "mute"} dot={false}>
            {row.type_label}
          </Badge>
          <span className="text-[12px] font-semibold text-fg-3">Nivel {row.level}</span>
        </span>
      ),
    },
    {
      id: "permission",
      header: "Aprueba",
      cell: (row) => (
        <span className="text-[13px]" title={row.approvers.join(", ") || "Nadie tiene este permiso"}>
          {row.permission_label}
          <span className="block max-w-[260px] truncate text-[12px] text-fg-3">{row.approvers.length > 0 ? row.approvers.join(", ") : "Sin aprobadores activos"}</span>
        </span>
      ),
    },
    { id: "min", header: "Desde", align: "right", cell: (row) => <span className="font-mono text-[13px]">{row.min_amount > 0 ? formatMoney(row.min_amount) : "Cualquier monto"}</span> },
    { id: "sla", header: "Plazo", align: "right", cell: (row) => <span className="font-mono text-[13px]">{row.sla_hours} h</span> },
    { id: "self", header: "Autoaprobación", cell: (row) => <Badge tone={row.forbid_self ? "ok" : "warn"} dot={false}>{row.forbid_self ? "Prohibida" : "Permitida"}</Badge> },
    { id: "status", header: "Estado", cell: (row) => <StatusBadge status={row.active ? "activa" : "inactiva"} /> },
    {
      id: "actions",
      header: "",
      align: "right",
      mobile: "hidden",
      cell: (row) => (
        <RowActions>
          {canManage ? <RuleFormAction rule={row} types={types} /> : <RowIcon tone="edit" label="Editar" disabledHint="Solo el administrador edita las reglas" />}
          {canManage ? <RuleDeleteAction rule={row} /> : <RowIcon tone="delete" label="Eliminar" disabledHint="Solo el administrador elimina reglas" />}
        </RowActions>
      ),
    },
  ];
  const filters: FilterConfig<ApprovalRule>[] = [
    { id: "level", label: "Nivel", options: [{ value: "1", label: "Nivel 1" }, { value: "2", label: "Nivel 2" }], value: (row) => String(row.level) },
  ];
  return (
    <DataTable
      screen="aprobaciones-reglas"
      rows={rules}
      columns={columns}
      getKey={(row) => row.code}
      entityLabel="reglas"
      searchText={(row) => `${row.type_label} ${row.permission_label} ${row.approvers.join(" ")}`}
      searchPlaceholder="Buscar tipo o aprobador"
      filters={filters}
      toolbarEnd={canManage ? (
        <span className="flex flex-wrap gap-2">
          <RulesResetAction />
          <RuleFormAction types={types} />
        </span>
      ) : undefined}
    />
  );
}

export function ApprovalsWorkspace({ overview, section }: { overview: ApprovalsOverview; section: string }) {
  const pending = overview.items.filter((item) => item.status === "pendiente" || item.status === "info");
  const forMe = pending.filter((item) => item.can_decide || item.can_answer);
  const mine = overview.items.filter((item) => item.mine);
  const history = overview.items.filter((item) => item.decided_at !== null || !["pendiente", "info"].includes(item.status));

  return (
    <Card padded={false} className="overflow-hidden">
      <SectionPanel
        active={section}
        tabs={[
          { id: "mine", label: "Para mí", count: forMe.length, content: <ApprovalTable rows={forMe} screen="aprobaciones-para-mi" overview={overview} /> },
          { id: "sent", label: "Enviadas por mí", count: mine.length, content: <ApprovalTable rows={mine} screen="aprobaciones-enviadas" overview={overview} /> },
          { id: "all", label: "Pendientes", count: pending.length, content: <ApprovalTable rows={pending} screen="aprobaciones-pendientes" overview={overview} /> },
          { id: "history", label: "Historial", count: history.length, content: <ApprovalTable rows={history} screen="aprobaciones-historial" overview={overview} /> },
          { id: "rules", label: "Reglas", count: overview.rules.length, content: <RulesTable rules={overview.rules} canManage={overview.can.manage_rules} types={overview.types} /> },
        ]}
      />
    </Card>
  );
}

export function NewApprovalAction({ overview }: { overview: ApprovalsOverview }) {
  return <ApprovalFormAction overview={overview} />;
}
