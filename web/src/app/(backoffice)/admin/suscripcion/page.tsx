import { BarChart3, CalendarClock, Gauge, Headset, Layers, PackagePlus, ReceiptText, RefreshCw, Wallet } from "lucide-react";
import type { Metadata } from "next";
import { NoAccess } from "@/components/shell/NoAccess";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { InfoTip } from "@/components/ui/InfoTip";
import { HeroBand, HeroChip, HeroPanel, TintCardTitle, ToneScope } from "@/components/ui/Tinted";
import { AuditTrail } from "@/features/admin/AdminParts";
import { BillingCard, InvoicesTable, UsageGrid, UsageHistory } from "@/features/admin/Subscription";
import type { SubscriptionOverview } from "@/lib/admin";
import { formatDate, formatMoney } from "@/lib/format";
import { getResource } from "@/lib/server/resource";

export const metadata: Metadata = { title: "Suscripción y uso" };

export default async function SuscripcionPage() {
  const data = await getResource<SubscriptionOverview>("/billing/subscription", "No pudimos cargar la suscripción.");
  if (!data) return <NoAccess home="/dashboard" />;
  const { plan, subscription } = data;
  const addonsTotal = data.addons.reduce((sum, addon) => sum + addon.quantity * addon.unit_price, 0);
  const near = data.usage.filter((metric) => metric.limit !== null && metric.used >= metric.limit * 0.8).length;

  return (
    <>
      <PageHeader
        title="Suscripción y uso"
        subtitle={near > 0 ? `${near} ${near === 1 ? "límite está" : "límites están"} por encima del 80 % este mes.` : "Tu consumo del mes está dentro de los límites del plan."}
        info={<InfoTip>Los usuarios y las sedes se bloquean al llegar al límite. Las reservas solo avisan. Los mensajes de WhatsApp y correo que superen el límite quedan en cola hasta el siguiente mes o hasta sumar un paquete.</InfoTip>}
      />
      {plan && subscription ? (
        <ToneScope tone="t1">
          <HeroBand>
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
              <div>
                <p className="text-[13px] text-white/70">Plan actual</p>
                <h2 className="text-[30px] font-bold tracking-tight">{plan.name}</h2>
                <p className="mt-1 text-[15px] text-white/85">
                  {formatMoney(subscription.cycle === "annual" ? plan.price_year : plan.price_month, plan.currency)} {subscription.cycle === "annual" ? "al año" : "al mes"} + IGV
                  {addonsTotal > 0 && <span className="text-white/65"> · {formatMoney(addonsTotal, plan.currency)} en adicionales</span>}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <HeroChip icon={<RefreshCw size={14} />}>{subscription.status_label}{subscription.auto_renew ? " · renovación automática" : ""}</HeroChip>
                  <HeroChip icon={<Layers size={14} />}>{plan.modules} módulos</HeroChip>
                  {plan.support && <HeroChip icon={<Headset size={14} />}>{plan.support}</HeroChip>}
                </div>
              </div>
              <HeroPanel>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-[13px]">
                  <div>
                    <dt className="text-[11.5px] text-white/60">Periodo actual</dt>
                    <dd className="font-medium">{formatDate(subscription.period_start)} – {formatDate(subscription.period_end)}</dd>
                  </div>
                  <div>
                    <dt className="text-[11.5px] text-white/60">Próximo cobro</dt>
                    <dd className="font-medium">{subscription.cancel_at ? `Se cancela el ${formatDate(subscription.cancel_at)}` : formatDate(subscription.period_end)}</dd>
                  </div>
                  <div>
                    <dt className="text-[11.5px] text-white/60">Cliente desde</dt>
                    <dd className="font-medium">{formatDate(subscription.customer_since)}</dd>
                  </div>
                  <div>
                    <dt className="text-[11.5px] text-white/60">Saldo a favor</dt>
                    <dd className="font-medium">{formatMoney(subscription.credit_balance, plan.currency)}</dd>
                  </div>
                </dl>
                {data.addons.length > 0 && (
                  <ul className="mt-3 flex flex-col gap-1.5 border-t border-white/15 pt-3 text-[12.5px]">
                    {data.addons.map((addon) => (
                      <li key={addon.code} className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-1.5 text-white/85">
                          <PackagePlus size={13} />
                          {addon.label}
                          {addon.quantity > 1 ? ` × ${addon.quantity}` : ""}
                          {addon.detail && <span className="text-white/60"> · {addon.detail}</span>}
                        </span>
                        <b>{formatMoney(addon.quantity * addon.unit_price, plan.currency)}</b>
                      </li>
                    ))}
                  </ul>
                )}
              </HeroPanel>
            </div>
          </HeroBand>
        </ToneScope>
      ) : (
        <Card className="mb-5">
          <EmptyState icon={<Wallet size={22} />} title="Tu agencia aún no tiene una suscripción registrada" description="La plataforma la crea al activar tu cuenta." />
        </Card>
      )}

      <section className="mb-5">
        <h2 className="mb-3 flex items-center gap-2 text-[15px] font-semibold">
          <Gauge size={17} className="text-accent" />
          Consumo del mes frente al plan
        </h2>
        <UsageGrid usage={data.usage} />
      </section>

      <div className="mb-5 grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <Card>
          <TintCardTitle icon={BarChart3} title="Consumo de los últimos meses" />
          <UsageHistory history={data.history} />
        </Card>
        <Card>
          <TintCardTitle icon={CalendarClock} title="Datos de facturación" />
          {subscription ? <BillingCard subscription={subscription} manage={data.can_manage} /> : <p className="text-[13px] text-fg-3">Sin suscripción.</p>}
        </Card>
      </div>

      <h2 className="mb-3 flex items-center gap-2 text-[15px] font-semibold">
        <ReceiptText size={17} className="text-accent" />
        Facturas de Qhapaq Travel Suite
      </h2>
      <InvoicesTable invoices={data.invoices} />
      <div className="mt-5">
        <AuditTrail entries={data.changes} title="Cambios en la suscripción" empty="Sin cambios en la suscripción." />
      </div>
    </>
  );
}
