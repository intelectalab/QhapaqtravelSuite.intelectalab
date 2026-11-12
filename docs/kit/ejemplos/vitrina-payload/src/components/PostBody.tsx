// Render del contenido Lexical con los bloques del blog. Las clases Tailwind usan los tokens de
// kit/design/rutaslibres (primary, secondary = coral, tertiary = esmeralda, surface…).
import type { ReactNode } from 'react'
import { RichText, type JSXConvertersFunction } from '@payloadcms/richtext-lexical/react'
import type { SerializedEditorState } from '@payloadcms/richtext-lexical/lexical'
import { getListings, type Listing } from '../lib/showcase'
import { slugify } from '../fields/slug'

type ToursFields = { heading?: string; tours?: { slug: string }[]; layout?: 'inline' | 'grid' }
type ConsejoFields = { title: string; text: string; tone?: 'tip' | 'warning' }
type CitaFields = { quote: string; author: string }
type CtaFields = { title: string; text?: string; label: string; href: string; variant?: 'booking' | 'agency' }
type FaqFields = { items: { question: string; answer: string }[] }
/** Argumento de los convertidores de bloques: `node.fields` trae los campos del bloque y `blockType`. */
type BlockArg = { node: { fields: unknown } }

const textOf = (nodes: unknown[] = []): string =>
  nodes.map((n) => { const x = n as { text?: string; children?: unknown[] }; return x.text ?? textOf(x.children) }).join('')

async function ToursBlock({ fields }: { fields: ToursFields }) {
  const tours = await getListings((fields.tours ?? []).map((t) => t.slug))
  if (!tours.length) return null
  return (
    <div className={fields.layout === 'grid' ? 'my-8 grid gap-5 sm:grid-cols-2' : 'my-8 space-y-5'}>
      {fields.heading ? <h3 className="text-xl font-bold tracking-tight">{fields.heading}</h3> : null}
      {tours.map((t) => <TourCard key={t.slug} tour={t} />)}
    </div>
  )
}

function TourCard({ tour }: { tour: Listing }) {
  const paid = tour.model === 'pago'
  return (
    <article className="grid gap-4 rounded-3xl border border-slate-200 bg-white p-3.5 shadow-card sm:grid-cols-[200px_1fr]">
      <div className="aspect-[4/3] rounded-2xl bg-primary/90" aria-hidden />
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-extrabold uppercase tracking-widest text-primary">{tour.zone}</span>
        <h4 className="text-lg font-bold tracking-tight">{tour.title}</h4>
        <p className="text-sm text-slate-500">{tour.highlights.slice(0, 2).join(' · ')}</p>
        {tour.agency.verified ? <span className="text-sm font-bold text-emerald">Operado por {tour.agency.name}</span> : null}
        <div className="mt-auto flex items-end justify-between border-t border-slate-200 pt-3">
          <div>
            <small className="block text-xs text-slate-500">{paid ? 'Desde' : 'Reserva gratis'}</small>
            <strong className="text-lg text-coral">{paid ? `S/ ${tour.price}` : 'Propina libre'}</strong>
          </div>
          <a href={`/tour/${tour.slug}`} className="rounded-full bg-coral px-4 py-2.5 text-sm font-bold text-white hover:shadow-coral">Reservar plaza</a>
        </div>
      </div>
    </article>
  )
}

const converters: JSXConvertersFunction = ({ defaultConverters }) => ({
  ...defaultConverters,
  // H2 con id para la tabla de contenidos y scroll-margin bajo la barra fija.
  heading: ({ node, nodesToJSX }) => {
    const Tag = node.tag as 'h2' | 'h3' | 'h4'
    const id = slugify(textOf(node.children as unknown[]))
    return <Tag id={id} className="scroll-mt-24">{nodesToJSX({ nodes: node.children })}</Tag>
  },
  blocks: {
    toursRecomendados: ({ node }: BlockArg) => <ToursBlock fields={node.fields as unknown as ToursFields} />,
    consejo: ({ node }: BlockArg) => {
      const f = node.fields as unknown as ConsejoFields
      return (
        <aside className={`my-6 rounded-2xl border p-4 ${f.tone === 'warning' ? 'border-coral/30 bg-coral/5' : 'border-emerald/30 bg-emerald/5'}`}>
          <b className="block">{f.title}</b>
          {f.text}
        </aside>
      )
    },
    cita: ({ node }: BlockArg) => {
      const f = node.fields as unknown as CitaFields
      return (
        <blockquote className="my-8 rounded-r-3xl border-l-4 border-primary bg-primary/5 px-6 py-5 text-xl font-bold italic">
          «{f.quote}»<cite className="mt-2 block text-xs font-extrabold not-italic uppercase tracking-widest text-primary">— {f.author}</cite>
        </blockquote>
      )
    },
    cta: ({ node }: BlockArg) => {
      const f = node.fields as unknown as CtaFields
      return (
        <div className="my-8 rounded-[2rem] bg-cobalt p-8 text-white">
          <h3 className="text-2xl font-extrabold">{f.title}</h3>
          {f.text ? <p className="mt-2 text-white/85">{f.text}</p> : null}
          <a href={f.href} className={`mt-4 inline-flex rounded-full px-5 py-3 font-bold ${f.variant === 'agency' ? 'bg-white text-slate-900' : 'bg-coral text-white'}`}>{f.label}</a>
        </div>
      )
    },
    faq: ({ node }: BlockArg) => <Faq items={(node.fields as unknown as FaqFields).items} />,
  },
})

export function Faq({ items }: { items: { question: string; answer: string }[] }): ReactNode {
  return (
    <div className="my-6 space-y-2.5">
      {items.map((i) => (
        <details key={i.question} className="rounded-2xl border border-slate-200 bg-white px-5 py-4">
          <summary className="cursor-pointer font-bold">{i.question}</summary>
          <p className="mt-2 text-slate-500">{i.answer}</p>
        </details>
      ))}
    </div>
  )
}

export function PostBody({ content }: { content: unknown }) {
  return <RichText data={content as SerializedEditorState} converters={converters} className="prose-rl" />
}

/** Entradas de la tabla de contenidos «En esta guía» a partir de los H2 del contenido. */
export function tocOf(content: unknown): { id: string; text: string }[] {
  const root = (content as { root?: { children?: { type?: string; tag?: string; children?: unknown[] }[] } })?.root
  return (root?.children ?? [])
    .filter((n) => n.type === 'heading' && n.tag === 'h2')
    .map((n) => { const text = textOf(n.children); return { id: slugify(text), text } })
}
