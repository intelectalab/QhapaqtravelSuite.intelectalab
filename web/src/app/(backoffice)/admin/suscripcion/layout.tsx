import type { ReactNode } from "react";
import { NoAccess } from "@/components/shell/NoAccess";
import { PageHeader } from "@/components/shell/PageHeader";
import { InfoTip } from "@/components/ui/InfoTip";
import { SectionLayout } from "@/components/ui/SectionNav";
import { ChangePlanAction, CouponAction, SubscriptionBanners } from "@/features/admin/SubscriptionActions";
import { SubscriptionNav } from "@/features/admin/SubscriptionNav";
import { SubscriptionKpis } from "@/features/admin/SubscriptionPanels";
import { getPlanRules, getSubscription } from "@/lib/server/subscription";

export default async function SuscripcionLayout({ children }: { children: ReactNode }) {
  const [data, rules] = await Promise.all([getSubscription(), getPlanRules()]);
  if (!data) return <NoAccess home="/dashboard" />;
  const { plan, subscription } = data;
  const manage = data.can_manage && subscription !== null && subscription.status !== "canceled";
  const near = data.usage.filter((metric) => metric.limit !== null && metric.used >= metric.limit * 0.8).length;
  const overdue = data.invoices.filter((invoice) => ["open", "failed"].includes(invoice.status));

  return (
    <>
      <PageHeader
        title="Suscripción y uso"
        subtitle={plan ? `Plan ${plan.name}: consumo del periodo, complementos, facturas y método de pago.` : "Plan, consumo, facturas y método de pago de tu agencia."}
        info={<InfoTip>Los usuarios y las sedes se bloquean al llegar al límite. Las reservas solo avisan. Los mensajes de WhatsApp y correo que superen el límite quedan en cola hasta el siguiente mes o hasta sumar un paquete.</InfoTip>}
        actions={
          manage && subscription && rules ? (
            <div className="flex flex-wrap gap-2">
              <CouponAction active={subscription.coupon} />
              <ChangePlanAction plans={rules.plans} current={rules.current} cycle={subscription.cycle} currency={plan?.currency ?? "PEN"} />
            </div>
          ) : undefined
        }
      />
      {subscription && <SubscriptionBanners subscription={subscription} overdue={manage ? overdue : []} near={near} currency={plan?.currency ?? "PEN"} />}
      <SubscriptionKpis data={data} />
      <SectionLayout nav={<SubscriptionNav addons={data.addons.length} invoices={data.invoices.length} />}>{children}</SectionLayout>
    </>
  );
}
