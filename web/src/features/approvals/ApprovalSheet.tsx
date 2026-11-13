"use client";

import { ArrowLeft, Eye, History } from "lucide-react";
import Link from "next/link";
import { RowActions } from "@/components/table/RowActions";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { EVENT_LABELS, SLA_META, TYPE_TONES, type ApprovalItem } from "@/lib/approvals";
import { formatDateTime, formatMoney } from "@/lib/format";
import { ApprovalDetailAction, ApprovalFlowActions, LevelTrack } from "./ApprovalForms";

export function ApprovalSheet({ item, cancelReasons }: { item: ApprovalItem; cancelReasons: string[] }) {
  const timeline = [
    { key: "created", title: "Solicitud creada", by: item.requester, at: item.created_at, note: null as string | null },
    ...item.events.map((event, index) => ({ key: `event-${index}`, title: EVENT_LABELS[event.event] ?? event.event, by: event.by, at: event.at, note: event.note })),
    ...(item.events.length === 0 && item.decided_at ? [{ key: "decided", title: `Decisión: ${item.status}`, by: item.decider ?? "Sistema", at: item.decided_at, note: item.decision_note }] : []),
  ];
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader
          title={item.title}
          subtitle={`${item.type_label} · ${item.code} · solicitó ${item.requester}`}
          action={
            <RowActions>
              <ApprovalDetailAction item={item} cancelReasons={cancelReasons} trigger={(open) => <Button type="button" size="sm" variant="primary" icon={<Eye size={15} />} onClick={open}>{item.can_decide ? "Revisar y decidir" : "Ver detalle"}</Button>} />
              <ApprovalFlowActions item={item} />
            </RowActions>
          }
        />
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={TYPE_TONES[item.type] ?? "mute"}>{item.type_label}</Badge>
          <StatusBadge status={item.status} />
          <Badge tone={SLA_META[item.sla].tone} dot={false}>{SLA_META[item.sla].label}{item.due_at && item.sla !== "done" ? ` · vence ${formatDateTime(item.due_at, false)}` : ""}</Badge>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="lift rounded-xl bg-surface-2 px-3.5 py-3">
            <p className="text-[11.5px] text-fg-3">Monto</p>
            <p className="font-mono text-[18px] font-bold">{formatMoney(item.amount, item.currency)}</p>
            {item.impact && <p className="mt-0.5 text-[12px] text-fg-3">{item.impact}</p>}
          </div>
          <div className="lift rounded-xl bg-surface-2 px-3.5 py-3 sm:col-span-2">
            <p className="mb-2 text-[11.5px] text-fg-3">Niveles</p>
            <LevelTrack item={item} />
          </div>
        </div>
        {item.effect && <p className="mt-3 text-[12.5px] text-fg-2">{item.effect}</p>}
      </Card>
      <Card>
        <CardHeader title={<span className="flex items-center gap-2"><History size={16} className="text-accent" /> Trazabilidad</span>} subtitle="Cada paso queda registrado con quién y cuándo." />
        {timeline.length === 0 ? (
          <EmptyState icon={<History size={20} />} title="Sin movimientos" description="Todavía no hay pasos registrados." />
        ) : (
          <ol className="flex flex-col gap-3 border-l-2 border-line pl-4">
            {timeline.map((entry) => (
              <li key={entry.key} className="relative">
                <span aria-hidden className="absolute -left-[23px] top-1 h-3.5 w-3.5 rounded-full border-2 border-surface bg-accent" />
                <p className="text-[13px] font-semibold">{entry.title}</p>
                {entry.note && <p className="text-[12.5px] text-fg-2">{entry.note}</p>}
                <p className="text-[11.5px] text-fg-3">{entry.by} · {formatDateTime(entry.at)}</p>
              </li>
            ))}
          </ol>
        )}
      </Card>
      <Link href="/aprobaciones" className="inline-flex items-center gap-1.5 text-[13px] text-fg-3 hover:text-accent">
        <ArrowLeft size={14} /> Volver a la bandeja
      </Link>
    </div>
  );
}
