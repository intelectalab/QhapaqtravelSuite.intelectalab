import type { Metadata } from "next";
import { WebhooksGrid } from "@/features/admin/ApiAccess";
import { getApiAccess } from "@/lib/server/adminSections";

export const metadata: Metadata = { title: "Webhooks" };

export default async function ApiWebhooksPage() {
  const data = await getApiAccess();
  if (!data) return null;
  return <WebhooksGrid data={data} />;
}
