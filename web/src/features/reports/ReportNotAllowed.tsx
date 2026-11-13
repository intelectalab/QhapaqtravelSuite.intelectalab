import { Lock } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";

export function ReportNotAllowed({ title }: { title: string }) {
  return (
    <div className="pt-8" data-testid="forbidden-page">
      <Card>
        <EmptyState
          icon={<Lock size={22} />}
          title="El reporte solicitado no está disponible para su rol"
          description={`El reporte ${title} necesita permisos que tu rol no tiene. Si lo necesitas para tu trabajo, pide acceso a la administración de tu agencia.`}
          action={
            <Button href="/reportes" variant="primary">
              Ver mis reportes
            </Button>
          }
        />
      </Card>
    </div>
  );
}
