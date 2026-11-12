import { getSiteDestinations, getSiteListing, getSitePosts } from "@/lib/server/site";
import { siteOrigin, sitemapXml } from "@/lib/server/site-seo";

const STATIC_PAGES: { path: string; priority: number }[] = [
  { path: "", priority: 1 },
  { path: "/tours", priority: 0.9 },
  { path: "/destinos", priority: 0.8 },
  { path: "/ofertas", priority: 0.8 },
  { path: "/viajes-a-medida", priority: 0.6 },
  { path: "/blog", priority: 0.6 },
  { path: "/nosotros", priority: 0.5 },
  { path: "/contacto", priority: 0.5 },
  { path: "/libro-reclamaciones", priority: 0.3 },
  { path: "/legal/terminos", priority: 0.2 },
  { path: "/legal/privacidad", priority: 0.2 },
  { path: "/legal/cookies", priority: 0.2 },
  { path: "/legal/cancelacion", priority: 0.2 },
];

export async function GET(_request: Request, { params }: { params: Promise<{ agencia: string }> }) {
  const { agencia } = await params;
  const origin = await siteOrigin(agencia);
  const [listing, destinations, posts] = await Promise.all([
    getSiteListing(agencia, {}).catch(() => null),
    getSiteDestinations(agencia).catch(() => null),
    getSitePosts(agencia).catch(() => null),
  ]);

  const entries = [
    ...STATIC_PAGES.map((page) => ({ url: `${origin}${page.path}`, priority: page.priority })),
    ...(listing?.items ?? []).map((product) => ({ url: `${origin}/tours/${product.slug}`, priority: 0.9 })),
    ...(destinations?.items ?? []).map((destination) => ({ url: `${origin}/destinos/${destination.slug}`, priority: 0.7 })),
    ...(posts ?? []).map((post) => ({ url: `${origin}/blog/${post.slug}`, lastmod: post.published_at, priority: 0.5 })),
  ];

  return new Response(sitemapXml(entries), { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
}
