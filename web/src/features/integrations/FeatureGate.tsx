import { Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import { PageHeader } from "@/components/shell/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { featureOf, type PlatformFeatureKey } from "@/lib/integrations";
import { getReadiness } from "@/lib/server/integrations";

export function ComingSoon({ title, message }: { title: string; message: string | null }) {
  return (
    <div data-testid="coming-soon">
      <PageHeader title={title} subtitle="Esta función depende de un proveedor que KipuControl todavía no activa." />
      <Card>
        <EmptyState icon={<Sparkles size={20} />} title="Próximamente" description={message ?? "Esta función estará disponible próximamente."} action={<Badge tone="t4">Te avisaremos cuando esté lista</Badge>} />
      </Card>
    </div>
  );
}

export async function comingSoon(feature: PlatformFeatureKey, title: string): Promise<ReactNode | null> {
  const state = featureOf(await getReadiness(), feature);
  return state.available ? null : <ComingSoon title={title} message={state.message} />;
}
