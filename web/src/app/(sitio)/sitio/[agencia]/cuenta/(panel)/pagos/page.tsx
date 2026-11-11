import { CircleCheckBig, Hourglass } from "lucide-react";
import Link from "next/link";
import { StatusBadge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { OrderPayment } from "@/features/site/PayButton";
import { cn } from "@/lib/cn";
import { formatDate, formatMoney } from "@/lib/format";
import { getSiteProfile, requireAccount, siteBase } from "@/lib/server/site";
import { siteHref, type AccountMe, type AccountReceivables } from "@/lib/site";

export default async function AccountPaymentsPage({ params }: PageProps<"/sitio/[agencia]/cuenta/pagos">) {
  const { agencia } = await params;
  const [data, me, profile, base] = await Promise.all([requireAccount<AccountReceivables>(agencia, "/me/receivables?status=open"), requireAccount<AccountMe>(agencia, "/me"), getSiteProfile(agencia), siteBase(agencia)]);
  const payable = data.totals.payable.filter((money) => Number(money.amount) > 0);
  const pending = data.totals.pending.filter((money) => Number(money.amount) > 0);

  return (
    <>
      <div>
        <h2 className="text-[20px] font-bold tracking-tight text-fg">Pagos pendientes</h2>
        <p className="text-[13px] text-fg-3">Cuotas abiertas o vencidas de tus reservas. Lo que ya informaste por transferencia o Yape aparece como «por validar».</p>
      </div>

      {me.passenger ? (
        <div className="rounded-card border border-line bg-surface p-6 shadow-card">
          <EmptyState icon={<CircleCheckBig size={22} />} title="Los pagos los ve quien compró el viaje" description="Si necesitas un comprobante, pídeselo al titular de la reserva." />
        </div>
      ) : data.items.length === 0 ? (
        <div className="rounded-card border border-line bg-surface p-6 shadow-card">
          <EmptyState icon={<CircleCheckBig size={22} />} title="Estás al día" description="No tienes cuotas pendientes." />
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="lift rounded-card border border-line bg-surface p-4 shadow-card">
              <span className="text-[12.5px] font-semibold text-fg-3">Por pagar</span>
              <b className="mt-1 block text-[20px] font-bold text-fg">{payable.length > 0 ? payable.map((money) => formatMoney(money.amount, money.currency)).join(" + ") : formatMoney(0)}</b>
            </div>
            <div className="lift rounded-card border border-line bg-surface p-4 shadow-card">
              <span className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-fg-3">
                <Hourglass size={13} />
                En validación
              </span>
              <b className="mt-1 block text-[20px] font-bold text-fg">{pending.length > 0 ? pending.map((money) => formatMoney(money.amount, money.currency)).join(" + ") : "—"}</b>
            </div>
          </div>

          <ul className="grid gap-4">
            {data.items.map((item) => {
              const overdue = item.status === "vencida";
              return (
                <li key={item.code} className={cn("rounded-card border bg-surface p-5 shadow-card", overdue ? "border-[color-mix(in_srgb,var(--bad)_35%,transparent)]" : "border-line")}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <span className="text-[12px] font-semibold text-fg-3">
                        {item.code} ·{" "}
                        <Link href={siteHref(base, `/cuenta/reservas/${item.reservation}`)} className="text-accent hover:underline">
                          {item.reservation}
                        </Link>
                      </span>
                      <h3 className="text-[15.5px] font-bold tracking-tight text-fg">{item.concept}</h3>
                      <p className="text-[13px] text-fg-2">
                        {item.reservation_title} · {overdue ? "venció" : "vence"} el {formatDate(item.due_date)}
                      </p>
                    </div>
                    <div className="text-right">
                      <StatusBadge status={item.status} />
                      <b className="mt-1.5 block text-[17px] font-bold text-fg">{item.can_pay ? formatMoney(item.payable, item.currency) : "Por validar"}</b>
                      <span className="text-[12px] text-fg-3">
                        de {formatMoney(item.amount, item.currency)}
                        {Number(item.paid) > 0 ? ` · pagado ${formatMoney(item.paid, item.currency)}` : ""}
                      </span>
                    </div>
                  </div>
                  {Number(item.pending) > 0 && (
                    <p className="mt-3 rounded-xl bg-[color-mix(in_srgb,var(--info)_8%,var(--surface))] px-3.5 py-2.5 text-[13px] text-fg-2">
                      Estamos validando {formatMoney(item.pending, item.currency)} que informaste. {item.can_pay ? "Puedes pagar el resto." : "No necesitas pagar de nuevo."}
                    </p>
                  )}
                  {item.can_pay && (
                    <details className="group mt-4 rounded-xl border border-line">
                      <summary className="flex h-12 cursor-pointer list-none items-center justify-between px-4 text-[14px] font-semibold text-fg">
                        Pagar {formatMoney(item.payable, item.currency)}
                        <span className="text-[12.5px] font-medium text-fg-3 group-open:hidden">Tarjeta, transferencia, Yape o Plin</span>
                      </summary>
                      <div className="border-t border-line p-4">
                        <OrderPayment target="receivable" code={item.code} label={`Pagar ${formatMoney(item.payable, item.currency)}`} methods={data.methods} accounts={data.bank_accounts} walletPhone={profile.agency.phone} />
                      </div>
                    </details>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </>
  );
}
