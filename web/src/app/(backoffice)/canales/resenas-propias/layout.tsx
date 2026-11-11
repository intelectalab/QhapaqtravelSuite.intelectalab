import type { ReactNode } from "react";
import { PathSectionNav } from "@/components/ui/PathSectionNav";
import { SectionLayout } from "@/components/ui/SectionNav";
import { LayoutDashboard, Send, Settings, ShieldCheck, Star } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { InfoTip } from "@/components/ui/InfoTip";
import { OwnReviewTiles } from "@/features/channels/OwnReviews";
import type { OwnReviewsOverview } from "@/lib/channels";
import { getCachedResource } from "@/lib/server/resource";

export default async function OwnReviewsLayout({ children }: { children: ReactNode }) {
  const overview = await getCachedResource<OwnReviewsOverview>("/reviews", "No pudimos cargar las reseñas.");

  if (!overview) {
    return <PageHeader title="Reseñas de clientes" subtitle="Tu rol no tiene acceso a esta sección." />;
  }

  return (
    <>
      <PageHeader
        title="Reseñas de clientes"
        subtitle={overview.own_only ? "Opiniones de los viajeros de tu cartera." : "Opiniones de viajeros con reserva real, listas para el sitio y el widget."}
        info={<InfoTip>Solo opinan pasajeros de viajes realizados. Se publica con el consentimiento del viajero; rechazar u ocultar exige un motivo y la nota nunca lo es.</InfoTip>}
      />
      <OwnReviewTiles kpis={overview.kpis} />
      <SectionLayout
        nav={
          <PathSectionNav
            label="Secciones de reseñas"
            testId="reviews-nav"
            groups={[
              {
                title: "Reseñas de clientes",
                items: [
                  { href: "/canales/resenas-propias", label: "Resumen", icon: <LayoutDashboard size={16} /> },
                  { href: "/canales/resenas-propias/moderacion", label: "Por moderar", count: overview.items.filter((review) => review.status === "pendiente").length, icon: <ShieldCheck size={16} /> },
                  { href: "/canales/resenas-propias/todas", label: "Todas las reseñas", count: overview.items.length, icon: <Star size={16} /> },
                  { href: "/canales/resenas-propias/invitaciones", label: "Invitaciones", count: overview.requests.length, icon: <Send size={16} /> },
                  ...(overview.can_moderate ? [{ href: "/canales/resenas-propias/ajustes", label: "Ajustes", icon: <Settings size={16} /> }] : []),
                ],
              },
            ]}
          />
        }
      >
        {children}
      </SectionLayout>
    </>
  );
}
