import { getRlListings, getRlOverview, getRlPosts, rlOrigin } from "@/lib/server/rutas-libres";

const escapeXml = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export async function GET() {
  const [origin, overview, listings, posts] = await Promise.all([rlOrigin(), getRlOverview(), getRlListings(""), getRlPosts()]);
  const entries: { url: string; priority: number; lastmod?: string | null }[] = [
    { url: origin, priority: 1 },
    { url: `${origin}/agencias`, priority: 0.7 },
    { url: `${origin}/blog`, priority: 0.7 },
    ...overview.cities.map((city) => ({ url: `${origin}/${city.id}`, priority: 0.9 })),
    ...listings.items.map((listing) => ({ url: `${origin}/tour/${listing.slug}`, priority: 0.8, lastmod: listing.updated_at })),
    ...posts.map((post) => ({ url: `${origin}/blog/${post.slug}`, priority: 0.6, lastmod: post.updated_at })),
  ];
  const body = entries.map((entry) => `  <url>\n    <loc>${escapeXml(entry.url)}</loc>${entry.lastmod ? `\n    <lastmod>${entry.lastmod.slice(0, 10)}</lastmod>` : ""}\n    <priority>${entry.priority.toFixed(1)}</priority>\n  </url>`).join("\n");
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`, { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
}
