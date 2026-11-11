import { MessageSquareOff } from "lucide-react";
import type { Metadata } from "next";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PassengerFeedbackView } from "@/features/portal/PassengerFeedbackView";
import type { PaxFeedbackOverview } from "@/lib/portal";
import { passengerData } from "@/lib/server/portal";

export const metadata: Metadata = { title: "Comentarios" };

export default async function PortalFeedbackPage() {
  const data = await passengerData<PaxFeedbackOverview>("/feedback", "No pudimos cargar tus comentarios.");
  if (!data) {
    return (
      <Card className="mx-auto mt-10 max-w-xl">
        <EmptyState icon={<MessageSquareOff size={22} />} title="Comentarios no disponibles" description="Tu agencia no tiene activos los comentarios desde el portal. Puedes escribirle desde Mensajes." />
      </Card>
    );
  }
  return <PassengerFeedbackView data={data} />;
}
