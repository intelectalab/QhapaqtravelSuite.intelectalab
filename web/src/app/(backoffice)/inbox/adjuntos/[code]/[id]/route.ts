import { apiFile } from "@/lib/server/api";

const PASSTHROUGH = ["content-type", "content-length", "content-disposition"];

export async function GET(request: Request, { params }: { params: Promise<{ code: string; id: string }> }) {
  const { code, id } = await params;
  const inline = new URL(request.url).searchParams.get("ver") === "1";
  const upstream = await apiFile(`/inbox/conversations/${encodeURIComponent(code)}/attachments/${encodeURIComponent(id)}${inline ? "?inline=1" : ""}`);
  if (!upstream.ok || !upstream.body) {
    const status = [401, 403, 404, 409].includes(upstream.status) ? upstream.status : 502;
    return new Response(status === 404 ? "El adjunto ya no está disponible." : status === 409 ? "El adjunto no pasó la revisión antivirus." : "No pudimos abrir el adjunto.", { status, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }
  const headers = new Headers({ "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" });
  for (const name of PASSTHROUGH) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }
  return new Response(upstream.body, { status: 200, headers });
}
