// seoGuard (BLG-01 y BLG-02): calcula palabras, minutos de lectura y semáforo SEO en cada guardado,
// y bloquea la PUBLICACIÓN si falla una regla bloqueante. Un borrador se guarda siempre.
import { APIError, type CollectionBeforeChangeHook } from 'payload'
import { evaluateSeo, type LexicalState } from '../lib/seo-rules'

type MediaDoc = { alt?: string | null }
type GalleryBlock = { blockType?: string; images?: { image?: string | number | MediaDoc | null }[] }

export const seoGuard: CollectionBeforeChangeHook = async ({ data, originalDoc, req }) => {
  const merged = { ...(originalDoc ?? {}), ...data } as Record<string, unknown>
  const meta = (merged.meta ?? {}) as { title?: string; description?: string }

  const altOf = async (ref: unknown): Promise<string | null> => {
    if (!ref) return null
    if (typeof ref === 'object') return (ref as MediaDoc).alt ?? null
    const doc = await req.payload.findByID({ collection: 'media', id: ref as string | number, depth: 0, req, locale: req.locale ?? 'es' }).catch(() => null)
    return (doc as MediaDoc | null)?.alt ?? null
  }

  // Textos alternativos de la portada y de las galerías del contenido.
  const content = merged.content as LexicalState
  const galleryAlts: (string | null)[] = []
  const stack = content?.root ? [content.root as unknown as { type?: string; fields?: GalleryBlock; children?: unknown[] }] : []
  while (stack.length) {
    const n = stack.pop()!
    if (n.type === 'block' && n.fields?.blockType === 'galeria') for (const img of n.fields.images ?? []) galleryAlts.push(await altOf(img.image))
    for (const c of (n.children ?? []) as typeof stack) stack.push(c)
  }

  const result = evaluateSeo({
    title: String(merged.title ?? ''),
    slug: String(merged.slug ?? ''),
    focusKeyword: String(merged.focusKeyword ?? ''),
    content,
    city: merged.city ? String(typeof merged.city === 'object' ? (merged.city as { id: string }).id : merged.city) : null,
    metaTitle: meta.title,
    metaDescription: meta.description,
    heroAlt: await altOf(merged.heroImage),
    galleryAlts,
  })

  data.wordCount = result.words
  data.readingMinutes = result.readingMinutes
  data.seoScore = result.score
  data.seoChecks = result.checks

  const publishing = data._status === 'published'
  const failed = result.checks.filter((c) => c.blocking && !c.ok)
  if (publishing && failed.length) {
    // 422 con la lista de reglas: el panel la muestra como error del documento.
    throw new APIError('No se puede publicar: ' + failed.map((c) => `[${c.rule}] ${c.message}`).join(' '), 422, { checks: failed }, true)
  }
  if (publishing && !data.publishedAt) data.publishedAt = new Date().toISOString()
  return data
}
