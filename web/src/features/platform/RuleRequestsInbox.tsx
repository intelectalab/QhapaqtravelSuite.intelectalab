"use client";

import { CheckCircle2, Hourglass, Inbox, Search, XCircle } from "lucide-react";
import Link from "next/link";
import { decideRuleRequest } from "@/app/plataforma/(consola)/planes/actions";
import { DataTable } from "@/components/table/DataTable";
import { RowActions } from "@/components/table/RowActions";
import type { Column, FilterConfig, MetricFilter, SortOption } from "@/components/table/types";
import { Badge } from "@/components/ui/Badge";
import { InfoTip } from "@/components/ui/InfoTip";
import { SelectField } from "@/components/ui/SelectField";
import { TextArea } from "@/components/ui/TextArea";
import { formatDateTime } from "@/lib/format";
import type { RuleRequestItem, RuleRequestStatus, RuleRequestsOverview } from "@/lib/platformBilling";
import { ConsoleAction } from "./ConsoleAction";

const TONE: Record<RuleRequestStatus, "info" | "sun" | "bad" | "ok"> = { enviado: "info", en_evaluacion: "sun", rechazado: "bad", publicado: "ok" };

const OPEN: RuleRequestStatus[] = ["enviado", "en_evaluacion"];

function Decisions({ item, rules }: { item: RuleRequestItem; rules: RuleRequestsOverview["standard_rules"] }) {
  if (!OPEN.includes(item.status)) return null;
  const base = { code: item.code, lock_version: String(item.lock_version) };
  return (
    <RowActions>
      {item.status === "enviado" && (
        <ConsoleAction id={`rule-request-evaluate-${item.code}`} label="En evaluación" icon={<Search size={15} />} rowTone="neutral" title={`Evaluar ${item.code}`} description={`${item.tenant.name} verá en la campana que su pedido para «${item.rule.name}» está en evaluación.`} submitLabel="Marcar en evaluación" action={decideRuleRequest} fields={{ ...base, decision: "evaluar" }} />
      )}
      <ConsoleAction id={`rule-request-publish-${item.code}`} label="Publicar" icon={<CheckCircle2 size={15} />} rowTone="edit" title={`Publicar ${item.code}`} description="Enlaza el pedido con la regla estándar que lo cubre. Debe estar programada en el motor y en el catálogo; su plan mínimo se ajusta en «Reglas de reserva por plan»." submitLabel="Publicar y avisar" action={decideRuleRequest} fields={{ ...base, decision: "publicar" }}>
        <SelectField label="Regla estándar" name="linked_rule" searchable options={rules.map((rule) => ({ value: rule.code, label: `${rule.code} · ${rule.name}` }))} placeholder="Elige la regla del catálogo" />
        <TextArea label="Nota para la agencia (opcional)" name="reason" rows={2} maxLength={600} />
      </ConsoleAction>
      <ConsoleAction id={`rule-request-reject-${item.code}`} label="Rechazar" icon={<XCircle size={15} />} rowTone="delete" title={`Rechazar ${item.code}`} description="La agencia recibe el motivo en la campana y puede volver a pedirlo con más detalle." submitLabel="Rechazar pedido" action={decideRuleRequest} fields={{ ...base, decision: "rechazar" }}>
        <TextArea label="Motivo" name="reason" rows={3} required minLength={5} maxLength={600} placeholder="Por ejemplo: ya lo cubre la regla de documentos nominativos (R-NOMINATIVE)." />
      </ConsoleAction>
    </RowActions>
  );
}

export function RuleRequestsInbox({ data }: { data: RuleRequestsOverview }) {
  const columns: Column<RuleRequestItem>[] = [
    {
      id: "rule",
      header: "Regla pedida",
      mobile: "title",
      cell: (item) => (
        <div className="min-w-0 max-w-[420px]">
          <p className="flex items-center gap-1.5 text-[13.5px] font-semibold">
            <span className="truncate">{item.rule.name}</span>
            <InfoTip label="Detalle del pedido">
              <span className="block font-semibold">Qué debe pasar</span>
              <span className="mb-1.5 block">{item.expected}</span>
              <span className="block font-semibold">Cuándo</span>
              <span className="mb-1.5 block">{item.trigger_when}</span>
              <span className="block font-semibold">Ejemplo</span>
              <span className="block">{item.example}</span>
            </InfoTip>
          </p>
          <p className="truncate text-[12px] text-fg-3">{item.expected}</p>
          <p className="font-mono text-[11.5px] text-fg-3">
            {item.code} · {item.rule.code}
          </p>
        </div>
      ),
    },
    {
      id: "tenant",
      header: "Agencia",
      cell: (item) => (
        <div className="min-w-0">
          <Link href={`/plataforma/agencias/${item.tenant.code}`} className="text-[13px] font-semibold hover:text-accent">
            {item.tenant.name}
          </Link>
          <p className="text-[11.5px] text-fg-3">{item.requested_by}</p>
        </div>
      ),
    },
    {
      id: "status",
      header: "Estado",
      cell: (item) => (
        <span title={item.reason ?? undefined} className="flex flex-col gap-0.5">
          <Badge tone={TONE[item.status]}>{item.status === "publicado" && item.linked_rule ? `Publicado · ${item.linked_rule}` : item.status_label}</Badge>
          {item.status === "rechazado" && item.reason && <span className="max-w-[220px] truncate text-[11.5px] text-fg-3">{item.reason}</span>}
        </span>
      ),
    },
    { id: "at", header: "Pedido", wideOnly: true, cell: (item) => <span className="font-mono text-[12px] text-fg-3">{formatDateTime(item.requested_at, false)}</span> },
    { id: "actions", header: "", align: "right", mobile: "detail", cell: (item) => <Decisions item={item} rules={data.standard_rules} /> },
  ];
  const metrics: MetricFilter<RuleRequestItem>[] = [
    { id: "nuevos", label: "Por revisar", tone: "info", icon: <Inbox size={19} />, matches: (item) => item.status === "enviado" },
    { id: "evaluacion", label: "En evaluación", tone: "sun", icon: <Hourglass size={19} />, matches: (item) => item.status === "en_evaluacion" },
    { id: "publicados", label: "Publicados", tone: "ok", icon: <CheckCircle2 size={19} />, matches: (item) => item.status === "publicado" },
    { id: "rechazados", label: "Rechazados", tone: "bad", icon: <XCircle size={19} />, matches: (item) => item.status === "rechazado" },
  ];
  const filters: FilterConfig<RuleRequestItem>[] = [
    { id: "tenant", label: "Agencia", options: [...new Map(data.items.map((item) => [item.tenant.code, item.tenant.name])).entries()].map(([value, label]) => ({ value, label })), value: (item) => item.tenant.code },
  ];
  const sorts: SortOption<RuleRequestItem>[] = [{ id: "at", label: "Fecha del pedido", type: "date", value: (item) => item.requested_at }];
  return <DataTable screen="plataforma-pedidos-de-reglas" rows={data.items} columns={columns} getKey={(item) => item.code} entityLabel="pedidos" searchText={(item) => `${item.code} ${item.rule.name} ${item.tenant.name} ${item.expected}`} searchPlaceholder="Buscar pedido, regla o agencia" metrics={metrics} filters={filters} sorts={sorts} emptyTitle="Aún no hay pedidos de reglas" />;
}
