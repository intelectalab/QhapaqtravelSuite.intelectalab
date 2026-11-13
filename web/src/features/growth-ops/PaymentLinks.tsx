"use client";

import { Ban, CircleCheck, Clock3, Link2, Plus, Send, XCircle } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { DataTable } from "@/components/table/DataTable";
import { RowActions, RowIcon } from "@/components/table/RowActions";
import type { Column, FilterConfig, MetricFilter, SortOption } from "@/components/table/types";
import { Badge } from "@/components/ui/Badge";
import { ChipToggleGroup } from "@/components/ui/ChipToggleGroup";
import { SelectField } from "@/components/ui/SelectField";
import { TextArea } from "@/components/ui/TextArea";
import { TextField } from "@/components/ui/TextField";
import { SummaryBox } from "@/features/finance/FinanceStep";
import type { Option, PaymentLinkRow, PaymentTarget } from "@/lib/growth-ops";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import type { Tone } from "@/lib/tone";
import { GrowthStep, NoticeCard } from "./GrowthStep";

const TONES: Record<PaymentLinkRow["status"], Tone> = { activo: "info", pagado: "ok", vencido: "warn", anulado: "mute" };

const VIA: Record<string, string> = { email: "Correo", whatsapp: "WhatsApp", copia: "Enlace copiado" };

function linkSummary(row: PaymentLinkRow) {
  return [
    { label: "Cliente", value: row.client.name ?? "Sin cliente" },
    { label: "Cobra", value: row.receivable?.code ?? row.reservation?.code ?? "" },
    { label: "Monto", value: formatMoney(row.amount, row.currency), strong: true },
  ];
}

export function CreateLinkAction({ targets, methods }: { targets: PaymentTarget[]; methods: Option[] }) {
  const [target, setTarget] = useState<string>(targets[0]?.code ?? "");
  const current = targets.find((item) => item.code === target);
  return (
    <GrowthStep step="link_create" label="Nuevo link" icon={<Plus size={15} strokeWidth={2.4} />} variant="primary" title="Nuevo link de pago" description="El cliente paga desde su celular con el medio que elija. El pago se aplica solo a la cuota." submitLabel="Crear link">
      {targets.length === 0 ? (
        <p className="rounded-xl bg-surface-2 px-3.5 py-3 text-[13px] text-fg-2">No hay cuotas pendientes en tu cartera.</p>
      ) : (
        <>
          <SelectField label="Cuota por cobrar" name="receivable_id" searchable options={targets.map((item) => ({ value: item.code, label: `${item.label} · ${formatMoney(item.open, item.currency)}` }))} defaultValue={target} onChange={setTarget} />
          {current && <SummaryBox rows={[{ label: "Detalle", value: current.detail }, { label: "Vence", value: formatDate(current.due_date) }, { label: "Saldo", value: formatMoney(current.open, current.currency), strong: true }]} />}
          <TextField label={`Monto (${current?.currency ?? "PEN"})`} name="amount" type="number" step="0.01" min="0.01" max={current?.open} defaultValue={current?.open} key={current?.code} hint="Por defecto, el saldo completo de la cuota." />
          <ChipToggleGroup label="Medios de pago" name="methods" options={methods.map((item) => ({ value: item.key, label: item.label }))} defaultValue={["card", "yape", "plin"]} />
          <TextField label="Cuotas máximas con tarjeta" name="installments_max" type="number" min="1" max="24" defaultValue="1" hint="Solo aplica cuando el link incluye tarjeta." />
          <TextField label="Vence (opcional)" name="expires_at" type="datetime-local" hint="Si lo dejas vacío, el link vence en 72 horas." />
        </>
      )}
    </GrowthStep>
  );
}

function SendLinkAction({ row }: { row: PaymentLinkRow }) {
  const [via, setVia] = useState("whatsapp");
  return (
    <GrowthStep step="link_send" itemKey={row.code} label="Enviar" title={`Enviar ${row.code}`} description="El mensaje lleva el monto, el vencimiento y el enlace seguro." submitLabel="Enviar" trigger={(open) => <RowIcon tone="neutral" label="Enviar" icon={<Send size={15} />} onClick={open} />}>
      <SummaryBox rows={linkSummary(row)} />
      <SelectField label="Canal" name="via" options={[{ value: "whatsapp", label: "WhatsApp" }, { value: "email", label: "Correo" }, { value: "copia", label: "Solo copiar el enlace" }]} defaultValue={via} onChange={setVia} />
      {via !== "copia" && <TextField label={via === "email" ? "Correo de destino" : "WhatsApp de destino"} name="to" defaultValue={(via === "email" ? row.client.email : row.client.phone) ?? ""} hint="Por defecto, el dato del cliente." />}
    </GrowthStep>
  );
}

function CancelLinkAction({ row }: { row: PaymentLinkRow }) {
  return (
    <GrowthStep step="link_cancel" itemKey={row.code} label="Anular" title={`Anular ${row.code}`} description="El cliente ya no podrá pagar con este enlace." submitLabel="Anular link" trigger={(open) => <RowIcon tone="delete" label="Anular" icon={<Ban size={15} />} onClick={open} />}>
      <input type="hidden" name="lock_version" value={row.lock_version} />
      <SummaryBox rows={linkSummary(row)} />
      <TextArea label="Motivo (opcional)" name="reason" rows={3} maxLength={300} />
    </GrowthStep>
  );
}

function CopyLink({ url }: { url: string }) {
  const [shown, setShown] = useState(false);
  return (
    <>
      <RowIcon tone="neutral" label="Copiar enlace" icon={<Link2 size={15} />} onClick={() => {
        void navigator.clipboard.writeText(url);
        setShown(true);
      }} />
      {shown && <NoticeCard text={`Enlace copiado: ${url}`} onClose={() => setShown(false)} />}
    </>
  );
}

export function PaymentLinksTable({ rows }: { rows: PaymentLinkRow[] }) {
  const columns: Column<PaymentLinkRow>[] = [
    {
      id: "client",
      header: "Cliente",
      mobile: "title",
      cell: (row) => (
        <div className="min-w-0">
          <span className="font-semibold">{row.client.name ?? "Sin cliente"}</span>
          <small className="block text-xs text-fg-3">{row.code} · {row.created_by ?? "Sistema"}</small>
        </div>
      ),
    },
    {
      id: "target",
      header: "Cobra",
      cell: (row) => (
        <span className="text-[13px]">
          {row.reservation ? <Link href={`/reservas/${row.reservation.code}`} className="hover:underline">{row.receivable?.code ?? row.reservation.code}</Link> : row.receivable?.code}
          <span className="block max-w-[220px] truncate text-xs text-fg-3">{row.receivable?.concept ?? row.reservation?.title}</span>
        </span>
      ),
    },
    { id: "methods", header: "Medios", wideOnly: true, cell: (row) => <span className="block max-w-[200px] truncate text-[12.5px] text-fg-2" title={row.method_labels.join(", ")}>{row.method_labels.join(" · ")}{row.installments_max > 1 ? ` · hasta ${row.installments_max} cuotas` : ""}</span> },
    { id: "amount", header: "Monto", align: "right", cell: (row) => <span className="font-mono text-[13px] font-semibold">{formatMoney(row.amount, row.currency)}</span> },
    {
      id: "status",
      header: "Estado",
      cell: (row) => (
        <span className="grid justify-items-start gap-0.5">
          <Badge tone={TONES[row.status]}>{row.status_label}</Badge>
          <span className="text-[11.5px] text-fg-3">
            {row.status === "pagado" && row.paid_at ? `${formatDateTime(row.paid_at)} · ${row.payment ?? ""}` : row.status === "activo" ? `Vence ${formatDateTime(row.expires_at)}` : formatDate(row.expires_at)}
            {row.sent_via && row.status === "activo" ? ` · ${VIA[row.sent_via] ?? row.sent_via}` : ""}
          </span>
        </span>
      ),
    },
    {
      id: "actions",
      header: "",
      mobile: "hidden",
      align: "right",
      cell: (row) => (
        <RowActions>
          {row.status === "activo" && row.url && <CopyLink url={row.url} />}
          {row.status === "activo" ? <SendLinkAction row={row} /> : <RowIcon tone="neutral" label="Enviar" icon={<Send size={15} />} disabledHint="Solo se envían links activos" />}
          {row.status === "activo" ? <CancelLinkAction row={row} /> : <RowIcon tone="delete" label="Anular" icon={<Ban size={15} />} disabledHint={`El link está ${row.status_label.toLowerCase()}`} />}
        </RowActions>
      ),
    },
  ];

  const metrics: MetricFilter<PaymentLinkRow>[] = [
    { id: "active", label: "Activos", tone: "info", icon: <Clock3 size={19} />, matches: (row) => row.status === "activo" },
    { id: "paid", label: "Pagados", tone: "ok", icon: <CircleCheck size={19} />, matches: (row) => row.status === "pagado" },
    { id: "expired", label: "Vencidos", tone: "warn", icon: <XCircle size={19} />, matches: (row) => row.status === "vencido" },
  ];

  const statuses = [...new Set(rows.map((row) => row.status))];
  const filters: FilterConfig<PaymentLinkRow>[] = [
    { id: "status", label: "Estado", options: statuses.map((value) => ({ value, label: rows.find((row) => row.status === value)?.status_label ?? value })), value: (row) => row.status },
    { id: "method", label: "Medio", options: [...new Set(rows.flatMap((row) => row.method_labels))].map((value) => ({ value, label: value })), value: (row) => row.method_labels },
  ];

  const sorts: SortOption<PaymentLinkRow>[] = [
    { id: "created", label: "Fecha de creación", type: "date", value: (row) => row.created_at },
    { id: "expires", label: "Vencimiento", type: "date", value: (row) => row.expires_at },
    { id: "amount", label: "Monto", type: "number", value: (row) => Number(row.amount) },
  ];

  return (
    <DataTable
      screen="finanzas-links-de-pago"
      rows={rows}
      columns={columns}
      getKey={(row) => row.code}
      entityLabel="links de pago"
      searchText={(row) => `${row.code} ${row.client.name ?? ""} ${row.receivable?.code ?? ""} ${row.reservation?.code ?? ""}`}
      searchPlaceholder="Buscar cliente, cuota o link"
      metrics={metrics}
      filters={filters}
      sorts={sorts}
      emptyTitle="Aún no hay links de pago"
    />
  );
}
