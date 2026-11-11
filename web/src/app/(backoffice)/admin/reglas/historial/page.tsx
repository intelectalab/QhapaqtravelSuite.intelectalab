import type { Metadata } from "next";
import { RuleChangesTable } from "@/features/admin/Rules";
import { getRuleChanges } from "@/lib/server/adminSections";

export const metadata: Metadata = { title: "Historial de reglas" };

export default async function ReglasHistorialPage() {
  const entries = await getRuleChanges();
  if (!entries) return null;
  return <RuleChangesTable entries={entries} />;
}
