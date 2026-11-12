// syncKipu (BLG-03): avisa a KipuControl de cada cambio de una entrada para mantener `platform_blog_posts`
// (índice, métricas de Search Console y panel admin/marketing-vitrina › Blog).
// POST /api/v1/platform/blog/webhooks/payload · cabeceras X-Kipu-Timestamp y X-Kipu-Signature: sha256=<HMAC(timestamp + "." + cuerpo)>.
// KipuControl rechaza firmas inválidas o con más de 5 minutos (WEBHOOK_SIGNATURE). Un fallo no bloquea el guardado: queda en el log y se reintenta.
import { createHmac } from 'node:crypto'
import type { CollectionAfterChangeHook, CollectionAfterDeleteHook, PayloadRequest } from 'payload'
import { SITE_URL } from '../lib/site'
import { pingIndexNow } from '../lib/indexnow'

type PostDoc = Record<string, unknown> & { id: string | number; slug?: string; _status?: string }

const relId = (v: unknown): string | null => (v && typeof v === 'object' ? String((v as { id: unknown }).id ?? '') : v ? String(v) : null) || null
const citySlug = (v: unknown): string | null => (v && typeof v === 'object' ? ((v as { slug?: string }).slug ?? null) : null)

async function send(req: PayloadRequest, event: string, doc: PostDoc, attempt = 1): Promise<boolean> {
  const url = process.env.KIPU_WEBHOOK_URL
  const secret = process.env.KIPU_WEBHOOK_SECRET
  if (!url || !secret) return false
  const body = JSON.stringify({
    event,
    payloadId: String(doc.id),
    slug: doc.slug,
    status: doc._status,
    title: doc.title,
    excerpt: doc.excerpt,
    city: citySlug(doc.city),
    cityId: relId(doc.city),
    keyword: doc.focusKeyword,
    words: doc.wordCount,
    readingMinutes: doc.readingMinutes,
    seoScore: doc.seoScore,
    checks: doc.seoChecks,
    publishedAt: doc.publishedAt,
    updatedAt: doc.updatedAt,
    canonicalUrl: (doc.canonicalUrl as string) || `${SITE_URL}/blog/${doc.slug}`,
    noindex: Boolean(doc.noindex),
  })
  const ts = Math.floor(Date.now() / 1000).toString()
  const sig = createHmac('sha256', secret).update(`${ts}.${body}`).digest('hex')
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-kipu-timestamp': ts, 'x-kipu-signature': `sha256=${sig}`, 'idempotency-key': `${doc.id}:${doc.updatedAt}:${event}` },
      body,
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return true
  } catch (err) {
    req.payload.logger.error({ msg: 'BLG-03 webhook a KipuControl falló', event, id: doc.id, attempt, err: String(err) })
    if (attempt < 3) {
      await new Promise((r) => setTimeout(r, 500 * 2 ** attempt))
      return send(req, event, doc, attempt + 1)
    }
    return false
  }
}

export const syncKipu: CollectionAfterChangeHook = async ({ doc, previousDoc, req, context }) => {
  if (context.skipKipuSync) return doc
  const wasPublished = previousDoc?._status === 'published'
  const isPublished = doc._status === 'published'
  if (!wasPublished && !isPublished) return doc // los borradores no salen de Payload
  const event = isPublished ? (wasPublished ? 'post.updated' : 'post.published') : 'post.unpublished'
  const ok = await send(req, event, doc as PostDoc)
  if (ok) {
    await req.payload.update({ collection: 'posts', id: doc.id, data: { kipuSyncedAt: new Date().toISOString() }, req, context: { skipKipuSync: true, disableRevalidate: true }, depth: 0 })
  }
  if (isPublished) await pingIndexNow([`${SITE_URL}/blog/${doc.slug}`])
  return doc
}

export const syncKipuDelete: CollectionAfterDeleteHook = async ({ doc, req }) => {
  await send(req, 'post.deleted', doc as PostDoc)
  return doc
}
