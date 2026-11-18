import { ArrowLeftRight, LineChart, PlugZap } from "lucide-react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card } from "@/components/ui/Card";
import { ChartsPanel } from "@/components/ui/ChartsPanel";
import { InfoTip } from "@/components/ui/InfoTip";
import { TabbedCard } from "@/components/ui/RouteTabs";
import { TintCardTitle } from "@/components/ui/Tinted";
import { CurrenciesTable, FxConverter, FxHistoryTable, FxProvidersCard, FxRefreshAction, FxRegisterAction, FxSettingsAction, FxTrendCard } from "@/features/finance/FxRates";
import type { CurrenciesOverview } from "@/lib/admin";
import type { FxOverview } from "@/lib/finance";
import { getFxProviders } from "@/lib/server/financeProviders";
import { getResource } from "@/lib/server/resource";

export const metadata: Metadata = { title: "Monedas y tipo de cambio" };

const BASE = "/admin/monedas";

export default async function MonedasPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const [overview, currencies, providers, params] = await Promise.all([
    getResource<FxOverview>("/finance/fx-rates", "No pudimos cargar el tipo de cambio."),
    getResource<CurrenciesOverview>("/finance/currencies", "No pudimos cargar las monedas."),
    getFxProviders(),
    searchParams,
  ]);
  const activeProvider = providers?.providers.find((provider) => provider.active)?.name ?? null;

  if (!overview) {
    return <PageHeader title="Monedas y tipo de cambio" subtitle="Tu rol no tiene acceso a esta sección." />;
  }

  const tab = params.tab === "historial" || params.tab === "conversor" ? params.tab : "monedas";
  const tabs = [
    ...(currencies ? [{ href: BASE, label: "Monedas", count: currencies.currencies.length }] : []),
    { href: currencies ? `${BASE}?tab=historial` : BASE, label: "Historial", count: overview.history.length },
    ...(currencies ? [{ href: `${BASE}?tab=conversor`, label: "Conversor y proveedor" }] : []),
  ];
  const current = !currencies || tab === "historial" ? tabs.find((item) => item.label === "Historial")?.href : tab === "monedas" ? BASE : `${BASE}?tab=${tab}`;

  return (
    <>
      <PageHeader
        title="Monedas y tipo de cambio"
        subtitle={`Moneda principal: soles (${overview.base}). Cada documento guarda el tipo de cambio de su día.`}
        info={
          <>
            <InfoTip>Los reportes consolidan en soles con el tipo de cambio vigente. Las cotizaciones, reservas y comprobantes conservan el que tenían al emitirse.</InfoTip>
            <ChartsPanel title="Gráficos de tipo de cambio" description="Soles por unidad de cada moneda en los últimos 30 días.">
              <Card>
                <TintCardTitle icon={LineChart} title="Últimos 30 días" aside="Soles por unidad" />
                <FxTrendCard currencies={overview.currencies} alertPct={currencies?.settings.alert_pct} />
              </Card>
            </ChartsPanel>
          </>
        }
        actions={
          <span className="flex flex-wrap gap-2">
            {currencies?.can_manage && <FxSettingsAction settings={currencies.settings} />}
            {providers && overview.can_register && activeProvider && <FxRefreshAction provider={activeProvider} />}
            {overview.can_register && <FxRegisterAction currencies={overview.currencies} />}
          </span>
        }
      />
      <TabbedCard tabs={tabs} active={current}>
        {tab === "historial" || !currencies ? (
          <FxHistoryTable rows={overview.history} currencies={overview.currencies} />
        ) : tab === "conversor" ? (
          <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <Card>
              <TintCardTitle icon={ArrowLeftRight} title="Conversor de prueba" aside={`Margen ${currencies.settings.margin_pct} %`} />
              <FxConverter data={currencies} />
            </Card>
            {providers && providers.providers.length > 0 && (
              <Card>
                <TintCardTitle icon={PlugZap} title="Proveedor de tipo de cambio" aside={activeProvider ? `En uso: ${activeProvider}` : "Solo carga manual"} />
                <FxProvidersCard data={providers} canTest={Boolean(currencies.can_manage)} />
              </Card>
            )}
          </div>
        ) : (
          <>
            <p className="mb-3 text-[13px] text-fg-3">Margen al cliente {currencies.settings.margin_pct} % · alerta de variación {currencies.settings.alert_pct} %</p>
            <CurrenciesTable data={currencies} />
          </>
        )}
      </TabbedCard>
    </>
  );
}
