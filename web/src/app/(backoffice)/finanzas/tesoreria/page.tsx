import { ArrowDownUp, ClipboardCheck, CreditCard, Landmark, RotateCcw, Wallet } from "lucide-react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { InfoTip } from "@/components/ui/InfoTip";
import { TintCardTitle, TintTile } from "@/components/ui/Tinted";
import { AccountCards, MovementsTable, RecordMovementAction } from "@/features/finance/Treasury";
import { cn } from "@/lib/cn";
import type { TreasuryOverview } from "@/lib/finance";
import { formatDate, formatDateTime, formatMoney, TIME_ZONE } from "@/lib/format";
import { getResource } from "@/lib/server/resource";

export const metadata: Metadata = { title: "Tesorería (caja y bancos)" };

const time = (iso: string) => new Intl.DateTimeFormat("es-PE", { hour: "2-digit", minute: "2-digit", timeZone: TIME_ZONE }).format(new Date(iso));

export default async function TesoreriaPage() {
  const data = await getResource<TreasuryOverview>("/treasury/accounts", "No pudimos cargar la tesorería.");

  if (!data) {
    return <PageHeader title="Tesorería (caja y bancos)" subtitle="Tu rol no tiene acceso a esta sección." />;
  }

  const { kpis } = data;
  const net = kpis.in_month_pen - kpis.out_month_pen;

  return (
    <>
      <PageHeader
        title="Tesorería (caja y bancos)"
        subtitle="Saldos de bancos, cajas chicas y pasarelas, con cada movimiento."
        info={<InfoTip>El saldo de cada cuenta es su apertura más ingresos menos egresos registrados. Los saldos en dólares se muestran en soles al tipo de cambio de hoy ({data.usd_rate}).</InfoTip>}
        actions={data.can.manage ? <RecordMovementAction data={data} /> : undefined}
      />
      <section className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <TintTile icon={Landmark} tone="t1" label="Bancos" value={formatMoney(kpis.bank_pen, "PEN", { compact: true })} note={`Total disponible ${formatMoney(kpis.total_pen, "PEN", { compact: true })}`} />
        <TintTile icon={Wallet} tone="sun" label="Cajas chicas" value={formatMoney(kpis.cash_pen, "PEN", { compact: true })} note={kpis.open_sessions === 1 ? "1 caja abierta hoy" : `${kpis.open_sessions} cajas abiertas`} />
        <TintTile icon={CreditCard} tone="violet" label="Pasarelas por liquidar" value={formatMoney(kpis.gateway_pen, "PEN", { compact: true })} />
        <TintTile icon={ArrowDownUp} tone={net >= 0 ? "ok" : "bad"} label="Flujo del mes" value={formatMoney(net, "PEN", { compact: true })} note={`Entró ${formatMoney(kpis.in_month_pen, "PEN", { compact: true })} · salió ${formatMoney(kpis.out_month_pen, "PEN", { compact: true })}`} />
      </section>
      <AccountCards accounts={data.accounts} />
      <div className="mb-5 grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Card>
          <TintCardTitle icon={ClipboardCheck} title="Sesiones de caja" aside={`${data.sessions.length} recientes`} />
          <ul className="grid gap-2">
            {data.sessions.map((session, index) => (
              <li key={session.code} style={{ animationDelay: `${index * 60}ms` }} className="lift flex flex-wrap items-center justify-between gap-3 rounded-xl bg-surface-2 px-3.5 py-2.5 animate-[rise-in_420ms_cubic-bezier(0.22,1,0.36,1)_backwards]" title={session.count?.note ?? undefined}>
                <span className="min-w-0 text-[13px]">
                  <b className="block font-semibold">{session.account}</b>
                  <span className="text-xs text-fg-3">
                    {formatDate(session.date)} · abrió {session.opened_by ?? "—"} a las {time(session.opened_at)} con {formatMoney(session.opening)}
                  </span>
                </span>
                {session.status === "open" ? (
                  <Badge tone="t4">Abierta</Badge>
                ) : session.count ? (
                  <span className="text-right text-xs">
                    <Badge tone={session.count.difference === 0 ? "ok" : "warn"}>{session.count.result}</Badge>
                    <span className={cn("mt-0.5 block text-fg-3", session.count.difference !== 0 && "text-warn")}>
                      {session.count.difference === 0 ? `Arqueo ${session.count.code}` : `${formatMoney(session.count.difference)} · ${session.count.status.toLowerCase()}`}
                    </span>
                  </span>
                ) : (
                  <Badge tone="mute">Cerrada</Badge>
                )}
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <TintCardTitle icon={RotateCcw} title="Reposiciones de caja chica" />
          {data.replenishments.length === 0 ? (
            <p className="py-6 text-center text-[13px] text-fg-3">Sin reposiciones registradas.</p>
          ) : (
            <ul className="grid gap-2">
              {data.replenishments.map((item, index) => (
                <li key={item.code} style={{ animationDelay: `${index * 60}ms` }} className="lift flex items-center justify-between gap-3 rounded-xl bg-surface-2 px-3.5 py-2.5 animate-[rise-in_420ms_cubic-bezier(0.22,1,0.36,1)_backwards]">
                  <span className="min-w-0 text-[13px]">
                    <b className="block font-semibold">{item.account}</b>
                    <span className="text-xs text-fg-3">
                      {item.code} · {item.requested_by ?? "—"} · {formatDateTime(item.requested_at, false)}
                    </span>
                  </span>
                  <span className="grid justify-items-end gap-0.5">
                    <span className="font-mono text-[13px] font-semibold">{formatMoney(item.amount)}</span>
                    <Badge tone={item.status === "paid" ? "ok" : item.status === "rejected" ? "bad" : "warn"}>{item.status_label}</Badge>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
      <MovementsTable data={data} />
    </>
  );
}
