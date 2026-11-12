// Reglas SEO del blog de Rutas Libres (spec 24 §5.2, BLG-01 a BLG-06), como funciones puras.
// Las usa el hook `seoGuard` al publicar y el panel de KipuControl (admin/marketing-vitrina › Blog) para mostrar el semáforo.

export const SEO_LIMITS = {
  minWords: 800,
  metaTitle: { min: 30, max: 60 },
  metaDescription: { min: 70, max: 160 },
  minToursForCityPost: 3,
  wordsPerMinute: 220,
} as const

type LexicalNode = { type?: string; text?: string; tag?: string; children?: LexicalNode[]; fields?: Record<string, unknown> }
export type LexicalState = { root?: LexicalNode } | null | undefined

/** Recorre el árbol Lexical en orden y llama a `visit` con cada nodo. */
export function walk(state: LexicalState, visit: (node: LexicalNode) => void): void {
  const stack: LexicalNode[] = state?.root ? [state.root] : []
  while (stack.length) {
    const node = stack.shift() as LexicalNode
    visit(node)
    if (node.children?.length) stack.unshift(...node.children)
  }
}

export function plainText(state: LexicalState): string {
  const parts: string[] = []
  walk(state, (n) => {
    if (n.type === 'text' && n.text) parts.push(n.text)
    if (n.type === 'paragraph' || n.type === 'heading' || n.type === 'listitem') parts.push('\n')
  })
  return parts.join('').replace(/[ \t]+/g, ' ').trim()
}

export const countWords = (text: string): number => (text.match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu) ?? []).length

export function firstParagraph(state: LexicalState): string {
  const root = state?.root
  const p = root?.children?.find((n) => n.type === 'paragraph' && plainText({ root: n }).length > 0)
  return p ? plainText({ root: p }) : ''
}

export function headings(state: LexicalState): { tag: string; text: string }[] {
  const out: { tag: string; text: string }[] = []
  walk(state, (n) => {
    if (n.type === 'heading') out.push({ tag: n.tag ?? 'h2', text: plainText({ root: n }) })
  })
  return out
}

export function blocksOf<T = Record<string, unknown>>(state: LexicalState, blockType: string): T[] {
  const out: T[] = []
  walk(state, (n) => {
    if (n.type === 'block' && n.fields?.blockType === blockType) out.push(n.fields as T)
  })
  return out
}

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
export const containsKeyword = (haystack: string | undefined | null, keyword: string): boolean =>
  Boolean(haystack && keyword && norm(haystack).includes(norm(keyword)))

export type SeoInput = {
  title: string
  slug: string
  focusKeyword: string
  content: LexicalState
  city?: string | null
  metaTitle?: string | null
  metaDescription?: string | null
  heroAlt?: string | null
  galleryAlts?: (string | null | undefined)[]
}

export type SeoCheck = { id: string; rule: string; ok: boolean; message: string; blocking: boolean }

export function evaluateSeo(input: SeoInput): { checks: SeoCheck[]; score: number; words: number; readingMinutes: number; tours: number } {
  const text = plainText(input.content)
  const words = countWords(text)
  const h = headings(input.content)
  const tours = blocksOf<{ tours?: unknown[] }>(input.content, 'toursRecomendados').reduce((n, b) => n + (b.tours?.length ?? 0), 0)
  const kw = input.focusKeyword?.trim() ?? ''
  const kwSlug = kw ? norm(kw).replace(/[^a-z0-9]+/g, '-') : ''
  const mt = input.metaTitle?.trim() ?? ''
  const md = input.metaDescription?.trim() ?? ''
  const L = SEO_LIMITS
  const c = (id: string, rule: string, ok: boolean, message: string, blocking = true): SeoCheck => ({ id, rule, ok, message, blocking })
  const checks: SeoCheck[] = [
    c('words', 'BLG-01', words >= L.minWords, `El texto tiene ${words} palabras; el mínimo es ${L.minWords}.`),
    c('keyword', 'BLG-01', kw.length > 0, 'Defina la palabra clave principal.'),
    c('kwTitle', 'BLG-01', containsKeyword(input.title, kw), 'La palabra clave debe aparecer en el título (H1).'),
    c('kwIntro', 'BLG-01', containsKeyword(firstParagraph(input.content), kw), 'La palabra clave debe aparecer en el primer párrafo.'),
    c('kwSlug', 'BLG-01', Boolean(kwSlug) && input.slug.includes(kwSlug), 'El slug debe contener la palabra clave.', false),
    c('metaTitle', 'BLG-01', mt.length >= L.metaTitle.min && mt.length <= L.metaTitle.max, `El meta título debe tener entre ${L.metaTitle.min} y ${L.metaTitle.max} caracteres (tiene ${mt.length}).`),
    c('metaDesc', 'BLG-01', md.length >= L.metaDescription.min && md.length <= L.metaDescription.max, `La meta descripción debe tener entre ${L.metaDescription.min} y ${L.metaDescription.max} caracteres (tiene ${md.length}).`),
    c('alt', 'BLG-01', Boolean(input.heroAlt?.trim()) && (input.galleryAlts ?? []).every((a) => Boolean(a?.trim())), 'Todas las imágenes necesitan texto alternativo.'),
    c('h1', 'BLG-01', !h.some((x) => x.tag === 'h1'), 'El título es el único H1: use H2 y H3 dentro del contenido.'),
    c('structure', 'BLG-01', h.filter((x) => x.tag === 'h2').length >= 2, 'Use al menos 2 subtítulos H2 para la tabla de contenidos.', false),
    c('tours', 'BLG-02', !input.city || tours >= L.minToursForCityPost, `Una entrada de ciudad enlaza al menos ${L.minToursForCityPost} tours de la vitrina (tiene ${tours}).`),
  ]
  const score = Math.round((100 * checks.filter((x) => x.ok).length) / checks.length)
  return { checks, score, words, readingMinutes: Math.max(1, Math.round(words / L.wordsPerMinute)), tours }
}
