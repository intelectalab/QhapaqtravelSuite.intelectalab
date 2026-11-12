// Payload 3 dentro de la app Next.js de la vitrina (apps/vitrina). Spec 24 §13.1.
// Base propia `rutaslibres_cms` con el rol `payload_role`: no comparte esquema ni RLS con KipuControl.
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildConfig } from 'payload'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { seoPlugin } from '@payloadcms/plugin-seo'
import { redirectsPlugin } from '@payloadcms/plugin-redirects'
import { nestedDocsPlugin } from '@payloadcms/plugin-nested-docs'
import { s3Storage } from '@payloadcms/storage-s3'
import { Posts } from './collections/Posts'
import { Authors, Categories, Cities, Tags } from './collections/taxonomy'
import { Media, Pages, Users } from './collections/system'
import { SeoDefaults } from './globals/SeoDefaults'
import { seoAndUp } from './access/roles'
import { SEO_LIMITS } from './lib/seo-rules'
import { SITE_NAME, SITE_URL } from './lib/site'

const dirname = path.dirname(fileURLToPath(import.meta.url))

type SeoDoc = { title?: string; excerpt?: string; slug?: string; heroImage?: unknown }

export default buildConfig({
  serverURL: SITE_URL,
  secret: process.env.PAYLOAD_SECRET as string,
  admin: {
    user: Users.slug,
    meta: { titleSuffix: ' · CMS Rutas Libres' },
    importMap: { baseDir: path.resolve(dirname) },
    dateFormat: 'dd/MM/yyyy HH:mm',
  },
  collections: [Posts, Categories, Cities, Tags, Authors, Media, Pages, Users],
  globals: [SeoDefaults],
  editor: lexicalEditor({}),
  localization: {
    locales: [
      { label: 'Español', code: 'es' },
      { label: 'English', code: 'en' },
      { label: 'Português', code: 'pt' },
    ],
    defaultLocale: 'es',
    fallback: true,
  },
  i18n: { fallbackLanguage: 'es' },
  db: postgresAdapter({
    pool: { connectionString: process.env.DATABASE_URI },
    schemaName: 'payload',
    migrationDir: path.resolve(dirname, 'migrations'),
    push: false, // en todos los entornos se usan migraciones (pipeline propio, spec 24 §13.1)
  }),
  typescript: { outputFile: path.resolve(dirname, 'payload-types.ts') },
  cors: [SITE_URL],
  csrf: [SITE_URL],
  graphQL: { disable: true },
  plugins: [
    seoPlugin({
      collections: ['posts', 'pages'],
      globals: [],
      uploadsCollection: 'media',
      tabbedUI: true,
      generateTitle: ({ doc }) => {
        const t = (doc as SeoDoc)?.title ?? ''
        return t.length > SEO_LIMITS.metaTitle.max ? t.slice(0, SEO_LIMITS.metaTitle.max - 1).trimEnd() + '…' : t
      },
      generateDescription: ({ doc }) => ((doc as SeoDoc)?.excerpt ?? '').slice(0, SEO_LIMITS.metaDescription.max),
      generateURL: ({ doc, collectionSlug }) => `${SITE_URL}${collectionSlug === 'posts' ? '/blog' : ''}/${(doc as SeoDoc)?.slug ?? ''}`,
      generateImage: ({ doc }) => {
        const h = (doc as SeoDoc)?.heroImage
        return (h && typeof h === 'object' ? (h as { id: string }).id : (h as string)) ?? ''
      },
      fields: ({ defaultFields }) => [
        ...defaultFields,
        { name: 'ogTitle', type: 'text', label: 'Título para redes (opcional)', localized: true, maxLength: 90 },
      ],
    }),
    redirectsPlugin({
      collections: ['posts', 'pages'],
      redirectTypes: ['301', '302'],
      overrides: {
        admin: { group: 'Sitio' },
        access: { read: () => true, create: seoAndUp, update: seoAndUp, delete: seoAndUp },
      },
    }),
    nestedDocsPlugin({
      collections: ['categories'],
      generateLabel: (_, doc) => String((doc as { name?: string }).name ?? ''),
      generateURL: (docs) => docs.reduce((url, d) => `${url}/${String((d as { slug?: string }).slug ?? '')}`, ''),
    }),
    s3Storage({
      collections: { media: { prefix: 'blog' } },
      bucket: process.env.S3_BUCKET as string,
      config: {
        region: process.env.S3_REGION,
        endpoint: process.env.S3_ENDPOINT || undefined,
        credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID as string, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY as string },
        forcePathStyle: Boolean(process.env.S3_ENDPOINT),
      },
    }),
  ],
  onInit: async (payload) => {
    payload.logger.info(`${SITE_NAME} CMS listo en ${SITE_URL}/admin`)
  },
})
