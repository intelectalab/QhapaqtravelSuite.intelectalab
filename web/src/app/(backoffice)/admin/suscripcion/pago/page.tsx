import type { Metadata } from "next";
import { NoAccess } from "@/components/shell/NoAccess";
import { BillingForm, PaymentMethodCard } from "@/features/admin/SubscriptionPanels";
import { getSubscription } from "@/lib/server/subscription";

export const metadata: Metadata = { title: "Método de pago y facturación" };

export default async function PagoPage() {
  const data = await getSubscription();
  if (!data || !data.subscription) return <NoAccess home="/dashboard" />;
  const manage = data.can_manage && data.subscription.status !== "canceled";
  return (
    <div className="grid items-start gap-5 2xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
      <PaymentMethodCard card={data.payment_method} manage={manage} />
      <BillingForm billing={data.subscription.billing} manage={data.can_manage} />
    </div>
  );
}
