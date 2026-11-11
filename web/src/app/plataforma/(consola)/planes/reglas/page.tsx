import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/PageHeader";
import { InfoTip } from "@/components/ui/InfoTip";
import { PlanRulesMatrix, ResetPlanRulesAction } from "@/features/platform/PlanRulesMatrix";
import { PlansSection } from "@/features/platform/PlansSection";
import { getPlanRules } from "@/lib/server/platformConsole";
import { listPlans } from "@/lib/server/platform";

export const metadata: Metadata = { title: "Reglas de reserva por plan" };

export default async function PlanRulesPage() {
  const [plans, matrix] = await Promise.all([listPlans(), getPlanRules()]);

  return (
    <>
      <PageHeader
        title="Planes"
        subtitle="Desde qué plan se incluye cada regla del motor de reservas. Los planes superiores la heredan."
        info={<InfoTip>Es una matriz de demostración: se reemplazará por la definitiva. Antes de aplicar un cambio verás qué agencias ganan o pierden la regla; a ellas les llega un aviso por correo.</InfoTip>}
        actions={<ResetPlanRulesAction differs={matrix.differs} />}
      />
      <PlansSection plans={plans.length} rules={matrix.rules}>
        <PlanRulesMatrix matrix={matrix} />
      </PlansSection>
    </>
  );
}
