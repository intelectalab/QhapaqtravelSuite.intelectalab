import { CalendarDays, CheckCircle2, CircleDashed, Clock3, Receipt, Ticket } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { StatusBadge } from "@/components/ui/Badge";
import { DownloadButton } from "@/components/ui/DownloadButton";
import { HoldTimer } from "@/features/site/Cart";
import { PageHero } from "@/features/site/Hero";
import { OrderPayment } from "@/features/site/PayButton";
import { cn } from "@/lib/cn";
import { capitalize, formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { getSiteOrder, getSiteProfile, siteBase } from "@/lib/server/site";
import { siteHref } from "@/lib/site";

export const metadata: Metadata = { title: "Confirmación de tu pedido", robots: { index: false, follow: false } };

export default async function ConfirmationPage({ params }: PageProps<"/sitio/[agencia]/confirmacion/[code]">) {
  const { agencia, code } = await params;
  const [order, base, profile] = await Promise.all([getSiteOrder(agencia, code), siteBase(agencia), getSiteProfile(agencia)]);
  const paid = order.status === "confirmado";
  const rejected = order.status === "pago_rechazado";
  const balance = paid && Number(order.due) > 0;
  const canPay = Number(order.due) > 0 && ["pago_pendiente", "pago_rechazado", "confirmado"].includes(order.status);
  const steps = [
    { label: "Pedido creado", done: true },
    { label: "Pago registrado", done: paid },
    { label: "Servicios confirmados por operaciones", done: paid && order.reservations.every((r) => r.status === "confirmada") },
    { label: "Vouchers listos para descargar", done: order.reservations.some((r) => r.vouchers.length > 0) },
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
          {order.status === "pago_por_validar" && (
            <section className="rounded-card border border-[color-mix(in_srgb,var(--info)_35%,transparent)] bg-[color-mix(in_srgb,var(--info)_8%,var(--surface))] p-5">
              <h2 className="text-[16px] font-semibold text-fg">Estamos validando tu pago</h2>
              <p className="mt-1.5 text-[13.5px] leading-relaxed text-fg-2">Recibimos tu número de operación. Lo validamos en un plazo de 4 horas hábiles y te avisamos por correo. Tus cupos ya están reservados.</p>
            </section>
          )}

          {canPay && (
            <section className={cn("rounded-card border p-5", rejected ? "border-[color-mix(in_srgb,var(--bad)_35%,transparent)] bg-[color-mix(in_srgb,var(--bad)_6%,var(--surface))]" : "border-[color-mix(in_srgb,var(--warn)_35%,transparent)] bg-[color-mix(in_srgb,var(--warn)_8%,var(--surface))]")}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-[16px] font-semibold text-fg">{balance ? "Paga el saldo de tu viaje" : rejected ? "Tu pago fue rechazado" : "Completa el pago"}</h2>
                {!balance && order.hold_expires_at && <HoldTimer until={order.hold_expires_at} />}
              </div>
              <p className="mt-1.5 text-[13.5px] leading-relaxed text-fg-2">
                {balance
                  ? `Te queda un saldo de ${formatMoney(order.due, order.currency)}${order.balance_due_date ? ` que vence el ${formatDate(order.balance_due_date)}` : ""}.`
                  : rejected
                    ? `${order.attempts[0]?.message ?? "El banco rechazó el cobro."} Tus cupos siguen bloqueados; puedes intentar con otra tarjeta u otro medio.`
                    : `Pendiente de pago: ${formatMoney(order.due, order.currency)}${order.pay_mode === "anticipo" ? " (adelanto)" : ""}.`}
              </p>
              <div className="mt-4">
                <OrderPayment code={order.code} label={`Pagar ${formatMoney(order.due, order.currency)}`} methods={order.methods} accounts={order.bank_accounts} walletPhone={profile.agency.phone} />
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
              {reservation.vouchers.length > 0 && (
                <div className="mt-4 border-t border-line pt-4">
                  <h3 className="text-[13.5px] font-semibold text-fg">Tus vouchers</h3>
                  <ul className="mt-2 grid gap-2">
                    {reservation.vouchers.map((voucher) => (
                      <li key={voucher.code} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line px-3.5 py-2.5 text-[13px] transition-colors hover:bg-surface-2">
                        <span className="inline-flex min-w-0 items-center gap-2">
                          <Ticket size={15} className="flex-none text-fg-3" />
                          <span className="min-w-0">
                            <span className="block truncate font-medium text-fg">{voucher.label}</span>
                            <span className="text-[12px] text-fg-3">
                              {voucher.code} · {formatDate(voucher.date)}
                            </span>
                          </span>
                        </span>
                        <DownloadButton href={`/sitio/${agencia}/confirmacion/${order.code}/vouchers/${voucher.code}`} label="Descargar" size="sm" />
                      </li>
                    ))}
                  </ul>
                </div>
              )}
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
          {order.attempts.length > 0 && (
            <div className="rounded-card border border-line bg-surface p-5 shadow-card">
              <h2 className="text-[15px] font-semibold text-fg">Pagos</h2>
              <ul className="mt-3 grid gap-2">
                {order.attempts.map((attempt) => (
                  <li key={attempt.at} className="rounded-xl bg-surface-2 px-3 py-2 text-[12.5px]">
                    <span className="flex items-center justify-between gap-2">
                      <b className="font-semibold text-fg">{attempt.method}{attempt.card ? ` ${attempt.card}` : ""}</b>
                      <span className={cn("font-semibold", attempt.result === "aprobado" ? "text-ok" : attempt.result === "rechazado" ? "text-bad" : "text-warn")}>{attempt.result === "aprobado" ? "Aprobado" : attempt.result === "rechazado" ? "Rechazado" : "Por validar"}</span>
                    </span>
                    <span className="text-fg-3">{formatDateTime(attempt.at)}{attempt.amount ? ` · ${formatMoney(attempt.amount, attempt.currency ?? order.currency)}` : ""}{attempt.operation ? ` · op. ${attempt.operation}` : ""}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="rounded-card border border-line bg-surface p-5 text-[13px] shadow-card">
            <div className="flex justify-between text-fg-2">
              <span>Total del pedido</span>
              <b className="text-[18px] tabular-nums text-fg">{formatMoney(order.total, order.currency)}</b>
            </div>
            {Number(order.discount) > 0 && <p className="mt-1 text-right text-ok">Incluye descuentos por {formatMoney(order.discount, order.currency)}</p>}
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
