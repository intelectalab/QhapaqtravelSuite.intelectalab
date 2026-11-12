// /blog/sitemap.xml — sitemap propio del blog (BLG-06), con hreflang. Las ciudades, tours y agencias
// tienen el suyo (/sitemaps/*.xml, spec 22); /sitemap.xml es el índice que los lista.
import { listPublished } from '../../../../lib/posts'
import { HREFLANG, LOCALES, postUrl, SITE_URL } from '../../../../lib/site'

export const revalidate = 3600

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;')

export async function GET() {
  const posts = await listPublished('es')
  const urls = posts
    .map((p) => {
      const alts = LOCALES.map((l) => `<xhtml:link rel="alternate" hreflang="${HREFLANG[l]}" href="${esc(postUrl(p.slug, l))}"/>`).join('')
      return `<url><loc>${esc(postUrl(p.slug))}</loc><lastmod>${new Date(p.updatedAt).toISOString()}</lastmod>${alts}</url>`
    })
    .join('')
  const xml = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml"><url><loc>${SITE_URL}/blog</loc></url>${urls}</urlset>`
  return new Response(xml, { headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public, s-maxage=3600, stale-while-revalidate=86400' } })
}
