// /robots.txt — bloquea el panel y la API; publica el índice de sitemaps.
import type { MetadataRoute } from 'next'
import { SITE_URL } from '../lib/site'

export default function robots(): MetadataRoute.Robots {
  const production = process.env.VERCEL_ENV === 'production' || process.env.APP_ENV === 'production'
  return {
    rules: production ? [{ userAgent: '*', allow: '/', disallow: ['/admin', '/api', '/buscar', '/*?preview='] }] : [{ userAgent: '*', disallow: '/' }],
    sitemap: [`${SITE_URL}/sitemap.xml`, `${SITE_URL}/blog/sitemap.xml`],
    host: SITE_URL,
  }
}
