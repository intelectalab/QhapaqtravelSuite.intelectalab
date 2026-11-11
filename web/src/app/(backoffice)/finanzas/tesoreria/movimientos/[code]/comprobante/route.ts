import { apiFile } from "@/lib/server/api";

const PASSTHROUGH = ["content-type", "content-length", "content-disposition"];

export async function GET(_request: Request, { params }: RouteContext<"/finanzas/tesoreria/movimientos/[code]/comprobante">) {
  const { code } = await params;
  const upstream = await apiFile(`/treasury/movements/${encodeURIComponent(code)}/receipt`);
  if (!upstream.ok || !upstream.body) {
    const status = [401, 403, 404].includes(upstream.status) ? upstream.status : 502;
    return new Response(status === 404 ? "Este gasto no tiene un comprobante adjunto." : "No pudimos abrir el comprobante.", { status, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }
  const headers = new Headers({ "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" });
  for (const name of PASSTHROUGH) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }
  return new Response(upstream.body, { status: 200, headers });
}
