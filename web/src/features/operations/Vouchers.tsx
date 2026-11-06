"use client";

import { Ban, CheckCheck, CircleCheck, CopyPlus, FileClock, Ticket, TicketCheck, TicketX } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { DataTable } from "@/components/table/DataTable";
import { RowActions, RowIcon } from "@/components/table/RowActions";
import type { Column, FilterConfig, MetricFilter, SortOption } from "@/components/table/types";
import { StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { SelectField } from "@/components/ui/SelectField";
import { SidePanel } from "@/components/ui/SidePanel";
import { TextArea } from "@/components/ui/TextArea";
import { SOFT_TINT, TintCardTitle } from "@/components/ui/Tinted";
import { FieldList } from "@/components/ui/Details";
import { cn } from "@/lib/cn";
import { formatDate, formatDateTime } from "@/lib/format";
import type { PendingVoucher, Voucher, VoucherOverview } from "@/lib/operations";
import { SERVICE_KIND } from "@/lib/reservations";
import { statusLabel } from "@/lib/tone";
import { TimeSlot } from "./OpsBits";
import { ConfirmNote, OpsStep } from "./OpsStep";

const unique = (values: string[]) => [...new Set(values)].sort((a, b) => a.localeCompare(b, "es"));

const VIA: Record<string, string> = { web: "la web", extranet: "la extranet del proveedor", app_operador: "la app del operador" };

function IssueAction({ service, providers }: { service: PendingVoucher; providers: VoucherOverview["providers"] }) {
  return (
    <OpsStep step="voucher_issue" formKey={service.code} label="Emitir" icon={<Ticket size={15} />} size="sm" title="Emitir voucher" description={`${service.name} · ${service.reservation.code}`} submitLabel="Emitir y publicar" trigger={(open) => <Button size="sm" variant="secondary" icon={<Ticket size={15} />} onClick={open}>Emitir</Button>}>
      <input type="hidden" name="service_code" value={service.code} />
      {service.provider ? <ConfirmNote>Proveedor: <b>{service.provider.name}</b></ConfirmNote> : <SelectField label="Proveedor" name="provider_id" options={providers} placeholder="Elegir proveedor" hint="El servicio no tiene proveedor registrado en la reserva." />}
      {!service.confirmation && <ConfirmNote tone="warn">El servicio no tiene código de confirmación del proveedor. Puedes emitir igual y registrarlo después.</ConfirmNote>}
      {service.status === "completado" && <ConfirmNote tone="warn">El servicio ya se ejecutó: el voucher quedará como respaldo.</ConfirmNote>}
      <TextArea label="Nota para el pasajero (opcional)" name="note" rows={3} maxLength={500} placeholder="Presentarse 15 minutos antes en el lobby del hotel." />
    </OpsStep>
  );
}

function VoucherPanel({ voucher }: { voucher: Voucher }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <RowIcon tone="view" label="Ver voucher" onClick={() => setOpen(true)} />
      <SidePanel open={open} onOpenChange={setOpen} title={voucher.code} description={`${voucher.service.label} · versión ${voucher.version}`}>
        <div className="mb-4">
          <StatusBadge status={voucher.status} />
        </div>
        <FieldList
          fields={[
            { label: "Reserva", value: <Link href={`/reservas/${voucher.reservation.code}`} className="text-accent hover:underline">{voucher.reservation.code}</Link> },
            { label: "Servicio", value: `${formatDate(voucher.service.date)}${voucher.service.time ? ` · ${voucher.service.time}` : ""}` },
            { label: "Proveedor", value: voucher.provider },
            { label: "Confirmación", value: voucher.service.confirmation ?? "Sin código" },
            { label: "Pasajeros", value: voucher.pax },
            { label: "Emitido", value: `${formatDateTime(voucher.issued_at)}${voucher.issued_by ? ` · ${voucher.issued_by}` : ""}` },
          ]}
        />
        {voucher.note && <p className={cn("mt-3 rounded-xl px-3.5 py-3 text-[13px]", SOFT_TINT)}>{voucher.note}</p>}
        {voucher.used_at && <ConfirmNote>Utilizado el {formatDateTime(voucher.used_at)}{voucher.used_via ? ` desde ${VIA[voucher.used_via] ?? voucher.used_via}` : ""}.</ConfirmNote>}
        {voucher.void_reason && <ConfirmNote tone="bad">Anulado{voucher.void_at ? ` el ${formatDateTime(voucher.void_at)}` : ""}: {voucher.void_reason}</ConfirmNote>}
        <h4 className="mb-2 mt-5 text-[13.5px] font-semibold">Versiones</h4>
        <ol className="flex flex-col gap-2 border-l-2 border-line pl-4">
          {voucher.versions.map((version) => (
            <li key={version.version} className="relative text-[13px]">
              <span className="absolute -left-[22px] top-1 h-2.5 w-2.5 rounded-full bg-accent ring-4 ring-surface" />
              <b className="font-semibold">Versión {version.version}</b> · {version.reason}
              <span className="block text-xs text-fg-3">{formatDateTime(version.issued_at)}{version.issued_by ? ` · ${version.issued_by}` : ""}</span>
            </li>
          ))}
        </ol>
      </SidePanel>
    </>
  );
}

function VoucherRowActions({ voucher, canIssue }: { voucher: Voucher; canIssue: boolean }) {
  const active = voucher.status === "emitido";
  const hint = "Solo se gestionan vouchers vigentes";
  return (
    <RowActions>
      <VoucherPanel voucher={voucher} />
      {canIssue && (active ? (
        <OpsStep step="voucher_version" target={voucher.code} formKey={`${voucher.code}-version`} label="Nueva versión" title="Nueva versión" description={`${voucher.code} · versión ${voucher.version + 1}`} submitLabel="Emitir versión" trigger={(open) => <RowIcon tone="edit" label="Nueva versión" icon={<CopyPlus size={15} />} onClick={open} />}>
          <ConfirmNote>Se conserva el código del voucher y se reemplaza la versión vigente con los datos actuales del servicio.</ConfirmNote>
          <TextArea label="Qué cambia" name="reason" rows={3} required minLength={5} maxLength={500} placeholder="Cambio de hora de recojo a las 04:00" />
        </OpsStep>
      ) : <RowIcon tone="edit" label="Nueva versión" icon={<CopyPlus size={15} />} disabledHint={hint} />)}
      {canIssue && (active ? (
        <OpsStep step="voucher_redeem" target={voucher.code} formKey={`${voucher.code}-redeem`} label="Marcar utilizado" title="Marcar como utilizado" description={`${voucher.code} · ${voucher.service.label}`} submitLabel="Marcar utilizado" trigger={(open) => <RowIcon tone="neutral" label="Marcar utilizado" icon={<CheckCheck size={15} />} onClick={open} />}>
          <ConfirmNote>Úsalo cuando el proveedor confirma que prestó el servicio y el voucher no se validó por la extranet.</ConfirmNote>
        </OpsStep>
      ) : <RowIcon tone="neutral" label="Marcar utilizado" icon={<CheckCheck size={15} />} disabledHint={hint} />)}
      {canIssue && (active ? (
        <OpsStep step="voucher_void" target={voucher.code} formKey={`${voucher.code}-void`} label="Anular" title="Anular voucher" description={`${voucher.code} · ${voucher.service.label}`} submitLabel="Anular voucher" trigger={(open) => <RowIcon tone="delete" label="Anular" icon={<Ban size={15} />} onClick={open} />}>
          <ConfirmNote tone="warn">El voucher queda en el historial como anulado, deja de verse en la app del pasajero y se avisa al proveedor.</ConfirmNote>
          <TextArea label="Motivo" name="reason" rows={3} required minLength={5} maxLength={500} placeholder="Servicio reprogramado por el cliente" />
        </OpsStep>
      ) : <RowIcon tone="delete" label="Anular" icon={<Ban size={15} />} disabledHint={hint} />)}
    </RowActions>
  );
}

export function PendingVouchers({ data }: { data: VoucherOverview }) {
  if (data.pending.length === 0) return null;
  return (
    <Card className="mb-5">
      <TintCardTitle icon={FileClock} tone="warn" title="Servicios confirmados sin voucher" aside={String(data.pending.length)} />
      <ul className="scroll-thin flex max-h-[360px] flex-col gap-1.5 overflow-y-auto pr-1">
        {data.pending.map((service, index) => {
          const kind = SERVICE_KIND[service.kind] ?? SERVICE_KIND.tour;
          const Icon = kind.icon;
          return (
            <li key={service.code} style={{ animationDelay: `${Math.min(index, 10) * 40}ms` }} className="flex animate-[rise-in_420ms_cubic-bezier(0.22,1,0.36,1)_backwards] items-center gap-3 rounded-[12px] px-2.5 py-2 transition-colors hover:bg-surface-2">
              <span className="grid h-8 w-8 flex-none place-items-center rounded-[9px] bg-surface-2 text-accent">
                <Icon size={16} />
              </span>
              <span className="min-w-0 flex-1">
                <b className="block truncate text-[13.5px] font-semibold">{service.name}</b>
                <span className="text-xs text-fg-3">
                  {formatDate(service.date)} · <TimeSlot time={service.time} className="min-w-0 text-xs" /> · {service.reservation.code}
                </span>
              </span>
              <StatusBadge status={service.status} />
              {data.can.issue && <IssueAction service={service} providers={data.providers} />}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

export function VouchersTable({ data }: { data: VoucherOverview }) {
  const columns: Column<Voucher>[] = [
    {
      id: "voucher",
      header: "Voucher",
      mobile: "title",
      cell: (row) => (
        <span className="block min-w-0">
          <b className="block truncate text-[13.5px] font-semibold">{row.service.label}</b>
          <span className="text-xs text-fg-3">
            {row.code} · v{row.version} · <Link href={`/reservas/${row.reservation.code}`} className="hover:text-accent hover:underline">{row.reservation.code}</Link>
          </span>
        </span>
      ),
    },
    { id: "date", header: "Servicio", cell: (row) => <span className="text-[13px]">{formatDate(row.service.date)}<span className="block text-xs text-fg-3">{row.pax === 1 ? "1 pasajero" : `${row.pax} pasajeros`}</span></span> },
    { id: "provider", header: "Proveedor", cell: (row) => <span className="block max-w-[220px] truncate text-[13px]">{row.provider}</span> },
    { id: "issued", header: "Emitido", wideOnly: true, cell: (row) => <span className="text-[12.5px] text-fg-2">{formatDateTime(row.issued_at, false)}<span className="block text-xs text-fg-3">{row.issued_by}</span></span> },
    { id: "status", header: "Estado", cell: (row) => <StatusBadge status={row.status} /> },
    { id: "actions", header: "", mobile: "hidden", align: "right", cell: (row) => <VoucherRowActions voucher={row} canIssue={data.can.issue} /> },
  ];

  const metrics: MetricFilter<Voucher>[] = [
    { id: "issued", label: "Vigentes", tone: "ok", icon: <TicketCheck size={19} />, matches: (row) => row.status === "emitido" },
    { id: "used", label: "Utilizados", tone: "violet", icon: <CircleCheck size={19} />, matches: (row) => row.status === "utilizado" },
    { id: "void", label: "Anulados", tone: "bad", icon: <TicketX size={19} />, matches: (row) => row.status === "anulado" },
    { id: "upcoming", label: "Servicio próximo", tone: "t4", icon: <Ticket size={19} />, matches: (row) => row.status === "emitido" && row.service.date >= data.today },
  ];

  const filters: FilterConfig<Voucher>[] = [
    { id: "status", label: "Estado", options: unique(data.items.map((row) => row.status)).map((value) => ({ value, label: statusLabel(value) })), value: (row) => row.status },
    { id: "provider", label: "Proveedor", options: unique(data.items.map((row) => row.provider)).map((value) => ({ value, label: value })), value: (row) => row.provider },
  ];

  const sorts: SortOption<Voucher>[] = [
    { id: "date", label: "Fecha del servicio", type: "date", value: (row) => row.service.date },
    { id: "issued", label: "Emisión", type: "date", value: (row) => row.issued_at },
  ];

  return <DataTable screen="operaciones-vouchers" rows={data.items} columns={columns} getKey={(row) => row.code} entityLabel="vouchers" searchText={(row) => `${row.code} ${row.service.label} ${row.reservation.code} ${row.provider}`} searchPlaceholder="Buscar voucher, servicio o proveedor" metrics={metrics} filters={filters} sorts={sorts} />;
}
