// Constantes del sitio. El dominio es provisional (spec 22): se cambia solo aquí y en las variables de entorno.
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://rutaslibres.pe').replace(/\/$/, '')
export const SITE_NAME = 'Rutas Libres Perú'
export const LOCALES = ['es', 'en', 'pt'] as const
export type Locale = (typeof LOCALES)[number]
export const HREFLANG: Record<Locale, string> = { es: 'es-PE', en: 'en', pt: 'pt-BR' }

/** Colores de la marca para Open Graph y correos (DESIGN.md «Luminous Nomad»). */
export const BRAND = { primary: '#1D4ED8', coral: '#F95738', emerald: '#059669', ink: '#0F172A', muted: '#64748B', bg: '#F8FAFC' } as const

export const postUrl = (slug: string, locale: Locale = 'es') => `${SITE_URL}${locale === 'es' ? '' : '/' + locale}/blog/${slug}`
