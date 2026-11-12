import { siteBase } from "@/lib/server/site";
import { SITE_PRIVATE_PATHS, siteOrigin } from "@/lib/server/site-seo";

export async function GET(_request: Request, { params }: { params: Promise<{ agencia: string }> }) {
  const { agencia } = await params;
  const [origin, base] = await Promise.all([siteOrigin(agencia), siteBase(agencia)]);
  const lines = ["User-agent: *", `Allow: ${base || "/"}`, ...SITE_PRIVATE_PATHS.map((path) => `Disallow: ${base}${path}`), "Disallow: /*?*preview=", "", `Sitemap: ${origin}/sitemap.xml`, ""];
  return new Response(lines.join("\n"), { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
}
