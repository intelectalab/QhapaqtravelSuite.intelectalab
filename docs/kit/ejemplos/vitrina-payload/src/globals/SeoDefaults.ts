// Global `seo-defaults`: valores por defecto del sitio que usan generateMetadata, el JSON-LD y el plugin SEO.
import type { GlobalConfig } from 'payload'
import { anyone, seoAndUp } from '../access/roles'

export const SeoDefaults: GlobalConfig = {
  slug: 'seo-defaults',
  label: 'SEO del sitio',
  admin: { group: 'Sitio' },
  access: { read: anyone, update: seoAndUp },
  fields: [
    { name: 'titleTemplate', type: 'text', defaultValue: '%s | Rutas Libres Perú', required: true, admin: { description: '%s se reemplaza por el meta título de la página.' } },
    { name: 'defaultDescription', type: 'textarea', localized: true, maxLength: 160, defaultValue: 'Reserva gratis free tours en Lima, Cusco, Arequipa y Puno con guías locales y agencias verificadas.' },
    { name: 'defaultOgImage', type: 'upload', relationTo: 'media' },
    { name: 'twitterHandle', type: 'text', defaultValue: '@rutaslibrespe' },
    {
      name: 'organization',
      type: 'group',
      label: 'Organización (JSON-LD)',
      fields: [
        { name: 'legalName', type: 'text', defaultValue: 'Rutas Libres Perú' },
        { name: 'logo', type: 'upload', relationTo: 'media' },
        { name: 'sameAs', type: 'text', hasMany: true },
      ],
    },
    {
      name: 'verification',
      type: 'group',
      label: 'Verificación de buscadores',
      fields: [
        { name: 'google', type: 'text', label: 'google-site-verification' },
        { name: 'bing', type: 'text', label: 'msvalidate.01' },
      ],
    },
    { name: 'robotsDisallow', type: 'text', hasMany: true, defaultValue: ['/admin', '/api', '/buscar'], label: 'Rutas bloqueadas en robots.txt' },
  ],
}
