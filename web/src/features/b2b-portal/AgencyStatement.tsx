"use client";

import { BadgeCheck, BadgePercent, HandCoins, ReceiptText, Send, Wallet } from "lucide-react";
import Link from "next/link";
import type { PanelActionState } from "@/components/ui/PanelAction";
import { PanelAction } from "@/components/ui/PanelAction";
import { Card } from "@/components/ui/Card";
import { TintTile } from "@/components/ui/Tinted";
import { requestSettlement } from "@/app/(agencia)/agencia/actions";
import { MoneyLines } from "@/features/channels/ChannelUi";
import { EmptyLine, PortalTitle, RISE, rise, SectionCard } from "@/features/portal/PortalUi";
import type { AgencyStatement as Statement } from "@/lib/b2b-portal";
import { cn } from "@/lib/cn";
import { formatDate, formatMoney } from "@/lib/format";
import { AgencyBadge, CreditMeter } from "./AgencyUi";
import { InstallmentList, PaymentList } from "./AgencyPayments";

const initial: PanelActionState = { message: null, done: false };

function SettlementPanel({ statement }: { statement: Statement }) {
  const pending = statement.commissions.filter((row) => ["calculada", "aprobada"].includes(row.status) && !row.requested);
  return (
    <PanelAction
      label="Solicitar liquidación"
      icon={<HandCoins size={15} />}
      variant="primary"
      formId="liquidacion-b2b"
      title="Solicitar liquidación de comisiones"
      description={`${pending.length} ${pending.length === 1 ? "comisión" : "comisiones"} por liquidar`}
      submitLabel="Enviar solicitud"
      action={requestSettlement}
      initial={initial}
    >
      {(state) => (
        <>
          <p className="rounded-tile bg-surface-2 px-3.5 py-3 text-[13px] text-fg-2">Finanzas consolida las comisiones en soles con el tipo de cambio del día y te confirma el pago o la nota de crédito.</p>
          <ul className="flex flex-col gap-2">
            {pending.map((row) => (
              <li key={row.code} className="flex items-center justify-between gap-3 rounded-tile border border-line px-3 py-2 text-[13px]">
                <span className="min-w-0">
                  <b className="block truncate">{row.reservation_title ?? row.code}</b>
                  <span className="text-[12px] text-fg-3">
                    {row.reservation} · {row.pct} % de {formatMoney(row.base, row.currency)}
                  </span>
                </span>
                <b>{formatMoney(row.amount, row.currency)}</b>
              </li>
            ))}
          </ul>
          {state.message && <p className="text-[13px] font-medium text-bad">{state.message}</p>}
        </>
      )}
    </PanelAction>
  );
}

export function AgencyStatementView({ statement }: { statement: Statement }) {
  return (
    <>
      <PortalTitle title="Estado de cuenta" subtitle="Cuotas de tus reservas, pagos informados y comisiones a favor." actions={statement.can_settle ? <SettlementPanel statement={statement} /> : undefined} />

      <section className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <TintTile icon={ReceiptText} tone="t3" label="Facturado" value={<MoneyLines values={statement.kpis.billed} empty="—" />} note="Total neto de tus reservas" />
        <TintTile icon={BadgeCheck} tone="ok" label="Pagado" value={<MoneyLines values={statement.kpis.paid} empty="—" />} note="Aplicado por Finanzas" />
        <TintTile icon={Wallet} tone="t2" label="Por pagar" value={<MoneyLines values={statement.kpis.due} empty="Al día" />} note={statement.kpis.overdue ? `${statement.kpis.overdue} cuotas vencidas` : "Sin cuotas vencidas"} />
        <TintTile icon={BadgePercent} tone="violet" label="Comisiones a favor" value={<MoneyLines values={statement.kpis.commission_pending} empty="—" />} note="Calculadas y aprobadas" />
        <TintTile icon={HandCoins} tone="info" label="Comisiones pagadas" value={<MoneyLines values={statement.kpis.commission_paid} empty="—" />} note="Liquidadas a tu agencia" />
      </section>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="flex flex-col gap-5">
          <SectionCard icon={ReceiptText} title="Cuotas" aside={statement.installments.length}>
            <InstallmentList rows={statement.installments} methods={statement.methods} today={statement.today} linkReservation />
          </SectionCard>
          <SectionCard icon={BadgePercent} title="Comisiones" aside={statement.commissions.length}>
            {statement.commissions.length === 0 ? (
              <EmptyLine>Las comisiones aparecen al reservar.</EmptyLine>
            ) : (
              <ul className="flex flex-col gap-2">
                {statement.commissions.map((row, index) => (
                  <li key={row.code} style={rise(index)} className={cn("lift flex flex-wrap items-center justify-between gap-3 rounded-tile border border-line bg-surface px-3.5 py-2.5", RISE)}>
                    <span className="min-w-0">
                      {row.reservation ? (
                        <Link href={`/agencia/reservas/${row.reservation}`} className="block truncate text-[13.5px] font-semibold transition hover:text-t3">
                          {row.reservation_title ?? row.reservation}
                        </Link>
                      ) : (
                        <b className="block text-[13.5px]">{row.code}</b>
                      )}
                      <span className="text-[12px] text-fg-3">
                        {row.code} · {row.pct} % de {formatMoney(row.base, row.currency)} · {formatDate(row.created_at)}
                        {row.requested && row.status !== "pagada" ? " · en liquidación" : ""}
                      </span>
                    </span>
                    <span className="flex items-center gap-2.5">
                      <b className="text-[13.5px] text-violet">{formatMoney(row.amount, row.currency)}</b>
                      <AgencyBadge status={row.status} />
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>
        <div className="flex flex-col gap-5">
          <Card>
            <CreditMeter credit={statement.credit} compact />
          </Card>
          <SectionCard icon={Send} title="Pagos informados" aside={statement.payments.length}>
            <PaymentList rows={statement.payments} />
          </SectionCard>
          <SectionCard icon={HandCoins} title="Liquidaciones" aside={statement.settlements.length || undefined}>
            {statement.settlements.length === 0 ? (
              <EmptyLine>Aún no solicitas liquidaciones.</EmptyLine>
            ) : (
              <ul className="flex flex-col gap-2">
                {statement.settlements.map((row, index) => (
                  <li key={row.code} style={rise(index)} className={cn("lift flex items-center justify-between gap-3 rounded-tile border border-line bg-surface px-3.5 py-2.5", RISE)}>
                    <span className="min-w-0">
                      <b className="block text-[13.5px]">{formatMoney(row.amount, "PEN")}</b>
                      <span className="text-[12px] text-fg-3">
                        {row.code} · {row.count} {row.count === 1 ? "comisión" : "comisiones"} · {formatDate(row.created_at)}
                      </span>
                    </span>
                    <AgencyBadge status={row.status} />
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>
      </div>
    </>
  );
}
