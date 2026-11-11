import { apiFile } from "@/lib/server/api";

const PASSTHROUGH = ["content-type", "content-length", "content-disposition"];

export async function GET(_request: Request, { params }: RouteContext<"/reportes/exportaciones/[id]/descargar">) {
  const { id } = await params;
  const upstream = await apiFile(`/reports/exports/${encodeURIComponent(id)}/download`);
  if (!upstream.ok || !upstream.body) {
    const status = [401, 403, 404, 410].includes(upstream.status) ? upstream.status : 502;
    const message = status === 410 ? "La exportación venció. Vuelve a generarla desde el reporte." : status === 404 ? "La exportación no existe." : "No pudimos descargar la exportación.";
    return new Response(message, { status, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }
  const headers = new Headers({ "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" });
  for (const name of PASSTHROUGH) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }
  return new Response(upstream.body, { status: 200, headers });
}
