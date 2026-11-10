import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import type { LockedFeature } from "@/lib/access";

export function FeatureLocked({ feature, home, canManagePlan }: { feature: LockedFeature; home: string; canManagePlan: boolean }) {
  return (
    <div className="pt-8" data-testid="feature-locked-page">
      <Card>
        <EmptyState
          icon={<Sparkles size={22} />}
          title={`${feature.label} no está incluido en tu plan`}
          description={
            canManagePlan
              ? "Tus datos se conservan. Al mejorar el plan, esta sección se habilita para todo el equipo."
              : "Tus datos se conservan. Si tu equipo la necesita, pide a la administración de tu agencia que mejore el plan."
          }
          action={
            canManagePlan ? (
              <Button href="/admin/suscripcion" variant="primary">
                Ver mi suscripción
              </Button>
            ) : (
              <Button href={home} variant="primary">
                Ir al inicio
              </Button>
            )
          }
        />
      </Card>
    </div>
  );
}
