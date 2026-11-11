import { StarOff } from "lucide-react";
import type { Metadata } from "next";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PassengerReviewView } from "@/features/portal/PassengerReviewView";
import type { PaxReviewOverview } from "@/lib/portal";
import { passengerData } from "@/lib/server/portal";

export const metadata: Metadata = { title: "Califica tu viaje" };

export default async function PortalReviewPage() {
  const data = await passengerData<PaxReviewOverview>("/reviews", "No pudimos cargar tu viaje.");
  if (!data) {
    return (
      <Card className="mx-auto mt-10 max-w-xl">
        <EmptyState icon={<StarOff size={22} />} title="Reseñas no disponibles" description="Tu agencia no tiene activas las reseñas desde el portal." />
      </Card>
    );
  }
  return <PassengerReviewView data={data} />;
}
