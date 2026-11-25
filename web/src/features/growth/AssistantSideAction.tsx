import type { AssistantContext, AssistantSourceType } from "@/lib/assistant";
import { featureOf } from "@/lib/integrations";
import { apiFetch } from "@/lib/server/api";
import { getReadiness } from "@/lib/server/integrations";
import { currentUser } from "@/lib/server/me";
import { AssistantSidePanel } from "./AssistantSidePanel";

export async function AssistantSideAction({ type, code, returnPath, label }: { type: AssistantSourceType; code: string; returnPath: string; label?: string }) {
  const [me, readiness] = await Promise.all([currentUser(), getReadiness()]);
  if (!me.permissions.includes("ai.assistant.use")) return null;
  const feature = featureOf(readiness, "sales_ai");
  const result = feature.available ? await apiFetch<AssistantContext>(`/ai/context?${new URLSearchParams({ source_type: type, source_code: code }).toString()}`) : null;
  if (result && result.status === 404) return null;
  const context = result?.ok && result.data ? result.data : null;
  return <AssistantSidePanel source={{ type, code }} context={context} available={feature.available} unavailableMessage={feature.message} returnPath={returnPath} label={label} />;
}
