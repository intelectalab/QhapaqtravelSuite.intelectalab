"use client";

import { BadgeCheck, CalendarClock, CheckCircle2, ScanLine, Ticket, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { redeemVoucher } from "@/app/(proveedor)/proveedor/actions";
import { DataTable } from "@/components/table/DataTable";
import { RowActions } from "@/components/table/RowActions";
import type { Column, FilterConfig, MetricFilter, SortOption } from "@/components/table/types";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { SwitchField } from "@/components/ui/SwitchField";
import { TextField } from "@/components/ui/TextField";
import { ConfirmAction, STEP_INITIAL } from "@/features/catalog-shared/CatalogPanels";
import { PortalTitle } from "@/features/portal/PortalUi";
import { cn } from "@/lib/cn";
import { formatDate, formatDateTime } from "@/lib/format";
import { dayDistance, supplierStatus, type SupplierVoucher, type SupplierVouchers } from "@/lib/supplier-portal";
import { SupplierBadge } from "./SupplierUi";

function RedeemCard({ data }: { data: SupplierVouchers }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [state, action, pending] = useActionState(redeemVoucher, STEP_INITIAL);
  const match = data.items.find((item) => item.code === code.trim().toUpperCase());
  const early = match !== undefined && match.status === "emitido" && match.days_to > 0 && match.days_to <= data.early_days;

  useEffect(() => {
    if (state.done) router.refresh();
  }, [state, router]);

  return (
    <Card className="flex flex-col gap-3">
      <span className="flex items-center gap-2 text-[14px] font-semibold">
        <ScanLine size={17} className="text-t1" /> Validar voucher en recepción
      </span>
      <form action={action} className="flex flex-col gap-2.5">
        <div className="flex items-end gap-2">
          <TextField label="Código del voucher" name="code" required minLength={4} maxLength={40} value={code} onChange={(event) => setCode(event.target.value)} placeholder="VOU-2026-01204" className="flex-1" autoComplete="off" />
          <Button type="submit" variant="primary" icon={<CheckCircle2 size={16} />} disabled={pending}>
            {pending ? "Validando…" : "Validar"}
          </Button>
        </div>
        {early && <SwitchField label="El huésped ya se presentó" hint={`El servicio es ${dayDistance(match.days_to).toLowerCase()}. Regístrelo solo si ya llegó.`} name="confirm_future" checked={confirmed} onCheckedChange={setConfirmed} />}      </form>
      {state.message && <p className="rounded-xl bg-[color-mix(in_srgb,var(--bad)_10%,transparent)] px-3 py-2 text-[12.5px] text-bad">{state.message}</p>}
      {state.done && <p className="rounded-xl bg-[color-mix(in_srgb,var(--ok)_10%,transparent)] px-3 py-2 text-[12.5px] text-ok">Voucher registrado como utilizado.</p>}
      <p className="text-[12px] text-fg-3">Solo se aceptan vouchers vigentes emitidos a tu establecimiento, el día del servicio o el anterior.</p>
    </Card>
  );
}

function RedeemRow({ row, earlyDays }: { row: SupplierVoucher; earlyDays: number }) {
  if (row.status !== "emitido" || row.days_to > earlyDays) return null;
  return (
    <ConfirmAction
      id={`usar-${row.code}`}
      label="Marcar utilizado"
      tone="edit"
      icon={<BadgeCheck size={15} />}
      title="Registrar uso del voucher"
      description={`${row.code} · ${row.service} · ${formatDate(row.date)} · ${row.pax} pax.${row.days_to > 0 ? " El servicio es mañana: regístrelo solo si el huésped ya se presentó." : ""}`}
      submitLabel="Marcar utilizado"
      action={redeemVoucher}
      hidden={{ code: row.code, confirm_future: row.days_to > 0 ? "1" : "0" }}
    />
  );
}

export function SupplierVouchersView({ data }: { data: SupplierVouchers }) {
  const columns: Column<SupplierVoucher>[] = [
    {
      id: "code",
      header: "Voucher",
      mobile: "title",
      cell: (row) => (
        <span className="block leading-tight">
          <b className="block font-mono text-[13px]">{row.code}</b>
          <span className="text-[12px] text-fg-3">
            v{row.version}
            {row.issued_at ? ` · emitido ${formatDateTime(row.issued_at, false)}` : ""}
          </span>
        </span>
      ),
    },
    {
      id: "service",
      header: "Servicio",
      cell: (row) => (
        <span className="block min-w-0 leading-tight">
          <b className="block max-w-[300px] truncate font-semibold">{row.service}</b>
          <span className="text-[12px] text-fg-3">
            {row.reservation} · {row.holder}
          </span>
        </span>
      ),
    },
    {
      id: "date",
      header: "Fecha",
      cell: (row) => (
        <span className="block leading-tight">
          <span className="block text-[13px]">{formatDate(row.date)}</span>
          {row.status === "emitido" && <span className={cn("text-[12px]", row.days_to === 0 ? "font-semibold text-t1" : "text-fg-3")}>{dayDistance(row.days_to)}</span>}
        </span>
      ),
    },
    { id: "pax", header: "Pax", align: "right", cell: (row) => <span className="tabular-nums">{row.pax}</span> },
    {
      id: "status",
      header: "Estado",
      cell: (row) => (
        <span className="flex flex-col items-start gap-0.5">
          <SupplierBadge status={row.status} scope="voucher" />
          {row.used_at && <span className="text-[11.5px] text-fg-3">{formatDateTime(row.used_at, false)}{row.used_via === "extranet" ? " · en recepción" : ""}</span>}
        </span>
      ),
    },
    {
      id: "actions",
      header: "",
      align: "right",
      cell: (row) => (
        <RowActions>
          <RedeemRow row={row} earlyDays={data.early_days} />
        </RowActions>
      ),
    },
  ];
  const metrics: MetricFilter<SupplierVoucher>[] = [
    { id: "today", label: "Para hoy", icon: <CalendarClock size={19} />, tone: "t1", display: data.kpis.today, note: "Vouchers vigentes con servicio hoy", info: <p>Vouchers emitidos a tu nombre, aún sin usar, cuya fecha de servicio es hoy.</p>, matches: (row) => row.status === "emitido" && row.days_to === 0 },
    { id: "issued", label: "Vigentes", icon: <Ticket size={19} />, tone: "info", info: <p>Vouchers emitidos a tu nombre que todavía no se usan.</p>, matches: (row) => row.status === "emitido" },
    { id: "month", label: "Utilizados este mes", icon: <BadgeCheck size={19} />, tone: "ok", display: data.kpis.used_month, note: "Prueba de prestación para tu pago", info: <p>Vouchers registrados como utilizados durante el mes en curso, por tu recepción o por la agencia.</p>, matches: (row) => row.status === "utilizado" && row.used_at !== null && row.used_at.slice(0, 7) === data.today.slice(0, 7) },
    { id: "used", label: "Utilizados", icon: <CheckCircle2 size={19} />, tone: "t3", info: <p>Todos los vouchers ya utilizados, de cualquier mes.</p>, matches: (row) => row.status === "utilizado" },
    { id: "void", label: "Anulados", icon: <XCircle size={19} />, tone: "bad", info: <p>Vouchers que la agencia anuló; ya no sirven para prestar el servicio.</p>, matches: (row) => row.status === "anulado" },
  ];
  const filters: FilterConfig<SupplierVoucher>[] = [{ id: "status", label: "Estado", options: [...new Set(data.items.map((row) => row.status))].map((value) => ({ value, label: supplierStatus(value, "voucher").label })), value: (row) => row.status }];
  const sorts: SortOption<SupplierVoucher>[] = [
    { id: "date", label: "Fecha del servicio", type: "date", value: (row) => row.date },
    { id: "issued", label: "Emisión", type: "date", value: (row) => row.issued_at },
  ];

  return (
    <>
      <PortalTitle title="Vouchers" subtitle="Vouchers emitidos por la agencia a nombre de tu establecimiento. Valida el código al recibir al huésped para registrarlo como utilizado." />
      <div className="mb-6">
        <RedeemCard data={data} />
      </div>
      <DataTable
        screen="proveedor-vouchers"
        rows={data.items}
        columns={columns}
        getKey={(row) => row.code}
        entityLabel="vouchers"
        metrics={metrics}
        filters={filters}
        sorts={sorts}
        searchText={(row) => `${row.code} ${row.reservation} ${row.service} ${row.holder}`}
        searchPlaceholder="Buscar voucher, reserva o titular"
        emptyTitle="La agencia aún no emitió vouchers a tu nombre"
      />
    </>
  );
}
