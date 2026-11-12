// Datos estructurados del artículo (BLG-05): BlogPosting + BreadcrumbList + FAQPage en un solo @graph.
import type { PostView } from './posts'
import { SITE_NAME, SITE_URL, postUrl, HREFLANG, type Locale } from './site'
import { plainText, type LexicalState } from './seo-rules'

export function postJsonLd(post: PostView, locale: Locale = 'es') {
  const url = post.canonicalUrl || postUrl(post.slug, locale)
  const image = post.meta?.image?.url || post.heroImage?.sizes?.og?.url || post.heroImage?.url || `${SITE_URL}/blog/${post.slug}/opengraph-image`
  const faq = [...(post.faq ?? [])]
  const graph: Record<string, unknown>[] = [
    {
      '@type': 'BlogPosting',
      '@id': `${url}#post`,
      headline: post.title,
      description: post.meta?.description || post.excerpt,
      url,
      mainEntityOfPage: { '@type': 'WebPage', '@id': url },
      image: [image],
      datePublished: post.publishedAt,
      dateModified: post.updatedAt,
      inLanguage: HREFLANG[locale],
      wordCount: post.wordCount ?? undefined,
      keywords: post.focusKeyword ?? undefined,
      articleSection: post.categories?.map((c) => c.name),
      about: post.city ? { '@type': 'City', name: post.city.name } : undefined,
      author: post.author ? { '@type': 'Person', name: post.author.name, jobTitle: post.author.role ?? undefined, sameAs: post.author.sameAs ?? undefined } : undefined,
      publisher: { '@type': 'Organization', name: SITE_NAME, url: SITE_URL, logo: { '@type': 'ImageObject', url: `${SITE_URL}/logo-512.png` } },
      articleBody: plainText(post.content as LexicalState).slice(0, 5000),
    },
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { name: 'Inicio', item: SITE_URL },
        { name: 'Blog', item: `${SITE_URL}/blog` },
        ...(post.city ? [{ name: post.city.name, item: `${SITE_URL}/${post.city.slug}` }] : []),
        { name: post.title, item: url },
      ].map((b, i) => ({ '@type': 'ListItem', position: i + 1, ...b })),
    },
  ]
  if (faq.length) {
    graph.push({
      '@type': 'FAQPage',
      mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.question, acceptedAnswer: { '@type': 'Answer', text: f.answer } })),
    })
  }
  return { '@context': 'https://schema.org', '@graph': graph }
}

/** Serializa para <script type="application/ld+json"> sin permitir cerrar la etiqueta. */
export const ldJson = (data: unknown) => JSON.stringify(data).replace(/</g, '\\u003c')
