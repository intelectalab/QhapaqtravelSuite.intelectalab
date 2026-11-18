"use client";

import { AlarmClock, CircleCheckBig, CircleX, Hourglass, MessageSquareReply, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { DataTable } from "@/components/table/DataTable";
import { RowActions, RowIcon } from "@/components/table/RowActions";
import type { Column, FilterConfig, MetricFilter, SortOption } from "@/components/table/types";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { SectionPanel } from "@/components/ui/SectionPanel";
import { approvalHref, SLA_META, TYPE_TONES, type ApprovalItem, type ApprovalRule, type ApprovalSla, type ApprovalsOverview } from "@/lib/approvals";
import { cn } from "@/lib/cn";
import type { CsvExport } from "@/lib/csv";
import { formatDateTime, formatMoney } from "@/lib/format";
import { statusLabel } from "@/lib/tone";
import { ApprovalDetailAction, ApprovalFlowActions, ApprovalFormAction, ApprovalWithdrawAction, RuleDeleteAction, RuleFormAction, RulesResetAction } from "./ApprovalForms";

const unique = (values: string[]) => [...new Set(values)];

const SLA_FILTERS: ApprovalSla[] = ["ok", "warning", "overdue", "paused", "done"];

const HISTORY_CSV: CsvExport<ApprovalItem> = {
  fileName: "historial-aprobaciones",
  title: "Historial de aprobaciones",
  columns: [
    { header: "Código", value: (row) => row.code },
    { header: "Tipo", value: (row) => row.type_label },
    { header: "Solicitud", value: (row) => row.title },
    { header: "Solicitó", value: (row) => row.requester },
    { header: "Fecha de solicitud", value: (row) => row.created_at, type: "datetime" },
    { header: "Monto", value: (row) => row.amount, type: "money" },
    { header: "Moneda", value: (row) => row.currency },
    { header: "Monto en soles", value: (row) => row.amount_pen, type: "money", total: true },
    { header: "Estado", value: (row) => statusLabel(row.status) },
    { header: "Decidió", value: (row) => row.decider },
    { header: "Fecha de decisión", value: (row) => row.decided_at, type: "datetime" },
    { header: "Comentario", value: (row) => row.decision_note },
  ],
};

function RecentDecisions({ rows }: { rows: ApprovalItem[] }) {
  const recent = rows.filter((row) => row.decided_at !== null).sort((a, b) => (b.decided_at ?? "").localeCompare(a.decided_at ?? "")).slice(0, 5);
  if (recent.length === 0) return null;
  return (
    <section className="border-b border-line px-5 py-4">
      <p className="mb-2.5 flex items-center gap-2 text-[13px] font-semibold">
        <ShieldCheck size={15} className="text-accent" /> Últimas decisiones auditadas
      </p>
      <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        {recent.map((row) => (
          <li key={row.key}>
            <Link href={approvalHref(row)} className="lift block rounded-xl border border-line px-3 py-2.5 hover:border-accent/40">
              <span className="flex items-center justify-between gap-2">
                <StatusBadge status={row.status} />
                <span className="font-mono text-[11px] text-fg-3">{row.code}</span>
              </span>
              <span className="mt-1 block truncate text-[12.5px] font-semibold">{row.title}</span>
              <span className="block truncate text-[11.5px] text-fg-3">{row.decider ?? "Sistema"} · {formatDateTime(row.decided_at ?? row.created_at, false)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ApprovalTable({ rows, screen, overview, csv, decided = false }: { rows: ApprovalItem[]; screen: string; overview: ApprovalsOverview; csv?: CsvExport<ApprovalItem>; decided?: boolean }) {
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
          <Link href={approvalHref(row)} className="mt-1 line-clamp-2 text-[13.5px] font-semibold hover:text-accent">
            {row.title}
          </Link>
          <span className="block text-[12px] text-fg-3">
            {row.requester} · {formatDateTime(row.created_at, false)}
          </span>
        </div>
      ),
    },
    {
      id: "amount",
      header: "Monto",
      align: "right",
      cell: (row) => (
        <span className="flex flex-col items-end">
          <span className="font-mono text-[13px] font-semibold">{formatMoney(row.amount, row.currency)}</span>
          {row.impact && <span className="line-clamp-2 max-w-32 whitespace-normal text-[11.5px] text-fg-3" title={row.impact}>{row.impact}</span>}
        </span>
      ),
    },
    {
      id: "status",
      header: "Estado y plazo",
      cell: (row) => (
        <span className="flex flex-col items-start gap-1">
          <StatusBadge status={row.status} />
          <span title={row.due_at ? `Vence ${formatDateTime(row.due_at)}` : undefined}>
            <Badge tone={SLA_META[row.sla].tone}>{SLA_META[row.sla].label}</Badge>
          </span>
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

  const [weekAgo] = useState(() => Date.now() - 7 * 86_400_000);
  const decidedMetrics: MetricFilter<ApprovalItem>[] = [
    { id: "resolved", label: "Resueltas en 7 días", tone: "ok", icon: <CircleCheckBig size={19} />, note: overview.kpis.avg_hours !== null ? `${overview.kpis.avg_hours} h en promedio` : "Sin decisiones recientes", info: <p>Solicitudes aprobadas o rechazadas en los últimos 7 días; la nota es el tiempo promedio desde que se pidieron hasta que se decidieron.</p>, matches: (row) => row.decided_at !== null && ["aprobada", "rechazada"].includes(row.status) && new Date(row.decided_at).getTime() >= weekAgo },
    { id: "approved", label: "Aprobadas", tone: "ok", icon: <ShieldCheck size={19} />, matches: (row) => row.status === "aprobada" },
    { id: "rejected", label: "Rechazadas", tone: "bad", icon: <CircleX size={19} />, matches: (row) => row.status === "rechazada" },
  ];
  const openMetrics: MetricFilter<ApprovalItem>[] = [
    { id: "overdue", label: "Vencidas", tone: "bad", icon: <AlarmClock size={19} />, note: "Plazo de respuesta vencido", info: <p>Solicitudes pendientes cuyo plazo de respuesta (SLA de la regla de aprobación) ya venció.</p>, matches: (row) => row.sla === "overdue" },
    { id: "warning", label: "Por vencer", tone: "warn", icon: <Hourglass size={19} />, matches: (row) => row.sla === "warning" },
    { id: "decide", label: "Puedo decidir", tone: "ok", icon: <ShieldCheck size={19} />, matches: (row) => row.can_decide },
    { id: "answer", label: "Consultas por responder", tone: "info", icon: <MessageSquareReply size={19} />, matches: (row) => row.can_answer },
  ];

  const filters: FilterConfig<ApprovalItem>[] = [
    { id: "type", label: "Tipo", options: unique(rows.map((row) => row.type)).map((value) => ({ value, label: rows.find((row) => row.type === value)?.type_label ?? value })), value: (row) => row.type },
    { id: "status", label: "Estado", options: unique(rows.map((row) => row.status)).map((value) => ({ value, label: statusLabel(value) })), value: (row) => row.status },
    { id: "sla", label: "Plazo", options: SLA_FILTERS.filter((value) => rows.some((row) => row.sla === value)).map((value) => ({ value, label: SLA_META[value].label })), value: (row) => row.sla },
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
      metrics={decided ? decidedMetrics : openMetrics}
      filters={filters}
      sorts={sorts}
      csv={csv}
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
        <span className="flex flex-col items-start gap-1">
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
      wrap: true,
      cell: (row) => (
        <span className="text-[13px]" title={row.approvers.join(", ") || "Nadie tiene este permiso"}>
          {row.permission_label}
          <span className="line-clamp-2 block text-[12px] text-fg-3">{row.approvers.length > 0 ? row.approvers.join(", ") : "Sin aprobadores activos"}</span>
          <span className={cn("block text-[12px]", row.forbid_self ? "text-fg-3" : "font-semibold text-warn")}>{row.forbid_self ? "Sin autoaprobación" : "Autoaprobación permitida"}</span>
        </span>
      ),
    },
    {
      id: "min",
      header: "Desde y plazo",
      align: "right",
      cell: (row) => (
        <span className="text-[13px]">
          {row.min_amount > 0 ? <span className="block font-mono">{formatMoney(row.min_amount)}</span> : <span className="block">Cualquier monto</span>}
          <span className="block text-[12px] text-fg-3">{row.sla_hours} h para decidir</span>
        </span>
      ),
    },
    {
      id: "status",
      header: "Estado",
      cell: (row) => (
        <StatusBadge status={row.active ? "activa" : "inactiva"} />
      ),
    },
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
          {
            id: "history",
            label: "Historial",
            count: history.length,
            content: (
              <>
                <RecentDecisions rows={history} />
                <ApprovalTable rows={history} screen="aprobaciones-historial" overview={overview} csv={HISTORY_CSV} decided />
              </>
            ),
          },
          { id: "rules", label: "Reglas", count: overview.rules.length, content: <RulesTable rules={overview.rules} canManage={overview.can.manage_rules} types={overview.types} /> },
        ]}
      />
    </Card>
  );
}

export function NewApprovalAction({ overview }: { overview: ApprovalsOverview }) {
  return <ApprovalFormAction overview={overview} />;
}
