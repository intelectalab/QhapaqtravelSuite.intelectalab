// slugRedirect (BLG-04): si cambia el slug de una entrada que ya estaba publicada, crea una redirección 301
// /blog/<slug-anterior> → entrada, en la colección `redirects` del plugin. Evita cadenas: actualiza las que apuntaban al slug viejo.
import type { CollectionAfterChangeHook } from 'payload'

export const slugRedirect: CollectionAfterChangeHook = async ({ doc, previousDoc, operation, req }) => {
  if (operation !== 'update' || !previousDoc?.slug || previousDoc.slug === doc.slug) return doc
  if (previousDoc._status !== 'published') return doc

  const from = `/blog/${previousDoc.slug}`
  const existing = await req.payload.find({ collection: 'redirects', where: { from: { equals: from } }, limit: 1, depth: 0, req })
  const data = {
    from,
    to: { type: 'reference' as const, reference: { relationTo: 'posts' as const, value: doc.id } },
    type: '301' as const,
  }
  if (existing.docs[0]) await req.payload.update({ collection: 'redirects', id: existing.docs[0].id, data, req })
  else await req.payload.create({ collection: 'redirects', data, req })

  req.payload.logger.info({ msg: 'BLG-04 redirección 301 creada', from, to: `/blog/${doc.slug}` })
  return doc
}
