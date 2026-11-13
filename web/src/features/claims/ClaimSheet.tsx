"use client";

import { ArrowLeft, Check, Clock, FileText, Link2, ShieldCheck, StickyNote } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { TintCardTitle } from "@/components/ui/Tinted";
import { AuditTimeline, type AuditEntry } from "@/features/audit/AuditTimeline";
import { cn } from "@/lib/cn";
import { BOOK_FLOW, BOOK_STATUS_TONE, DEADLINE, type ClaimSheet as Sheet, type ClaimsOverview } from "@/lib/claims";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { ClaimCloseAction, ClaimDetailAction, ClaimLinkAction, ClaimNoteAction, ClaimResendAction } from "./ClaimForms";

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[130px_1fr] gap-2 border-t border-line-2 py-2 text-[13px] first:border-t-0">
      <span className="text-fg-3">{label}</span>
      <span className="min-w-0 break-words">{children}</span>
    </div>
  );
}

function Flow({ sheet }: { sheet: Sheet }) {
  const index = BOOK_FLOW.findIndex((step) => step.status === sheet.book_status);
  return (
    <ol className="flex items-center gap-2">
      {BOOK_FLOW.map((step, position) => {
        const done = position < index || sheet.book_status === "closed";
        const current = position === index && sheet.book_status !== "closed";
        return (
          <li key={step.status} className="flex flex-1 items-center gap-2">
            <span className={cn("grid h-7 w-7 flex-none place-items-center rounded-full border-2 text-[12px] font-bold transition-colors", done ? "border-ok bg-ok text-white" : current ? "border-accent text-accent" : "border-line text-fg-3")}>
              {done ? <Check size={14} /> : position + 1}
            </span>
            <span className={cn("text-[12.5px] font-semibold", current ? "text-fg" : "text-fg-3")}>{step.label}</span>
            {position < BOOK_FLOW.length - 1 && <span aria-hidden className={cn("h-0.5 flex-1 rounded-full", done ? "bg-ok" : "bg-line")} />}
          </li>
        );
      })}
    </ol>
  );
}

const card = "lift rounded-tile border border-line p-4";

export function ClaimSheetView({ sheet, overview, audit }: { sheet: Sheet; overview: ClaimsOverview; audit: AuditEntry[] | null }) {
  const deadline = DEADLINE[sheet.deadline];
  const manage = overview.can.manage;
  const owners = overview.options.owners ?? [];
  const evaluable = manage && sheet.book_status === "received";
  const respondable = manage && (sheet.book_status === "received" || sheet.book_status === "in_review");
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/crm/reclamaciones" className="inline-flex items-center gap-1.5 text-[13px] text-fg-3 hover:text-accent">
          <ArrowLeft size={14} /> Hojas de reclamación
        </Link>
        <span className="flex flex-wrap items-center gap-2">
          <Button href={`/crm/reclamaciones/${encodeURIComponent(sheet.code)}/constancia`} target="_blank" variant="secondary" size="sm" icon={<FileText size={15} />}>
            Constancia
          </Button>
          {evaluable && <ClaimDetailAction sheet={sheet} canManage owners={owners} />}
          {respondable && <ClaimDetailAction sheet={sheet} canManage owners={owners} respondNow />}
          {manage && sheet.book_status === "answered" && <ClaimResendAction sheet={sheet} />}
          {manage && sheet.book_status === "answered" && <ClaimCloseAction sheet={sheet} reasons={overview.options.close_reasons} />}
        </span>
      </div>
      <section className={card}>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <h2 className="text-[17px] font-bold tracking-tight">Hoja {sheet.book_number}</h2>
          <Badge tone={sheet.type_code === "reclamo" ? "warn" : "violet"} dot={false}>{sheet.type}</Badge>
          <Badge tone={BOOK_STATUS_TONE[sheet.book_status]}>{sheet.book_status_label}</Badge>
          <span className="text-[12.5px] text-fg-3">{sheet.sede} · {sheet.channel_label} · recibida {formatDateTime(sheet.received_at)}</span>
        </div>
        <Flow sheet={sheet} />
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-surface-2 px-3.5 py-2.5 text-[13px]">
          <span className="flex items-center gap-2">
            <Clock size={15} className="text-fg-3" />
            <Badge tone={deadline.tone}>{deadline.label}</Badge>
            {sheet.days_left !== null && !sheet.response && sheet.book_status !== "closed" && <b>{sheet.days_left >= 0 ? `Quedan ${sheet.days_left} días hábiles` : `${Math.abs(sheet.days_left)} días hábiles de atraso`}</b>}
          </span>
          {sheet.due_date && <span className="text-fg-3">Vencimiento legal: <b className="text-fg">{formatDate(sheet.due_date)}</b> ({overview.settings.response_days} días hábiles)</span>}
        </div>
      </section>
      <div className="grid gap-5 lg:grid-cols-2">
        <section className={card}>
          <TintCardTitle icon={FileText} title="Consumidor" />
          <Row label="Nombre">
            {sheet.consumer.name}
            {sheet.consumer.is_minor && <span className="ml-2 align-middle"><Badge tone="warn" dot={false}>Menor de edad</Badge></span>}
          </Row>
          <Row label="Documento">{[sheet.consumer.doc_type, sheet.consumer.doc_number].filter(Boolean).join(" ") || "—"}</Row>
          <Row label="Domicilio">{sheet.consumer.address ?? "—"}</Row>
          <Row label="Correo">{sheet.consumer.email ?? "—"}</Row>
          <Row label="Teléfono">{sheet.consumer.phone ?? "—"}</Row>
          {sheet.consumer.guardian && <Row label={sheet.consumer.guardian.relation ?? "Apoderado"}>{sheet.consumer.guardian.name} · {[sheet.consumer.guardian.doc_type, sheet.consumer.guardian.doc_number].filter(Boolean).join(" ")}</Row>}
        </section>
        <section className={card}>
          <div className="flex items-start justify-between gap-2">
            <TintCardTitle icon={Link2} title="Bien contratado y vínculos" tone="t3" />
            {manage && sheet.book_status !== "closed" && <ClaimLinkAction sheet={sheet} overview={overview} trigger={(open) => <Button type="button" size="sm" variant="ghost" icon={<Link2 size={14} />} onClick={open}>Vincular</Button>} />}
          </div>
          <Row label="Tipo">{sheet.good?.kind ?? "—"}</Row>
          <Row label="Descripción">{sheet.good?.description ?? "—"}</Row>
          <Row label="Monto reclamado">{sheet.good && sheet.good.amount > 0 ? formatMoney(sheet.good.amount, sheet.good.currency) : "—"}</Row>
          <Row label="Cliente">{sheet.client ? <Link href={`/crm/clientes/${sheet.client.code}`} className="text-accent hover:underline">{sheet.client.name}</Link> : "Sin vincular"}</Row>
          <Row label="Reserva">{sheet.reservation ? <Link href={`/reservas/${sheet.reservation}`} className="font-mono text-accent hover:underline">{sheet.reservation}</Link> : "Sin vincular"}</Row>
          <Row label="Responsable">{sheet.owner ?? "Sin asignar"}</Row>
        </section>
      </div>
      <section className={card}>
        <TintCardTitle icon={FileText} title={`Detalle del ${sheet.type.toLowerCase()}`} tone="sun" />
        <p className="whitespace-pre-line text-[13.5px] leading-relaxed">{sheet.detail}</p>
        {sheet.request && <p className="mt-3 text-[13px] text-fg-2"><b>Pedido del consumidor:</b> {sheet.request}</p>}
      </section>
      <section className={card}>
        <TintCardTitle icon={Check} title="Respuesta del proveedor" tone="ok" />
        {sheet.response ? (
          <>
            <Row label="Sentido"><b>{sheet.response.decision}</b></Row>
            <Row label="Respuesta"><span className="whitespace-pre-line">{sheet.response.text}</span></Row>
            <Row label="Acciones">{sheet.response.actions ?? "—"}</Row>
            <Row label="Envío">{sheet.response.sent_at ? `Correo a ${sheet.response.sent_to ?? ""} · ${formatDateTime(sheet.response.sent_at)}` : "No enviada"}</Row>
            {sheet.close_note && <Row label="Cierre">{sheet.close_note}{sheet.closed_at ? ` · ${formatDateTime(sheet.closed_at)}` : ""}</Row>}
          </>
        ) : (
          <p className="text-[13px] text-fg-3">Aún sin respuesta.</p>
        )}
      </section>
      <div className="grid gap-5 lg:grid-cols-2">
        <section className={card}>
          <div className="flex items-start justify-between gap-2">
            <TintCardTitle icon={Clock} title="Historial" tone="violet" />
            {manage && <ClaimNoteAction sheet={sheet} trigger={(open) => <Button type="button" size="sm" variant="ghost" icon={<StickyNote size={14} />} onClick={open}>Nota interna</Button>} />}
          </div>
          <ol className="flex flex-col gap-3 border-l-2 border-line pl-4">
            {[...sheet.log].reverse().map((entry) => (
              <li key={`${entry.at}-${entry.message}`} className="relative">
                <span aria-hidden className="absolute -left-[23px] top-1 h-3.5 w-3.5 rounded-full border-2 border-surface bg-violet" />
                <p className="text-[13px] font-semibold">{entry.message}</p>
                <p className="text-[11.5px] text-fg-3">{entry.by} · {formatDateTime(entry.at)}</p>
              </li>
            ))}
          </ol>
        </section>
        <section className={card}>
          <TintCardTitle icon={ShieldCheck} title="Auditoría" tone="t1" />
          {audit ? <AuditTimeline entries={audit} /> : <p className="text-[13px] text-fg-3">No pudimos cargar la auditoría.</p>}
        </section>
      </div>
    </div>
  );
}
