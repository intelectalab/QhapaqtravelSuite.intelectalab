import { ShieldAlert } from "lucide-react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card } from "@/components/ui/Card";
import { InfoTip } from "@/components/ui/InfoTip";
import { Tabs } from "@/components/ui/Tabs";
import { ToneScope } from "@/components/ui/Tinted";
import { AgencyFormAction, B2bAgenciesTable, B2bTiles } from "@/features/channels/B2bAgencies";
import { B2bPriceListsTable } from "@/features/channels/B2bPriceLists";
import type { B2bOverview, B2bProductRates } from "@/lib/channels";
import { formatDate, formatMoney } from "@/lib/format";
import { getResource } from "@/lib/server/resource";

export const metadata: Metadata = { title: "B2B agencias" };

export default async function B2bPage() {
  const [overview, rates] = await Promise.all([
    getResource<B2bOverview>("/channels/b2b", "No pudimos cargar las agencias."),
    getResource<B2bProductRates>("/channels/b2b/product-rates", "No pudimos cargar las listas de precios."),
  ]);

  if (!overview) {
    return <PageHeader title="B2B agencias" subtitle="Tu rol no tiene acceso a esta sección." />;
  }

  const catalogs = { price_lists: overview.price_lists, clients: overview.clients };
  const restricted = overview.items.filter((agency) => ["bloqueada", "vencida"].includes(agency.effective_status));

  return (
    <>
      <PageHeader
        title="B2B agencias"
        subtitle="Agencias aliadas que revenden tus servicios con tarifa neta, comisión y línea de crédito."
        info={<InfoTip>Una agencia con el crédito excedido o el convenio vencido no puede reservar a crédito. El crédito se libera cuando Finanzas aplica sus pagos.</InfoTip>}
        actions={overview.can_manage ? <AgencyFormAction catalogs={catalogs} /> : undefined}
      />
      <B2bTiles kpis={overview.kpis} />
      {restricted.length > 0 && (
        <ToneScope tone="bad" className="mb-5">
          <div className="flex flex-wrap items-start gap-3 rounded-tile border border-[color-mix(in_srgb,var(--tint)_30%,transparent)] bg-[color-mix(in_srgb,var(--tint)_7%,var(--surface))] px-4 py-3">
            <ShieldAlert size={19} className="mt-0.5 text-[var(--tint)]" />
            <div className="min-w-0 flex-1">
              <p className="text-[13.5px] font-semibold">Agencias con restricción</p>
              <ul className="mt-1 flex flex-col gap-0.5 text-[12.5px] text-fg-2">
                {restricted.map((agency) => (
                  <li key={agency.code}>
                    <b className="font-semibold text-fg">{agency.legal_name}</b>
                    {agency.effective_status === "vencida"
                      ? ` · convenio vencido el ${formatDate(agency.valid_to)}`
                      : ` · bloqueada${agency.credit_limit > 0 ? `, usa ${formatMoney(agency.credit_used, agency.currency)} de ${formatMoney(agency.credit_limit, agency.currency)}` : ""}`}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </ToneScope>
      )}
      <Card padded={false}>
        <Tabs
          tabs={[
            { id: "agencies", label: "Agencias", count: overview.items.length, content: <B2bAgenciesTable rows={overview.items} catalogs={catalogs} canManage={overview.can_manage} /> },
            ...(rates ? [{ id: "prices", label: "Listas de precios", count: rates.products.length, content: <B2bPriceListsTable data={rates} canManage={overview.can_manage} /> }] : []),
          ]}
        />
      </Card>
    </>
  );
}
