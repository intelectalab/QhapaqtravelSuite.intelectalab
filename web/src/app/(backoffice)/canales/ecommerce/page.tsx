import { Filter } from "lucide-react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card } from "@/components/ui/Card";
import { InfoTip } from "@/components/ui/InfoTip";
import { TintCardTitle } from "@/components/ui/Tinted";
import { EcommerceFunnel, EcommerceTiles, EcommerceWorkspace } from "@/features/channels/Ecommerce";
import type { EcommerceOverview, PromotionCatalog } from "@/lib/channels";
import { getResource } from "@/lib/server/resource";

export const metadata: Metadata = { title: "E-commerce" };

export default async function EcommercePage() {
  const [overview, promotions] = await Promise.all([
    getResource<EcommerceOverview>("/channels/ecommerce", "No pudimos cargar el canal e-commerce."),
    getResource<PromotionCatalog>("/channels/ecommerce/promotions", "No pudimos cargar las promociones."),
  ]);

  if (!overview) {
    return <PageHeader title="E-commerce" subtitle="Tu rol no tiene acceso a esta sección." />;
  }

  return (
    <>
      <PageHeader
        title="E-commerce"
        subtitle="Ventas en línea desde el sitio web y el widget: pedidos, pagos y productos a la venta."
        info={<InfoTip>Cada pedido crea su reserva y su cuenta por cobrar al primer intento de pago. Solo se anulan pedidos con el pago pendiente o rechazado.</InfoTip>}
      />
      <EcommerceTiles kpis={overview.kpis} />
      <Card className="mb-5">
        <TintCardTitle icon={Filter} title="Embudo de conversión" aside={<InfoTip>Sesiones y vistas salen de los eventos del sitio y del widget; pedidos y pagos, de los pedidos web.</InfoTip>} />
        <EcommerceFunnel steps={overview.funnel} />
      </Card>
      <EcommerceWorkspace overview={overview} promotions={promotions} />
    </>
  );
}
