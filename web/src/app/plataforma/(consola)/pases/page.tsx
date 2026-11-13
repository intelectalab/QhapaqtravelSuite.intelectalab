import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card, CardHeader } from "@/components/ui/Card";
import { InfoTip } from "@/components/ui/InfoTip";
import { AddonsCatalog, NewPassAction, PassesTable, PassTiles } from "@/features/vitrina/AccessPasses";
import { platformGet } from "@/lib/server/platform";
import type { PassesOverview } from "@/lib/vitrina";

export const metadata: Metadata = { title: "Pases 30 días y add-ons" };

export default async function PassesPage() {
  const overview = await platformGet<PassesOverview>("/access-passes");

  return (
    <>
      <PageHeader
        title="Pases 30 días y add-ons"
        subtitle="El pase Básico da acceso temporal a las funciones que usted elija, gratis o pagado. Los add-ons se venden aparte, con pago único o mensual."
        info={<InfoTip>Las funciones del pase se activan como excepciones con fecha de fin. Al convertir o revocar, se retiran y rige el plan de la agencia.</InfoTip>}
        actions={<NewPassAction overview={overview} />}
      />
      <PassTiles overview={overview} />
      <PassesTable overview={overview} />
      <div className="mt-5">
        <Card>
          <CardHeader title="Catálogo de add-ons" subtitle="Modalidad de cobro y precios sin IGV." />
          <AddonsCatalog addons={overview.addons} />
        </Card>
      </div>
    </>
  );
}
