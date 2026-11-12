// Colección `posts`: las entradas del blog de Rutas Libres (spec 24 §13.1).
// Pestañas del panel: Contenido · Relaciones · SEO (la agrega @payloadcms/plugin-seo con tabbedUI).
// Barra lateral: slug, palabra clave, fecha de publicación, métricas calculadas y semáforo SEO.
import type { CollectionConfig } from 'payload'
import {
  BlocksFeature,
  FixedToolbarFeature,
  HeadingFeature,
  InlineToolbarFeature,
  lexicalEditor,
} from '@payloadcms/richtext-lexical'
import { POST_BLOCKS } from '../blocks'
import { ownPostsOrEditors, publishedOrLoggedIn, editorsAndUp, isLoggedIn, hasRole } from '../access/roles'
import { slugField } from '../fields/slug'
import { seoGuard } from '../hooks/seoGuard'
import { onlyEditorsPublish } from '../hooks/onlyEditorsPublish'
import { slugRedirect } from '../hooks/slugRedirect'
import { syncKipu, syncKipuDelete } from '../hooks/syncKipu'
import { revalidatePost, revalidatePostDelete } from '../hooks/revalidate'
import { SITE_URL } from '../lib/site'

export const Posts: CollectionConfig = {
  slug: 'posts',
  labels: { singular: 'Entrada', plural: 'Entradas' },
  admin: {
    useAsTitle: 'title',
    group: 'Blog',
    defaultColumns: ['title', 'city', 'author', '_status', 'seoScore', 'publishedAt', 'updatedAt'],
    listSearchableFields: ['title', 'slug', 'focusKeyword'],
    livePreview: {
      url: ({ data, locale }) => `${SITE_URL}/blog/${data?.slug ?? ''}?preview=1&locale=${locale?.code ?? 'es'}`,
      breakpoints: [
        { label: 'Móvil', name: 'mobile', width: 390, height: 844 },
        { label: 'Escritorio', name: 'desktop', width: 1280, height: 900 },
      ],
    },
    preview: (doc) => `${SITE_URL}/blog/${String(doc?.slug ?? '')}?preview=1`,
  },
  access: {
    read: publishedOrLoggedIn,
    create: isLoggedIn,
    update: ownPostsOrEditors,
    delete: editorsAndUp,
    readVersions: isLoggedIn,
  },
  versions: {
    drafts: { autosave: { interval: 800 }, schedulePublish: true, validate: false },
    maxPerDoc: 50,
  },
  defaultPopulate: { title: true, slug: true, excerpt: true, heroImage: true, city: true, publishedAt: true, readingMinutes: true, categories: true },
  fields: [
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Contenido',
          fields: [
            { name: 'title', type: 'text', required: true, localized: true, maxLength: 110, label: 'Título (H1)' },
            { name: 'titleAccent', type: 'text', localized: true, label: 'Parte del título resaltada', admin: { description: 'Debe ser el final exacto del título; se pinta en cobalto.' } },
            { name: 'kicker', type: 'text', localized: true, label: 'Antetítulo', admin: { description: 'Ej.: «Guía de barrio · Lima 2026»' } },
            { name: 'excerpt', type: 'textarea', required: true, localized: true, maxLength: 220, label: 'Entradilla' },
            {
              type: 'row',
              fields: [
                { name: 'heroImage', type: 'upload', relationTo: 'media', required: true, label: 'Portada', admin: { width: '50%' } },
                { name: 'heroCaption', type: 'text', localized: true, label: 'Pie de foto', admin: { width: '50%' } },
              ],
            },
            {
              name: 'content',
              type: 'richText',
              required: true,
              localized: true,
              label: 'Contenido',
              editor: lexicalEditor({
                features: ({ defaultFeatures }) => [
                  // El título es el único H1 de la página (BLG-01): el editor solo ofrece H2 a H4.
                  ...defaultFeatures.filter((f) => f.key !== 'heading'),
                  HeadingFeature({ enabledHeadingSizes: ['h2', 'h3', 'h4'] }),
                  BlocksFeature({ blocks: POST_BLOCKS }),
                  FixedToolbarFeature(),
                  InlineToolbarFeature(),
                ],
              }),
            },
            {
              name: 'faq',
              type: 'array',
              label: 'Preguntas frecuentes (FAQPage)',
              admin: { description: 'Se publican al final y como datos estructurados FAQPage.' },
              fields: [
                { name: 'question', type: 'text', required: true, localized: true },
                { name: 'answer', type: 'textarea', required: true, localized: true },
              ],
            },
          ],
        },
        {
          label: 'Relaciones',
          fields: [
            { name: 'author', type: 'relationship', relationTo: 'authors', required: true },
            { name: 'categories', type: 'relationship', relationTo: 'categories', hasMany: true, required: true, minRows: 1 },
            { name: 'city', type: 'relationship', relationTo: 'cities', admin: { description: 'Si la entrada es de una ciudad, exige 3 tours de la vitrina (BLG-02).' } },
            { name: 'tags', type: 'relationship', relationTo: 'tags', hasMany: true },
            {
              name: 'relatedPosts',
              type: 'relationship',
              relationTo: 'posts',
              hasMany: true,
              maxRows: 3,
              filterOptions: ({ id }) => ({ id: { not_equals: id } }),
            },
          ],
        },
      ],
    },
    // ---- Barra lateral
    slugField('title'),
    { name: 'focusKeyword', type: 'text', required: true, label: 'Palabra clave principal', admin: { position: 'sidebar' } },
    { name: 'publishedAt', type: 'date', label: 'Fecha de publicación', admin: { position: 'sidebar', date: { pickerAppearance: 'dayAndTime' } } },
    {
      name: 'noindex',
      type: 'checkbox',
      defaultValue: false,
      label: 'No indexar (noindex)',
      admin: { position: 'sidebar' },
      access: { update: ({ req }) => hasRole(req, 'editor', 'seo') },
    },
    { name: 'canonicalUrl', type: 'text', label: 'URL canónica (opcional)', admin: { position: 'sidebar', description: 'Vacío = la URL de la entrada.' } },
    { name: 'wordCount', type: 'number', admin: { position: 'sidebar', readOnly: true } },
    { name: 'readingMinutes', type: 'number', label: 'Minutos de lectura', admin: { position: 'sidebar', readOnly: true } },
    { name: 'seoScore', type: 'number', label: 'Puntaje SEO', admin: { position: 'sidebar', readOnly: true } },
    { name: 'seoChecks', type: 'json', admin: { position: 'sidebar', readOnly: true, description: 'Resultado de las reglas BLG-01/02 en el último guardado.' } },
    {
      name: 'createdBy',
      type: 'relationship',
      relationTo: 'users',
      admin: { position: 'sidebar', readOnly: true },
      hooks: { beforeChange: [({ req, operation, value }) => (operation === 'create' ? req.user?.id ?? value : value)] },
    },
    { name: 'kipuSyncedAt', type: 'date', admin: { position: 'sidebar', readOnly: true, description: 'Último webhook aceptado por KipuControl (platform_blog_posts.synced_at).' } },
  ],
  hooks: {
    beforeChange: [onlyEditorsPublish, seoGuard],
    afterChange: [slugRedirect, revalidatePost, syncKipu],
    afterDelete: [revalidatePostDelete, syncKipuDelete],
  },
}
