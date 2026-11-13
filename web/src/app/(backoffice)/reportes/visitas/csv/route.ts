import { downloadError } from "@/lib/server/download";
import { sessionToken } from "@/lib/server/session";

const API_URL = process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

export async function GET(request: Request): Promise<Response> {
  const token = await sessionToken();
  if (!token) return downloadError("Tu sesión venció. Vuelve a ingresar para exportar las visitas.", 401);

  const days = new URL(request.url).searchParams.get("days");
  const query = days && /^\d{1,3}$/.test(days) ? `?days=${days}` : "";
  const upstream = await fetch(`${API_URL}/analytics/web/export${query}`, { headers: { Accept: "text/csv", Authorization: `Bearer ${token}` }, cache: "no-store" }).catch(() => null);

  if (upstream === null) return downloadError("No pudimos conectar con el servidor. Inténtalo de nuevo en unos segundos.", 502);
  if (!upstream.ok) {
    const payload = await upstream.json().catch(() => null);
    return downloadError(payload?.message ?? "No pudimos exportar las visitas.", upstream.status);
  }

  return new Response(await upstream.arrayBuffer(), {
    status: 200,
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "text/csv; charset=UTF-8",
      "Content-Disposition": upstream.headers.get("content-disposition") ?? 'attachment; filename="visitas.csv"',
      "Cache-Control": "private, no-store",
    },
  });
}
