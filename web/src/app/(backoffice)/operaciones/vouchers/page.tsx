import { CalendarClock, FileClock, ScanLine, TicketPlus } from "lucide-react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/PageHeader";
import { InfoTip } from "@/components/ui/InfoTip";
import { TintTile } from "@/components/ui/Tinted";
import { PendingVouchers, VouchersTable } from "@/features/operations/Vouchers";
import type { VoucherOverview } from "@/lib/operations";
import { getResource } from "@/lib/server/resource";

export const metadata: Metadata = { title: "Vouchers" };

export default async function VouchersPage() {
  const data = await getResource<VoucherOverview>("/ops/vouchers", "No pudimos cargar los vouchers.");

  if (!data) {
    return <PageHeader title="Vouchers" subtitle="Tu rol no tiene acceso a esta sección." />;
  }

  const month = data.today.slice(0, 7);
  const week = new Date(`${data.today}T00:00:00`);
  week.setDate(week.getDate() + 7);
  const weekLimit = week.toISOString().slice(0, 10);
  const today = data.items.filter((item) => item.status === "emitido" && item.service.date === data.today).length;
  const redeemed = data.items.filter((item) => item.status === "utilizado" && item.used_via === "extranet" && (item.used_at ?? "").slice(0, 7) === month).length;
  const issuedMonth = data.items.filter((item) => item.issued_at.slice(0, 7) === month).length;
  const pendingWeek = data.pending.filter((item) => item.date <= weekLimit).length;

  return (
    <>
      <PageHeader
        title="Vouchers"
        subtitle="Los comprobantes que el pasajero presenta a cada proveedor."
        info={<InfoTip>Solo los servicios confirmados por el proveedor emiten voucher, y cada servicio tiene uno vigente. Para corregirlo se emite una nueva versión con el mismo código.</InfoTip>}
      />
      <section className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <TintTile icon={CalendarClock} tone="t1" label="Se usan hoy" value={today} note="Vigentes con servicio hoy" info="Vouchers emitidos, aún sin usar, cuyo servicio es hoy." />
        <TintTile icon={FileClock} tone={pendingWeek ? "warn" : "ok"} label="Por emitir esta semana" value={pendingWeek} note="Servicios confirmados sin voucher" info="Servicios confirmados por el proveedor, sin voucher vigente, con fecha dentro de los próximos 7 días." />
        <TintTile icon={ScanLine} tone="ok" label="Validados en recepción" value={redeemed} note="Este mes, desde la extranet" info="Vouchers que el propio proveedor registró como utilizados al recibir al pasajero durante el mes en curso." />
        <TintTile icon={TicketPlus} tone="violet" label="Emitidos este mes" value={issuedMonth} note="Incluye nuevas versiones" info="Vouchers cuya última emisión o versión se hizo durante el mes en curso." />
      </section>
      <PendingVouchers data={data} />
      <VouchersTable data={data} />
    </>
  );
}
