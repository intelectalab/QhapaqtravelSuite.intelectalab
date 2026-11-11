import type { ReactNode } from "react";
import { Suspense } from "react";
import { PageHeader } from "@/components/shell/PageHeader";
import { InfoTip } from "@/components/ui/InfoTip";
import { SectionLayout } from "@/components/ui/SectionNav";
import { ReportsNav } from "@/features/reports/ReportsNav";
import { getReportExports } from "@/lib/server/reports";

export default async function ReportesLayout({ children }: { children: ReactNode }) {
  const exports = await getReportExports();
  if (!exports) return <PageHeader title="Reportes y KPIs" subtitle="Tu rol no tiene acceso a esta sección." />;

  return (
    <>
      <PageHeader
        title="Reportes y KPIs"
        subtitle={`${exports.tabs.length} ${exports.tabs.length === 1 ? "reporte disponible" : "reportes disponibles"} para tu rol, con filtros de periodo y sede.`}
        info={<InfoTip>Las ventas se cuentan en soles con el tipo de cambio de cada documento y las reservas canceladas no suman. Cada reporte muestra solo lo que tu rol puede ver; Ventas ve su propia cartera.</InfoTip>}
      />
      <SectionLayout
        nav={
          <Suspense>
            <ReportsNav tabs={exports.tabs} exports={exports.exports.length} canExport={exports.can_export} />
          </Suspense>
        }
      >
        {children}
      </SectionLayout>
    </>
  );
}
