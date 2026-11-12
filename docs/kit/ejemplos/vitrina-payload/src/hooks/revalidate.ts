// Revalidación ISR: la entrada, el índice del blog, la ciudad y el sitemap del blog se regeneran al publicar o despublicar.
import type { CollectionAfterChangeHook, CollectionAfterDeleteHook } from 'payload'
import { revalidatePath, revalidateTag } from 'next/cache'

const refresh = (slug?: string) => {
  try {
    if (slug) revalidateTag(`post:${slug}`)
    revalidateTag('posts')
    revalidatePath('/blog')
    revalidatePath('/blog/sitemap.xml')
  } catch {
    // Fuera del runtime de Next (scripts, seed, migraciones) no hay caché que limpiar.
  }
}

export const revalidatePost: CollectionAfterChangeHook = ({ doc, previousDoc, context }) => {
  if (context.disableRevalidate) return doc
  if (doc._status === 'published' || previousDoc?._status === 'published') {
    refresh(doc.slug)
    if (previousDoc?.slug && previousDoc.slug !== doc.slug) refresh(previousDoc.slug)
  }
  return doc
}

export const revalidatePostDelete: CollectionAfterDeleteHook = ({ doc }) => {
  refresh(doc?.slug)
  return doc
}
