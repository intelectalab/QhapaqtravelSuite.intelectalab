import { Link2Off } from "lucide-react";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { AgencyShell } from "@/features/b2b-portal/AgencyShell";
import { AGENCY_PREVIEW_RETURN } from "@/lib/agency-preview";
import { AGENCY_HOME } from "@/lib/b2b-portal";
import { agencySession } from "@/lib/server/b2b-portal";
import { currentUser } from "@/lib/server/me";

export const metadata: Metadata = { title: { default: "Portal de agencias", template: "%s · Portal de agencias" } };

export default async function AgencyLayout({ children }: { children: ReactNode }) {
  const me = await currentUser();
  if (me.home !== AGENCY_HOME) redirect(me.home);
  const session = await agencySession();
  const preview = (await cookies()).has(AGENCY_PREVIEW_RETURN);

  return (
    <AgencyShell session={session} preview={preview}>
      {session ? (
        children
      ) : (
        <Card className="mx-auto mt-10 max-w-xl">
          <EmptyState icon={<Link2Off size={22} />} title="Tu usuario aún no está vinculado" description="Tu usuario no está vinculado a una agencia con convenio vigente. Escríbenos para activarlo y ver aquí tu catálogo, reservas y estado de cuenta." />
        </Card>
      )}
    </AgencyShell>
  );
}
