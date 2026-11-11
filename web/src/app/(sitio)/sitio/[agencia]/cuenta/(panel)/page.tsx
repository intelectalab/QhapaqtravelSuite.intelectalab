import { ArrowRight, CalendarDays, Compass, Ticket } from "lucide-react";
import Link from "next/link";
import { StatusBadge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { capitalize, formatDate, formatMoney } from "@/lib/format";
import { requireAccount, siteBase } from "@/lib/server/site";
import { siteHref, type AccountMe, type AccountReservation } from "@/lib/site";

export default async function AccountReservationsPage({ params, searchParams }: PageProps<"/sitio/[agencia]/cuenta">) {
  const { agencia } = await params;
  const query = await searchParams;
  const [{ items }, me, base] = await Promise.all([requireAccount<{ items: AccountReservation[] }>(agencia, "/me/reservations"), requireAccount<AccountMe>(agencia, "/me"), siteBase(agencia)]);

  return (
    <>
      {query.bienvenida === "1" && (
        <p className="rounded-xl border border-[color-mix(in_srgb,var(--ok)_30%,transparent)] bg-[color-mix(in_srgb,var(--ok)_8%,var(--surface))] px-4 py-3 text-[13.5px] text-fg">
          Tu cuenta está lista. {items.length > 0 ? "Vinculamos las compras que hiciste con este correo." : "Cuando reserves con este correo, tus viajes aparecerán aquí."}
        </p>
      )}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-[20px] font-bold tracking-tight text-fg">Mis reservas</h2>
          <p className="text-[13px] text-fg-3">{items.length === 1 ? "1 viaje" : `${items.length} viajes`} con {me.login_email}</p>
        </div>
        <a href={me.portal_url} className="text-[13px] font-semibold text-accent hover:underline">
          Abrir el portal del cliente
        </a>
      </div>
      {items.length === 0 ? (
        <div className="rounded-card border border-line bg-surface p-6 shadow-card">
          <EmptyState icon={<Compass size={22} />} title="Aún no tienes viajes" description="Explora nuestros tours y reserva con este mismo correo." action={<Link href={siteHref(base, "/tours")} className="inline-flex h-11 items-center rounded-control bg-brand px-5 text-[14px] font-semibold text-brand-fg">Ver tours</Link>} />
        </div>
      ) : (
        <ul className="grid gap-3">
          {items.map((item, index) => {
            const balance = item.balance.filter((money) => Number(money.amount) > 0);
            return (
              <li key={item.code} className="animate-[rise-in_420ms_cubic-bezier(0.22,1,0.36,1)_backwards]" style={{ animationDelay: `${index * 50}ms` }}>
                <Link href={siteHref(base, `/cuenta/reservas/${item.code}`)} className="lift group grid gap-3 rounded-card border border-line bg-surface p-5 shadow-card sm:grid-cols-[1fr_auto] sm:items-center">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[12px] font-semibold text-fg-3">{item.code}</span>
                      <StatusBadge status={item.status} />
                    </div>
                    <h3 className="mt-1 truncate text-[16px] font-bold tracking-tight text-fg">{item.title}</h3>
                    <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-fg-2">
                      <span className="inline-flex items-center gap-1.5">
                        <CalendarDays size={14} className="text-fg-3" />
                        {capitalize(formatDate(item.from, "long"))}
                        {item.to && item.to !== item.from ? ` al ${formatDate(item.to)}` : ""}
                      </span>
                      {item.vouchers > 0 && (
                        <span className="inline-flex items-center gap-1.5">
                          <Ticket size={14} className="text-fg-3" />
                          {item.vouchers === 1 ? "1 voucher" : `${item.vouchers} vouchers`}
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-4 sm:text-right">
                    <div>
                      <b className="block text-[16px] font-bold text-fg">{formatMoney(item.total, item.currency)}</b>
                      <span className={balance.length > 0 ? "text-[12.5px] font-semibold text-warn" : "text-[12.5px] text-ok"}>{balance.length > 0 ? `Saldo ${balance.map((money) => formatMoney(money.amount, money.currency)).join(" + ")}` : "Pagado"}</span>
                    </div>
                    <ArrowRight size={18} className="text-fg-3 transition-transform group-hover:translate-x-1" />
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
