import type { Metadata } from "next";
import { AgencyStatementView } from "@/features/b2b-portal/AgencyStatement";
import type { AgencyStatement } from "@/lib/b2b-portal";
import { agencyData } from "@/lib/server/b2b-portal";

export const metadata: Metadata = { title: "Estado de cuenta" };

export default async function AgencyStatementPage() {
  const statement = await agencyData<AgencyStatement>("/statement", "No pudimos cargar tu estado de cuenta.");
  if (!statement) return null;
  return <AgencyStatementView statement={statement} />;
}
