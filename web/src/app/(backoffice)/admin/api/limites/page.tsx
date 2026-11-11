import type { Metadata } from "next";
import { ApiLimits } from "@/features/admin/ApiAccess";
import { getApiAccess } from "@/lib/server/adminSections";

export const metadata: Metadata = { title: "Límites y rate limit" };

export default async function ApiLimitesPage() {
  const data = await getApiAccess();
  if (!data) return null;
  return <ApiLimits data={data} />;
}
