import { CircleCheck, Hourglass, ListChecks, Stamp, UserRound, Users } from "lucide-react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card } from "@/components/ui/Card";
import { InfoTip } from "@/components/ui/InfoTip";
import { TintCardTitle, TintTile } from "@/components/ui/Tinted";
import { CalculateCommissionsAction, CommissionsTable } from "@/features/finance/Commissions";
import { RankBars } from "@/features/finance/RankBars";
import type { CommissionsOverview } from "@/lib/finance";
import { formatMoney } from "@/lib/format";
import { getResource } from "@/lib/server/resource";

export const metadata: Metadata = { title: "Comisiones" };

const count = (value: number) => (value === 1 ? "1 comisión" : `${value} comisiones`);

export default async function ComisionesPage() {
  const data = await getResource<CommissionsOverview>("/finance/commissions", "No pudimos cargar las comisiones.");

  if (!data) {
    return <PageHeader title="Comisiones" subtitle="Tu rol no tiene acceso a esta sección." />;
  }

  const { kpis } = data;

  return (
    <>
      <PageHeader
        title="Comisiones"
        subtitle="Comisiones de vendedores, agencias y bonos por meta."
        info={<InfoTip>Cada comisión guarda la regla con la que se calculó. Una comisión pagada ya no se recalcula: las diferencias se ajustan en el siguiente periodo.</InfoTip>}
        actions={data.can.operate && kpis.pending_reservations > 0 ? <CalculateCommissionsAction pending={kpis.pending_reservations} /> : undefined}
      />
      <section className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <TintTile icon={Hourglass} tone="info" label="Por aprobar" value={formatMoney(kpis.calculada.pen, "PEN", { compact: true })} note={count(kpis.calculada.count)} />
        <TintTile icon={Stamp} tone="sun" label="Aprobado por pagar" value={formatMoney(kpis.aprobada.pen, "PEN", { compact: true })} note={count(kpis.aprobada.count)} />
        <TintTile icon={CircleCheck} tone="ok" label="Pagado" value={formatMoney(kpis.pagada.pen, "PEN", { compact: true })} note={count(kpis.pagada.count)} />
        <TintTile icon={ListChecks} tone="violet" label="Reservas sin comisión" value={kpis.pending_reservations} note="Vendidas y aún sin calcular" />
      </section>
      <div className="mb-5 grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Card>
          <TintCardTitle icon={Users} title="Por beneficiario" aside="En soles" />
          <RankBars tone="t4" empty="Aún no hay comisiones." data={data.by_beneficiary.map((item) => ({ label: item.name, value: item.pen, caption: formatMoney(item.pen), detail: count(item.count) }))} />
        </Card>
        <Card>
          <TintCardTitle icon={UserRound} title="Reglas vigentes" />
          <ul className="grid gap-2">
            {data.rules.map((rule, index) => (
              <li key={rule.condition} style={{ animationDelay: `${index * 70}ms` }} className="lift flex items-center justify-between gap-3 rounded-xl bg-surface-2 px-3.5 py-2.5 animate-[rise-in_420ms_cubic-bezier(0.22,1,0.36,1)_backwards]">
                <span className="text-[13px]">
                  <b className="block font-semibold">{rule.condition}</b>
                  <span className="text-xs text-fg-3">{rule.base}</span>
                </span>
                <span className="font-mono text-[14px] font-bold">{rule.pct === null ? "Convenio" : `${rule.pct.toLocaleString("es-PE")} %`}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
      <CommissionsTable data={data} />
    </>
  );
}
