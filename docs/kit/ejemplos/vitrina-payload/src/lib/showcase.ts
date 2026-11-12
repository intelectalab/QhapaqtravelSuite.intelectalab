// Tours de la vitrina para el bloque ToursRecomendados. La fuente es KipuControl, no Payload:
// GET /api/v1/showcase/listings?slugs=a,b,c (spec 22 y 24). Caché por etiqueta `showcase:listing:<slug>`,
// que KipuControl invalida con su webhook al cambiar precio, horario o estado de publicación.
export type Listing = {
  slug: string
  title: string
  city: string
  zone: string
  model: 'propina' | 'pago'
  price: number
  currency: string
  hours: number
  langs: string[]
  rating: number
  reviews: number
  highlights: string[]
  agency: { name: string; verified: boolean }
}

export async function getListings(slugs: string[]): Promise<Listing[]> {
  const clean = [...new Set(slugs.filter((s) => /^[a-z0-9-]+$/.test(s)))]
  if (!clean.length) return []
  const res = await fetch(`${process.env.KIPU_API_URL}/api/v1/showcase/listings?slugs=${clean.join(',')}`, {
    headers: { accept: 'application/json' },
    next: { revalidate: 900, tags: clean.map((s) => `showcase:listing:${s}`) },
  })
  if (!res.ok) return [] // un tour despublicado o la API caída no rompen el artículo
  const body = (await res.json()) as { data: Listing[] }
  // Mantener el orden elegido por el redactor y descartar los que ya no están publicados.
  return clean.map((s) => body.data.find((l) => l.slug === s)).filter((l): l is Listing => Boolean(l))
}
