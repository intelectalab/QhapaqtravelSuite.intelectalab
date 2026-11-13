import { Link2Off } from "lucide-react";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PortalShell } from "@/features/portal/PortalShell";
import { AGENCY_PREVIEW_RETURN } from "@/lib/agency-preview";
import { currentUser } from "@/lib/server/me";
import { PORTAL_HOME, portalSession } from "@/lib/server/portal";

export const metadata: Metadata = { title: { default: "Mi portal", template: "%s · Mi portal" } };

export default async function PortalLayout({ children }: { children: ReactNode }) {
  const me = await currentUser();
  if (me.home !== PORTAL_HOME) redirect(me.home);
  const session = await portalSession();
  const preview = (await cookies()).has(AGENCY_PREVIEW_RETURN);

  return (
    <PortalShell session={session} preview={preview}>
      {session ? (
        children
      ) : (
        <Card className="mx-auto mt-10 max-w-xl">
          <EmptyState icon={<Link2Off size={22} />} title="Tu cuenta aún no está vinculada" description="Escríbenos o llama a tu asesor de viaje para activar tu portal. En cuanto lo vinculemos verás aquí tus viajes, pagos y documentos." />
        </Card>
      )}
    </PortalShell>
  );
}
