import type { Metadata } from "next";
import { DeliveriesTable } from "@/features/admin/ApiAccess";
import { getApiAccess } from "@/lib/server/adminSections";

export const metadata: Metadata = { title: "Log de entregas" };

export default async function ApiEntregasPage({ searchParams }: { searchParams: Promise<{ webhook?: string | string[] }> }) {
  const [data, query] = await Promise.all([getApiAccess(), searchParams]);
  if (!data) return null;
  const webhook = typeof query.webhook === "string" && data.webhooks.some((hook) => hook.code === query.webhook) ? query.webhook : undefined;
  return <DeliveriesTable key={webhook ?? "todas"} data={data} webhook={webhook} />;
}
