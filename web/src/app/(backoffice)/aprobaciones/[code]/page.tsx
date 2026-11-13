import { SearchX } from "lucide-react";
import type { Metadata } from "next";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ApprovalSheet } from "@/features/approvals/ApprovalSheet";
import { approvalSlug, type ApprovalsOverview } from "@/lib/approvals";
import { getCachedResource } from "@/lib/server/resource";

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const { code } = await params;
  return { title: `Aprobación ${decodeURIComponent(code)}` };
}

export default async function ApprovalPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const slug = decodeURIComponent(code);
  const overview = await getCachedResource<ApprovalsOverview>("/approvals", "No pudimos cargar la bandeja de aprobaciones.");
  if (!overview) return null;
  const item = overview.items.find((row) => approvalSlug(row) === slug) ?? overview.items.find((row) => row.code === slug || row.target === slug);

  if (!item) {
    return (
      <Card>
        <EmptyState icon={<SearchX size={22} />} title={`No encontramos la solicitud ${slug}`} description="No existe o tu rol no la puede ver. Vuelve a la bandeja y elige otra." />
      </Card>
    );
  }

  return <ApprovalSheet item={item} cancelReasons={overview.cancel_reasons} />;
}
