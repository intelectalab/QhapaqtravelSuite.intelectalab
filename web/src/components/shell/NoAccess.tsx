import { Lock } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";

export function NoAccess({ home }: { home: string }) {
  return (
    <div className="pt-8">
      <Card>
        <EmptyState
          icon={<Lock size={22} />}
          title="Esta sección no está disponible para tu rol"
          description="Si la necesitas para tu trabajo, pide a la administración de tu agencia que te dé acceso."
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
