import { Cookie, Lock, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import { TagsTable } from "@/features/tracking/TrackingTags";
import { StepCard } from "@/features/tracking/StepCard";
import { getCachedResource } from "@/lib/server/resource";
import type { TrackingOverview } from "@/lib/tracking";
import { createTag, tagAction, updateTag } from "./actions";

export const metadata: Metadata = { title: "Seguimiento y píxeles" };

export default async function SeguimientoPage() {
  const overview = await getCachedResource<TrackingOverview>("/marketing/tracking/tags", "No pudimos cargar las etiquetas del sitio.");
  if (!overview) return null;

  return (
    <div className="flex flex-col gap-6">
      <TagsTable
        screen="seguimiento-etiquetas"
        rows={overview.rows.filter((row) => row.provider !== "script")}
        providers={overview.providers}
        canManage={overview.can_manage}
        canApprove={false}
        me={overview.me}
        selfApprovalBlocked={overview.admins >= 2}
        actions={{ create: createTag, update: updateTag, act: tagAction, initial: { message: null, done: false } }}
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <StepCard icon={Cookie} title="Primero el consentimiento">
          Antes de cualquier etiqueta se carga Consent Mode v2 con todo denegado. Analíticas activa GA4, GTM y Clarity; marketing activa Google Ads, Meta, TikTok y LinkedIn.
        </StepCard>
        <StepCard icon={ShieldCheck} title="Código generado por KipuControl">
          Solo pegas el ID. El código de cada proveedor sale de plantillas propias; lo que no esté en la lista va como script propio con revisión.
        </StepCard>
        <StepCard icon={Lock} title="El pago queda limpio">
          En el checkout no carga ningún script propio ni de terceros no esencial. Las visitas se cuentan también sin cookies, sin datos personales.
        </StepCard>
      </div>
    </div>
  );
}
