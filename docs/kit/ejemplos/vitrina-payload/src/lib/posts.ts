// Lectura de entradas desde Payload con la Local API (sin HTTP) y caché por etiqueta.
import { cache } from 'react'
import { draftMode } from 'next/headers'
import { unstable_cache } from 'next/cache'
import { getPayload } from 'payload'
import config from '@payload-config'
import type { Locale } from './site'

export type PostView = {
  id: string | number
  title: string
  titleAccent?: string | null
  kicker?: string | null
  slug: string
  excerpt: string
  heroCaption?: string | null
  heroImage?: { url?: string | null; alt?: string | null; credit?: string | null; sizes?: Record<string, { url?: string | null }> } | null
  content: unknown
  faq?: { question: string; answer: string }[] | null
  author?: { name: string; role?: string | null; bio?: string | null; verified?: boolean | null; sameAs?: string[] | null; avatar?: { url?: string | null } | null } | null
  categories?: { name: string; slug: string }[] | null
  city?: { name: string; slug: string } | null
  relatedPosts?: PostView[] | null
  focusKeyword?: string | null
  publishedAt?: string | null
  updatedAt: string
  readingMinutes?: number | null
  wordCount?: number | null
  noindex?: boolean | null
  canonicalUrl?: string | null
  meta?: { title?: string | null; description?: string | null; ogTitle?: string | null; image?: { url?: string | null } | null } | null
}

/** Una entrada por slug. En modo borrador (vista previa del panel) incluye los cambios sin publicar. */
export const getPost = cache(async (slug: string, locale: Locale = 'es'): Promise<PostView | null> => {
  const { isEnabled: draft } = await draftMode()
  const load = async () => {
    const payload = await getPayload({ config })
    const res = await payload.find({
      collection: 'posts',
      where: { slug: { equals: slug } },
      limit: 1,
      depth: 2,
      locale,
      draft,
      overrideAccess: draft,
    })
    return (res.docs[0] as unknown as PostView) ?? null
  }
  if (draft) return load()
  return unstable_cache(load, ['post', slug, locale], { tags: [`post:${slug}`, 'posts'], revalidate: 3600 })()
})

/** Slugs publicados para generateStaticParams y el sitemap. */
export const listPublished = unstable_cache(
  async (locale: Locale = 'es') => {
    const payload = await getPayload({ config })
    const res = await payload.find({
      collection: 'posts',
      where: { and: [{ _status: { equals: 'published' } }, { noindex: { not_equals: true } }] },
      select: { slug: true, updatedAt: true, publishedAt: true },
      limit: 1000,
      depth: 0,
      locale,
      sort: '-publishedAt',
    })
    return res.docs as unknown as { slug: string; updatedAt: string; publishedAt?: string }[]
  },
  ['posts-published'],
  { tags: ['posts'], revalidate: 3600 },
)
