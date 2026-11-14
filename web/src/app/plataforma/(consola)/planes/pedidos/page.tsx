import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/PageHeader";
import { InfoTip } from "@/components/ui/InfoTip";
import { PlansSection } from "@/features/platform/PlansSection";
import { RuleRequestsInbox } from "@/features/platform/RuleRequestsInbox";
import { getPlanRules, getRuleRequests } from "@/lib/server/platformConsole";
import { listPlans } from "@/lib/server/platform";

export const metadata: Metadata = { title: "Pedidos de reglas" };

export default async function RuleRequestsPage() {
  const [plans, matrix, requests] = await Promise.all([listPlans(), getPlanRules(), getRuleRequests()]);
  const open = requests.counts.enviado + requests.counts.en_evaluacion;

  return (
    <>
      <PageHeader
        title="Planes"
        subtitle={open > 0 ? `${open} ${open === 1 ? "pedido abierto" : "pedidos abiertos"} de las agencias para automatizar sus reglas personalizadas` : "Pedidos de las agencias para automatizar sus reglas personalizadas"}
        info={<InfoTip>Cada agencia pide desde Reglas qué debe hacer su regla personalizada. Rechaza con motivo, márcalo en evaluación o publícalo enlazándolo a la regla estándar que lo cubre. La agencia recibe cada decisión en la campana y queda en la auditoría.</InfoTip>}
      />
      <PlansSection plans={plans.length} rules={matrix.rules} requests={requests.items.length}>
        <RuleRequestsInbox data={requests} />
      </PlansSection>
    </>
  );
}
