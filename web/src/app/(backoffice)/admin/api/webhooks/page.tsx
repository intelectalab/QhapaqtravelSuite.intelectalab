import { Webhook } from "lucide-react";
import type { Metadata } from "next";
import { TintTile } from "@/components/ui/Tinted";
import { WebhooksGrid } from "@/features/admin/ApiAccess";
import { formatNumber } from "@/lib/format";
import { getApiAccess } from "@/lib/server/adminSections";

export const metadata: Metadata = { title: "Webhooks" };

export default async function ApiWebhooksPage() {
  const data = await getApiAccess();
  if (!data) return null;
  const failing = data.webhooks.filter((hook) => hook.failures > 0).length;
  return (
    <>
      <section className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <TintTile icon={Webhook} tone="info" label="Webhooks" value={`${formatNumber(data.webhooks.length)} / ${data.limits.webhooks === null ? "sin límite" : formatNumber(data.limits.webhooks)}`} note={`${formatNumber(data.webhooks.filter((hook) => hook.status === "active").length)} activos · ${formatNumber(failing)} con fallos`} info={<p>Webhooks registrados, activos o pausados, frente al máximo de tu plan.</p>} />
      </section>
      <WebhooksGrid data={data} />
    </>
  );
}
