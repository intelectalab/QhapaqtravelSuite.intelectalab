import { ArrowLeft, CalendarDays, Clock3, CreditCard, UsersRound } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { StatusBadge } from "@/components/ui/Badge";
import { DownloadButton } from "@/components/ui/DownloadButton";
import { cn } from "@/lib/cn";
import { capitalize, formatDate, formatMoney } from "@/lib/format";
import { requireAccount, siteBase } from "@/lib/server/site";
import { siteHref, type AccountReservationDetail } from "@/lib/site";

export const metadata: Metadata = { title: "Detalle de mi reserva", robots: { index: false, follow: false } };

const PAX: Record<string, string> = { ADT: "Adulto", CHD: "Niño", INF: "Infante" };

const METHOD: Record<string, string> = { tarjeta_e_commerce: "Tarjeta en línea", transferencia: "Transferencia", yape: "Yape", plin: "Plin", efectivo: "Efectivo", tarjeta: "Tarjeta" };

function Panel({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-card border border-line bg-surface p-5 shadow-card", className)}>
      <h3 className="text-[15px] font-semibold text-fg">{title}</h3>
      <div className="mt-3">{children}</div>
    </section>
  );
}

export default async function AccountReservationPage({ params }: PageProps<"/sitio/[agencia]/cuenta/reservas/[code]">) {
  const { agencia, code } = await params;
  const [reservation, base] = await Promise.all([requireAccount<AccountReservationDetail>(agencia, `/me/reservations/${encodeURIComponent(code)}`), siteBase(agencia)]);
  const open = reservation.receivables.filter((item) => item.can_pay);

  return (
    <>
      <Link href={siteHref(base, "/cuenta")} className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-fg-2 hover:text-fg">
        <ArrowLeft size={15} />
        Mis reservas
      </Link>
      <section className="rounded-card border border-line bg-surface p-5 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <span className="text-[12px] font-semibold text-fg-3">
              Reserva {reservation.code}
              {reservation.order ? ` · pedido ${reservation.order}` : ""}
            </span>
            <h2 className="text-[20px] font-bold tracking-tight text-fg">{reservation.title}</h2>
            <p className="mt-1 inline-flex items-center gap-1.5 text-[13.5px] text-fg-2">
              <CalendarDays size={14} className="text-fg-3" />
              {capitalize(formatDate(reservation.from, "long"))}
              {reservation.to && reservation.to !== reservation.from ? ` al ${formatDate(reservation.to)}` : ""}
            </p>
          </div>
          <div className="text-right">
            <StatusBadge status={reservation.status} />
            <b className="mt-2 block text-[18px] font-bold text-fg">{formatMoney(reservation.total, reservation.currency)}</b>
          </div>
        </div>
        {open.length > 0 && (
          <Link href={siteHref(base, "/cuenta/pagos")} className="mt-4 inline-flex h-11 items-center gap-2 rounded-control bg-brand px-5 text-[14px] font-semibold text-brand-fg transition hover:-translate-y-0.5 hover:brightness-110">
            <CreditCard size={16} />
            Pagar {open.map((item) => formatMoney(item.payable, item.currency)).join(" + ")}
          </Link>
        )}
      </section>

      <div className="grid gap-5 xl:grid-cols-2">
        <Panel title="Servicios">
          <ul className="grid gap-2.5">
            {reservation.services.map((service) => (
              <li key={`${service.name}-${service.date}`} className="flex items-start justify-between gap-3 rounded-xl border border-line px-3.5 py-3">
                <span className="min-w-0">
                  <b className="block text-[14px] font-semibold text-fg">{service.name}</b>
                  <span className="inline-flex items-center gap-1.5 text-[12.5px] text-fg-3">
                    <Clock3 size={13} />
                    {formatDate(service.date)}
                    {service.time ? ` · ${service.time}` : ""} · {service.pax} pax
                    {service.confirmation ? ` · confirmación ${service.confirmation}` : ""}
                  </span>
                </span>
                <StatusBadge status={service.status} />
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="Viajeros">
          <ul className="grid gap-2">
            {reservation.passengers.map((passenger, index) => (
              <li key={`${passenger.name}-${index}`} className="flex items-center justify-between gap-3 text-[13.5px]">
                <span className="inline-flex items-center gap-2 text-fg">
                  <UsersRound size={15} className="text-fg-3" />
                  {passenger.name}
                  {passenger.lead && <span className="text-[11.5px] font-semibold text-fg-3">Titular</span>}
                </span>
                <span className={cn("text-[12.5px]", passenger.pending ? "font-semibold text-warn" : "text-fg-3")}>{passenger.pending ? "Datos por completar" : (PAX[passenger.type] ?? passenger.type)}</span>
              </li>
            ))}
          </ul>
        </Panel>

        {reservation.receivables.length > 0 && (
          <Panel title="Cuotas">
            <ul className="grid gap-2">
              {reservation.receivables.map((item) => (
                <li key={item.code} className="flex items-center justify-between gap-3 text-[13.5px]">
                  <span className="min-w-0">
                    <b className="block truncate font-semibold text-fg">{item.concept}</b>
                    <span className="text-[12px] text-fg-3">Vence el {formatDate(item.due_date)}{Number(item.pending) > 0 ? ` · ${formatMoney(item.pending, item.currency)} por validar` : ""}</span>
                  </span>
                  <span className="text-right">
                    <b className="block text-fg">{formatMoney(item.amount, item.currency)}</b>
                    <StatusBadge status={item.status} />
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
        )}

        {reservation.payments.length > 0 && (
          <Panel title="Pagos">
            <ul className="grid gap-2">
              {reservation.payments.map((payment) => (
                <li key={payment.code} className="flex items-center justify-between gap-3 text-[13.5px]">
                  <span>
                    <b className="block font-semibold text-fg">{METHOD[payment.method] ?? capitalize(payment.method.replaceAll("_", " "))}</b>
                    <span className="text-[12px] text-fg-3">
                      {payment.code} · {formatDate(payment.date)}
                    </span>
                  </span>
                  <span className="text-right">
                    <b className="block text-fg">{formatMoney(payment.amount, payment.currency)}</b>
                    <StatusBadge status={payment.status} />
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
        )}

        {reservation.vouchers.length > 0 && (
          <Panel title="Vouchers" className="xl:col-span-2">
            <ul className="grid gap-2 sm:grid-cols-2">
              {reservation.vouchers.map((voucher) => (
                <li key={voucher.code} className="flex items-center justify-between gap-3 rounded-xl border border-line px-3.5 py-2.5">
                  <span className="min-w-0 text-[13.5px]">
                    <b className="block truncate font-semibold text-fg">{voucher.label}</b>
                    <span className="text-[12px] text-fg-3">
                      {voucher.code} · {formatDate(voucher.date)}
                    </span>
                  </span>
                  <DownloadButton href={siteHref(base, `/cuenta/vouchers/${voucher.code}`)} label="PDF" size="sm" />
                </li>
              ))}
            </ul>
          </Panel>
        )}
      </div>
    </>
  );
}
