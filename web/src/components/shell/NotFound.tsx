import { SearchX } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";

export function NotFound({ home = "/" }: { home?: string }) {
  return (
    <div className="pt-8" data-testid="not-found-page">
      <Card>
        <EmptyState
          icon={<SearchX size={22} />}
          title="No encontramos lo que buscas"
          description="El registro no existe, se archivó o el enlace cambió. Revisa la dirección o vuelve al inicio."
          action={
            <Button href={home} variant="primary">
              Ir al inicio
            </Button>
          }
        />
      </Card>
    </div>
  );
}
