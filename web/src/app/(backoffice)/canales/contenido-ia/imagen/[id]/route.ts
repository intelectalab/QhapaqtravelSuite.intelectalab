import { apiFile } from "@/lib/server/api";

export async function GET(_request: Request, { params }: RouteContext<"/canales/contenido-ia/imagen/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("La imagen no existe.", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  const upstream = await apiFile(`/cms/ai/images/${encodeURIComponent(id)}/file`);
  if (!upstream.ok || !upstream.body) {
    const status = [401, 403, 404].includes(upstream.status) ? upstream.status : 502;
    return new Response(status === 404 ? "La imagen no existe." : "No pudimos cargar la imagen.", { status, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }
  return new Response(upstream.body, {
    status: 200,
    headers: { "Content-Type": upstream.headers.get("content-type") ?? "image/png", "Cache-Control": "private, max-age=3600", "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'", "X-Content-Type-Options": "nosniff" },
  });
}
