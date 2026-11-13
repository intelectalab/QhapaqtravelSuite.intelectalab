import { ArrowLeftRight, Coins, History, LineChart, PlugZap } from "lucide-react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card } from "@/components/ui/Card";
import { InfoTip } from "@/components/ui/InfoTip";
import { TintCardTitle } from "@/components/ui/Tinted";
import { CurrenciesTable, FxCards, FxConverter, FxHistoryTable, FxProvidersCard, FxRefreshAction, FxRegisterAction, FxSettingsAction, FxTrendCard, type FxProvidersData } from "@/features/finance/FxRates";
import type { CurrenciesOverview } from "@/lib/admin";
import type { FxOverview } from "@/lib/finance";
import { getResource } from "@/lib/server/resource";

export const metadata: Metadata = { title: "Monedas y tipo de cambio" };

export default async function MonedasPage() {
  const [overview, currencies, providers] = await Promise.all([
    getResource<FxOverview>("/finance/fx-rates", "No pudimos cargar el tipo de cambio."),
    getResource<CurrenciesOverview>("/finance/currencies", "No pudimos cargar las monedas."),
    getResource<FxProvidersData>("/finance/fx-providers", "No pudimos cargar los proveedores de tipo de cambio."),
  ]);
  const activeProvider = providers?.providers.find((provider) => provider.active)?.name ?? null;

  if (!overview) {
    return <PageHeader title="Monedas y tipo de cambio" subtitle="Tu rol no tiene acceso a esta sección." />;
  }

  return (
    <>
      <PageHeader
        title="Monedas y tipo de cambio"
        subtitle={`Moneda principal: soles (${overview.base}). Cada documento guarda el tipo de cambio de su día.`}
        info={<InfoTip>Los reportes consolidan en soles con el tipo de cambio vigente. Las cotizaciones, reservas y comprobantes conservan el que tenían al emitirse.</InfoTip>}
        actions={
          <span className="flex flex-wrap gap-2">
            {currencies?.can_manage && <FxSettingsAction settings={currencies.settings} />}
            {providers && overview.can_register && activeProvider && <FxRefreshAction provider={activeProvider} />}
            {overview.can_register && <FxRegisterAction currencies={overview.currencies} />}
          </span>
        }
      />
      <FxCards currencies={overview.currencies} />
      <div className="mb-5 grid items-start gap-5 xl:grid-cols-2">
        <Card>
          <TintCardTitle icon={LineChart} title="Últimos 30 días" aside="Soles por unidad" />
          <FxTrendCard currencies={overview.currencies} alertPct={currencies?.settings.alert_pct} />
        </Card>
        {currencies && (
          <Card>
            <TintCardTitle icon={ArrowLeftRight} title="Conversor de prueba" aside={`Margen ${currencies.settings.margin_pct} %`} />
            <FxConverter data={currencies} />
          </Card>
        )}
      </div>
      {currencies && (
        <Card className="mb-5">
          <TintCardTitle icon={Coins} title="Monedas" aside={`Margen al cliente ${currencies.settings.margin_pct} % · alerta ${currencies.settings.alert_pct} %`} />
          <CurrenciesTable data={currencies} />
        </Card>
      )}
      {providers && providers.providers.length > 0 && (
        <Card className="mb-5">
          <TintCardTitle icon={PlugZap} title="Proveedores de tipo de cambio" aside={activeProvider ? `En uso: ${activeProvider}` : "Sin proveedor activo"} />
          <FxProvidersCard data={providers} canTest={Boolean(currencies?.can_manage)} />
        </Card>
      )}
      <Card>
        <TintCardTitle icon={History} title="Historial" aside={`${overview.history.length} registros`} />
        <FxHistoryTable rows={overview.history} />
      </Card>
    </>
  );
}
