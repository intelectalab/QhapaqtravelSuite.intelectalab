import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/PageHeader";
import { InfoTip } from "@/components/ui/InfoTip";
import { BillingTabs } from "@/features/platform/BillingTabs";
import { CouponFormAction, CouponsTable } from "@/features/platform/CouponsTable";
import { listPlans } from "@/lib/server/platform";
import { listCoupons } from "@/lib/server/platformConsole";

export const metadata: Metadata = { title: "Cupones" };

export default async function CuponesPage() {
  const [coupons, plans] = await Promise.all([listCoupons(), listPlans()]);
  const options = plans.map((plan) => ({ code: plan.code, name: plan.name, rank: plan.rank }));

  return (
    <>
      <PageHeader
        title="Facturación"
        subtitle="Descuentos que las agencias canjean en su suscripción."
        info={<InfoTip>Un cupón no se acumula con otro. El descuento porcentual llega como máximo al 50 % y se aplica durante los ciclos indicados.</InfoTip>}
        actions={<CouponFormAction plans={options} />}
      />
      <BillingTabs />
      <CouponsTable coupons={coupons} plans={options} />
    </>
  );
}
