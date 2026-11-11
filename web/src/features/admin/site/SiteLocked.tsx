import { Globe } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";

export function SiteLocked() {
  return (
    <Card>
      <EmptyState
        icon={<Globe size={22} />}
        title="El sitio web no está incluido en tu plan"
        description="Con el plan que incluye Sitio web tu agencia tiene su página pública con catálogo, reservas en línea y este editor para cambiar colores, portada, banners, menú y textos sin depender de nadie."
        action={
          <Button href="/admin/suscripcion" variant="primary">
            Ver mi suscripción
          </Button>
        }
      />
    </Card>
  );
}
