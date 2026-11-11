import type { Metadata } from "next";
import { RulesTable } from "@/features/admin/Rules";
import { getRules } from "@/lib/server/adminSections";

export const metadata: Metadata = { title: "Reglas de reserva" };

export default async function ReglasPage() {
  const data = await getRules();
  if (!data) return null;
  return <RulesTable rules={data.rules} manage={data.can_manage} />;
}
