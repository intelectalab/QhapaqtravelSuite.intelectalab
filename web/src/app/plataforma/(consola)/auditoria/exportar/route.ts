import { downloadError } from "@/lib/server/download";
import { apiFile } from "@/lib/server/api";

const PASSTHROUGH = ["content-type", "content-length", "content-disposition"];

const FILTERS = ["days", "entity", "action", "critical", "tenant"];

export async function GET(request: Request) {
  const source = new URL(request.url).searchParams;
  const query = new URLSearchParams();
  for (const name of FILTERS) {
    const value = source.get(name);
    if (value) query.set(name, value);
  }
  const upstream = await apiFile(`/platform/audit-events/export${query.size > 0 ? `?${query}` : ""}`, "platform").catch(() => null);
  if (upstream === null) return downloadError("No pudimos conectar con el servidor. Inténtalo de nuevo en unos segundos.", 502);
  if (!upstream.ok || !upstream.body) {
    const payload = (await upstream.json().catch(() => null)) as { message?: string } | null;
    return downloadError(payload?.message ?? "No pudimos exportar la bitácora.", [401, 403, 422, 429].includes(upstream.status) ? upstream.status : 502);
  }
  const headers = new Headers({ "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" });
  for (const name of PASSTHROUGH) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }
  return new Response(upstream.body, { status: 200, headers });
}
