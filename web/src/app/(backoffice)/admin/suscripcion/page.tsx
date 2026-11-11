import { Gauge, Wallet } from "lucide-react";
import type { Metadata } from "next";
import { NoAccess } from "@/components/shell/NoAccess";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { TintCardTitle } from "@/components/ui/Tinted";
import { AuditTrail } from "@/features/admin/AdminParts";
import { UsageGrid } from "@/features/admin/Subscription";
import { ModulesCard, PlanPeriodCard } from "@/features/admin/SubscriptionPanels";
import { formatDate } from "@/lib/format";
import { getSubscription } from "@/lib/server/subscription";

export const metadata: Metadata = { title: "Suscripción y uso" };

export default async function SuscripcionPage() {
  const data = await getSubscription();
  if (!data) return <NoAccess home="/dashboard" />;
  const { plan, subscription } = data;
  const manage = data.can_manage && subscription !== null && subscription.status !== "canceled";

  if (!plan || !subscription) {
    return (
      <Card>
        <EmptyState icon={<Wallet size={22} />} title="Tu agencia aún no tiene una suscripción registrada" description="La plataforma la crea al activar tu cuenta." />
      </Card>
    );
  }

  return (
    <>
      <div className="mb-5 grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Card>
          <TintCardTitle icon={Gauge} title="Consumo del periodo" aside="Avisos al 80 % y al 100 %" />
          <p className="-mt-2 mb-4 text-[12px] text-fg-3">
            Periodo del {formatDate(subscription.period_start)} al {formatDate(subscription.period_end)}. Los contadores se consolidan cada noche.
          </p>
          <UsageGrid usage={data.usage} columns={2} />
        </Card>
        <div className="flex flex-col gap-5">
          <PlanPeriodCard subscription={subscription} manage={manage} />
          <ModulesCard modules={data.modules} plan={plan.name} />
        </div>
      </div>
      <AuditTrail entries={data.changes} title="Cambios en la suscripción" empty="Sin cambios en la suscripción." />
    </>
  );
}
