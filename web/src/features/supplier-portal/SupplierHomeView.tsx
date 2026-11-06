import { BellRing, CalendarCheck2, ClipboardList, FileSignature, Hourglass, Wallet } from "lucide-react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { TintTile } from "@/components/ui/Tinted";
import { MoneyLines } from "@/features/channels/ChannelUi";
import { EmptyLine, RISE, rise, SectionCard } from "@/features/portal/PortalUi";
import { cn } from "@/lib/cn";
import { formatDate, formatMoney } from "@/lib/format";
import { dayDistance, type SupplierHome, type SupplierSession } from "@/lib/supplier-portal";
import { toneStyle } from "@/lib/tone";
import { RequestItem, SupplierAlerts, SupplierBadge } from "./SupplierUi";

export function SupplierHomeView({ home, session }: { home: SupplierHome; session: SupplierSession }) {
  const { kpis } = home;
  return (
    <div className="flex flex-col gap-6">
      <div className={RISE}>
        <h1 className="text-[26px] font-bold leading-tight tracking-tight sm:text-[30px]">{session.provider.name}</h1>
        <p className="mt-1 text-[14px] text-fg-2">
          {kpis.pending ? `Tiene ${kpis.pending} ${kpis.pending === 1 ? "solicitud" : "solicitudes"} de ${session.agency.name} por responder.` : `Está al día con las solicitudes de ${session.agency.name}.`}
        </p>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <TintTile icon={ClipboardList} tone={kpis.overdue ? "bad" : kpis.pending ? "warn" : "ok"} label="Solicitudes por responder" value={kpis.pending} note={kpis.overdue ? `${kpis.overdue} fuera de plazo · responda en 24 h` : "Responda en máximo 24 h"} />
        <TintTile icon={CalendarCheck2} tone="t1" label="Servicios próximos 7 días" value={kpis.upcoming} note={`${kpis.upcoming_pax} pasajeros`} />
        <TintTile icon={Wallet} tone="t3" label="Por cobrar a la agencia" value={<MoneyLines values={kpis.receivable} empty="Sin saldo" />} note="Saldo por moneda, sin conversión" />
        <TintTile icon={FileSignature} tone={kpis.contract_days < 0 ? "bad" : kpis.contract_days < 60 ? "warn" : "violet"} label="Contrato" value={kpis.contract_days < 0 ? "Vencido" : `${kpis.contract_days} días`} note={kpis.contract_days < 0 ? "Renueve para recibir solicitudes" : "Para el vencimiento"} />
      </section>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex flex-col gap-5">
          <SectionCard icon={Hourglass} title="Pendientes de confirmar" aside={<Link href="/proveedor/solicitudes" className="text-t1">Ver todas</Link>}>
            {home.pending.length === 0 ? (
              <EmptyLine>No tiene solicitudes pendientes.</EmptyLine>
            ) : (
              <ul className="flex flex-col gap-2">
                {home.pending.map((row, index) => (
                  <RequestItem key={row.code} row={row} index={index} showDeadline />
                ))}
              </ul>
            )}
          </SectionCard>
          <SectionCard icon={CalendarCheck2} title="Próximos 7 días" aside={<Link href="/proveedor/calendario" className="text-t1">Calendario</Link>}>
            {home.upcoming.length === 0 ? (
              <EmptyLine>No hay servicios confirmados para esta semana.</EmptyLine>
            ) : (
              <ul className="flex flex-col gap-2">
                {home.upcoming.map((row, index) => (
                  <RequestItem key={row.code} row={row} index={index} />
                ))}
              </ul>
            )}
          </SectionCard>
        </div>
        <div className="flex flex-col gap-5">
          <SectionCard icon={BellRing} title="Avisos" aside={home.alerts.length || undefined}>
            <SupplierAlerts alerts={home.alerts} />
          </SectionCard>
          <SectionCard icon={Wallet} title="Pagos por recibir" aside={<Link href="/proveedor/pagos" className="text-t1">Ver pagos</Link>}>
            {home.payments.length === 0 ? (
              <EmptyLine>La agencia no tiene saldos pendientes con usted.</EmptyLine>
            ) : (
              <ul className="flex flex-col gap-2">
                {home.payments.map((row, index) => (
                  <li key={row.code} style={{ ...toneStyle(row.status === "vencida" ? "bad" : "t3"), ...rise(index) }} className={cn("lift relative overflow-hidden rounded-tile border border-line bg-surface py-2.5 pl-4 pr-3.5", RISE)}>
                    <span aria-hidden className="absolute inset-y-0 left-0 w-1 bg-[var(--tint)]" />
                    <div className="flex items-start justify-between gap-3">
                      <span className="min-w-0">
                        <b className="block truncate text-[13.5px] font-semibold">{row.concept}</b>
                        <span className="block text-[12px] text-fg-3">
                          {row.code} · {row.scheduled_date ? `Programado ${formatDate(row.scheduled_date)}` : `Vence ${formatDate(row.due_date)}`} · {dayDistance(row.days_to)}
                        </span>
                      </span>
                      <span className="flex flex-none flex-col items-end gap-1">
                        <b className="text-[13.5px]">{formatMoney(row.balance, row.currency)}</b>
                        <SupplierBadge status={row.status} scope="payable" />
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
          <Card className="text-[13px] text-fg-2">
            <b className="block text-[13.5px] text-fg">Tiempo de respuesta</b>
            Una solicitud sin respuesta bloquea la emisión del voucher al pasajero. El plazo acordado con la agencia es de 24 horas desde el envío.
          </Card>
        </div>
      </div>
    </div>
  );
}
