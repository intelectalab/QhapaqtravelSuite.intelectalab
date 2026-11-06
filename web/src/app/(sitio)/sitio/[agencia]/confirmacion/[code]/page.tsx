import { CalendarDays, CheckCircle2, CircleDashed, Clock3, Receipt } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { StatusBadge } from "@/components/ui/Badge";
import { HoldTimer } from "@/features/site/Cart";
import { PageHero } from "@/features/site/Hero";
import { PayButton } from "@/features/site/PayButton";
import { cn } from "@/lib/cn";
import { capitalize, formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { getSiteOrder, siteBase } from "@/lib/server/site";
import { siteHref } from "@/lib/site";

export const metadata: Metadata = { title: "Confirmación de tu pedido", robots: { index: false, follow: false } };

export default async function ConfirmationPage({ params }: PageProps<"/sitio/[agencia]/confirmacion/[code]">) {
  const { agencia, code } = await params;
  const [order, base] = await Promise.all([getSiteOrder(agencia, code), siteBase(agencia)]);
  const paid = order.status === "confirmado";
  const steps = [
    { label: "Pedido creado", done: true },
    { label: "Pago registrado", done: paid },
    { label: "Servicios confirmados por operaciones", done: paid && order.reservations.every((r) => r.status === "confirmada") },
    { label: "Vouchers enviados a tu correo", done: false },
  ];

  return (
    <>
      <PageHero
        eyebrow={`Pedido ${order.code}`}
        title={paid ? "¡Tu reserva está registrada!" : "Tu pedido está listo para el pago"}
        description={
          paid
            ? `Enviamos el detalle a ${order.customer.email}. Guarda tus códigos de reserva.`
            : "Creamos tu reserva con los cupos bloqueados. Completa el pago para confirmarla."
        }
      />
      <div className="mx-auto grid max-w-[1240px] gap-6 px-5 pt-10 sm:px-8 lg:grid-cols-[1fr_340px]">
        <div className="grid gap-5">
          {!paid && order.status === "pago_pendiente" && (
            <section className="rounded-card border border-[color-mix(in_srgb,var(--warn)_35%,transparent)] bg-[color-mix(in_srgb,var(--warn)_8%,var(--surface))] p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-[16px] font-semibold text-fg">Pago simulado</h2>
                {order.hold_expires_at && <HoldTimer until={order.hold_expires_at} />}
              </div>
              <p className="mt-1.5 text-[13.5px] leading-relaxed text-fg-2">Demostración sin pasarela real: no se solicita ni se cobra a ninguna tarjeta. Al simular el pago se registra el cobro, se consumen los cupos y la reserva pasa a confirmación.</p>
              <div className="mt-4">
                <PayButton code={order.code} label={`Simular pago de ${formatMoney(order.total, order.currency)}`} />
              </div>
            </section>
          )}

          {order.reservations.map((reservation, index) => (
            <article key={reservation.code} className="rounded-card border border-line bg-surface p-5 shadow-card animate-[rise-in_420ms_cubic-bezier(0.22,1,0.36,1)_backwards]" style={{ animationDelay: `${index * 60}ms` }}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <span className="text-[12px] font-semibold text-fg-3">Reserva {reservation.code}</span>
                  <h2 className="text-[17px] font-bold tracking-tight text-fg">{reservation.title}</h2>
                  <p className="mt-0.5 inline-flex items-center gap-1.5 text-[13px] text-fg-2">
                    <CalendarDays size={14} className="text-fg-3" />
                    {capitalize(formatDate(reservation.date, "long"))}
                  </p>
                </div>
                <StatusBadge status={reservation.status} />
              </div>
              <ul className="mt-4 grid gap-2">
                {reservation.services.map((service) => (
                  <li key={`${service.name}-${service.date}`} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-surface-2 px-3.5 py-2.5 text-[13px]">
                    <span>
                      {service.name}
                      <span className="text-fg-3">
                        {" "}
                        · {service.pax} {service.pax === 1 ? "cupo" : "cupos"}
                        {service.time && ` · ${service.time} h`}
                      </span>
                    </span>
                    <span className="text-[12px] font-semibold text-fg-2">{service.confirmation ? `Confirmado · ${service.confirmation}` : "Por confirmar con el operador"}</span>
                  </li>
                ))}
              </ul>
              <ul className="mt-3 grid gap-1.5">
                {reservation.receivables.map((receivable) => (
                  <li key={receivable.code} className="flex flex-wrap items-center justify-between gap-2 text-[13px] text-fg-2">
                    <span className="inline-flex items-center gap-1.5">
                      <Receipt size={14} className="text-fg-3" />
                      {receivable.code} · vence {formatDate(receivable.due_date)}
                    </span>
                    <span className="tabular-nums">
                      {formatMoney(receivable.paid, receivable.currency)} de {formatMoney(receivable.amount, receivable.currency)}
                    </span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>

        <aside className="grid gap-4 lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-card border border-line bg-surface p-5 shadow-card">
            <h2 className="text-[15px] font-semibold text-fg">Qué pasa ahora</h2>
            <ol className="mt-4 grid gap-3">
              {steps.map((step) => (
                <li key={step.label} className={cn("flex items-center gap-2.5 text-[13.5px]", step.done ? "text-fg" : "text-fg-3")}>
                  {step.done ? <CheckCircle2 size={17} className="text-ok" /> : <CircleDashed size={17} />}
                  {step.label}
                </li>
              ))}
            </ol>
          </div>
          <div className="rounded-card border border-line bg-surface p-5 text-[13px] shadow-card">
            <div className="flex justify-between text-fg-2">
              <span>Total del pedido</span>
              <b className="text-[18px] tabular-nums text-fg">{formatMoney(order.total, order.currency)}</b>
            </div>
            {order.discount > 0 && <p className="mt-1 text-right text-ok">Incluye descuentos por {formatMoney(order.discount, order.currency)}</p>}
            <p className="mt-3 inline-flex items-center gap-1.5 text-fg-3">
              <Clock3 size={13} />
              Pedido creado el {formatDateTime(order.ordered_at)}
            </p>
          </div>
          <Link href={siteHref(base, "/tours")} className="inline-flex h-11 items-center justify-center rounded-control border border-line text-[14px] font-semibold text-fg transition hover:bg-surface-2">
            Seguir explorando
          </Link>
        </aside>
      </div>
    </>
  );
}
