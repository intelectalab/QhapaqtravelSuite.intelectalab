import { siteRequestHeaders } from "@/lib/server/site";

const API_URL = process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

export async function GET(_request: Request, { params }: RouteContext<"/sitio/[agencia]/imagen/[id]">) {
  const { agencia, id } = await params;
  if (!UUID.test(id)) return new Response(null, { status: 404 });

  const upstream = await fetch(`${API_URL}/public/site/images/${id}`, { headers: { Accept: "image/*", ...(await siteRequestHeaders(agencia)) }, cache: "no-store" }).catch(() => null);
  const type = upstream?.headers.get("content-type") ?? "";

  if (!upstream?.ok || !upstream.body || !IMAGE_TYPES.includes(type)) return new Response(null, { status: upstream?.status === 404 ? 404 : 502 });

  return new Response(upstream.body, { status: 200, headers: { "Content-Type": type, "Cache-Control": "public, max-age=86400, immutable", "X-Content-Type-Options": "nosniff" } });
}
