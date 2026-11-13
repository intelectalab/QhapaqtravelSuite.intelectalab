import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/PageHeader";
import { InfoTip } from "@/components/ui/InfoTip";
import { MarketplaceBoard } from "@/features/growth/MarketplaceBoard";
import type { MarketListings, MarketOrder, MarketPartnership } from "@/lib/growth";
import { getCachedResource } from "@/lib/server/resource";

export const metadata: Metadata = { title: "Marketplace B2B" };

export default async function MarketplacePage() {
  const [network, mine, partnerships, orders] = await Promise.all([
    getCachedResource<MarketListings>("/marketplace/listings", "No pudimos cargar el marketplace."),
    getCachedResource<MarketListings>("/marketplace/listings?filter[scope]=mine", "No pudimos cargar tus publicaciones."),
    getCachedResource<{ partnerships: MarketPartnership[] }>("/marketplace/partnerships", "No pudimos cargar las alianzas."),
    getCachedResource<{ orders: MarketOrder[] }>("/marketplace/orders", "No pudimos cargar las ventas."),
  ]);

  if (!network || !mine) {
    return <PageHeader title="Marketplace B2B" subtitle="Tu rol no tiene acceso a esta sección." />;
  }

  return (
    <>
      <PageHeader
        title="Marketplace B2B"
        subtitle="Publica tus productos para otras agencias y vende los de operadores aliados."
        info={<InfoTip>El revendedor ve el precio público menos su comisión y vende con su margen. Cada venta crea la reserva en la agencia que opera el servicio. La plataforma cobra el 1 % al vendedor en su suscripción.</InfoTip>}
      />
      <MarketplaceBoard network={network} mine={mine} partnerships={partnerships?.partnerships ?? []} orders={orders?.orders ?? []} />
    </>
  );
}
