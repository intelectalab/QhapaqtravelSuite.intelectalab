// /blog/[slug] — artículo del blog (diseño Stitch «Free tours en Lima: guía 2026 por barrio»).
// ISR: se genera en el build y se revalida por etiqueta `post:<slug>` desde el hook de Payload.
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getPost, listPublished } from '../../../../lib/posts'
import { postJsonLd, ldJson } from '../../../../lib/jsonld'
import { SITE_NAME, HREFLANG, LOCALES, postUrl } from '../../../../lib/site'
import { PostBody, Faq, tocOf } from '../../../../components/PostBody'

type Props = { params: Promise<{ slug: string }> }

export const revalidate = 3600
export const dynamicParams = true

export async function generateStaticParams() {
  return (await listPublished('es')).map((p) => ({ slug: p.slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const post = await getPost(slug)
  if (!post) return { title: 'Artículo no encontrado', robots: { index: false } }
  const title = post.meta?.title || post.title
  const description = post.meta?.description || post.excerpt
  const canonical = post.canonicalUrl || postUrl(post.slug)
  return {
    title,
    description,
    alternates: {
      canonical,
      languages: Object.fromEntries(LOCALES.map((l) => [HREFLANG[l], postUrl(post.slug, l)])),
    },
    robots: post.noindex ? { index: false, follow: true } : { index: true, follow: true, 'max-image-preview': 'large' },
    openGraph: {
      type: 'article',
      siteName: SITE_NAME,
      url: canonical,
      title: post.meta?.ogTitle || title,
      description,
      locale: 'es_PE',
      publishedTime: post.publishedAt ?? undefined,
      modifiedTime: post.updatedAt,
      authors: post.author ? [post.author.name] : undefined,
      section: post.categories?.[0]?.name,
      tags: post.focusKeyword ? [post.focusKeyword] : undefined,
      // La imagen la aporta opengraph-image.tsx de esta misma ruta, salvo que el SEO haya subido una propia.
      ...(post.meta?.image?.url ? { images: [{ url: post.meta.image.url, width: 1200, height: 630 }] } : {}),
    },
    twitter: { card: 'summary_large_image', title, description },
  }
}

const fmt = (d?: string | null) => (d ? new Intl.DateTimeFormat('es-PE', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(d)) : '')

export default async function PostPage({ params }: Props) {
  const { slug } = await params
  const post = await getPost(slug)
  if (!post) notFound()
  const toc = tocOf(post.content)
  const accent = post.titleAccent && post.title.endsWith(post.titleAccent) ? post.titleAccent : null
  const head = accent ? post.title.slice(0, -accent.length) : post.title

  return (
    <article className="bg-canvas">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson(postJsonLd(post)) }} />

      <nav aria-label="Migas de pan" className="border-b border-slate-200 bg-white">
        <ol className="mx-auto flex max-w-[1360px] gap-2 px-6 py-3 text-sm text-slate-500">
          <li><a href="/">Inicio</a> /</li>
          <li><a href="/blog">Blog</a> /</li>
          {post.city ? <li><a href={`/${post.city.slug}`}>{post.city.name}</a> /</li> : null}
          <li aria-current="page" className="truncate">{post.title}</li>
        </ol>
      </nav>

      <header className="mx-auto max-w-[900px] px-6 pb-7 pt-10 text-center">
        {post.kicker ? <span className="rounded-full bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary">{post.kicker}</span> : null}
        <h1 className="mt-4 text-balance text-4xl font-extrabold leading-tight tracking-tighter md:text-5xl">
          {head}{accent ? <em className="not-italic text-primary">{accent}</em> : null}
        </h1>
        <p className="mx-auto mt-4 max-w-[720px] text-lg text-slate-500">{post.excerpt}</p>
        {post.author ? (
          <div className="mx-auto mt-6 flex max-w-[780px] items-center justify-between gap-4 rounded-3xl border border-slate-200 bg-white p-4 text-left shadow-card">
            <div>
              <b>{post.author.name}</b>{post.author.verified ? <span className="ml-2 text-sm font-bold text-emerald">Verificada</span> : null}
              <div className="text-sm text-slate-500">{post.author.role} · {fmt(post.publishedAt)} · {post.readingMinutes ?? 1} min de lectura</div>
            </div>
          </div>
        ) : null}
      </header>

      {post.heroImage?.url ? (
        <figure className="mx-auto max-w-[1080px] px-6">
          {/* eslint-disable-next-line @next/next/no-img-element -- next/image con loader S3 en el proyecto real */}
          <img src={post.heroImage.sizes?.cover?.url || post.heroImage.url} alt={post.heroImage.alt ?? ''} width={1600} height={800} className="aspect-[2/1] w-full rounded-[2rem] object-cover shadow-float" fetchPriority="high" />
          {post.heroCaption ? <figcaption className="mt-2 flex justify-between text-sm text-slate-500"><span>{post.heroCaption}</span><span>{post.heroImage.credit}</span></figcaption> : null}
        </figure>
      ) : null}

      {toc.length > 1 ? (
        <nav aria-label="En esta guía" className="mx-auto my-9 max-w-[760px] rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-card">
          <h2 className="text-lg font-bold">En esta guía</h2>
          <ol className="mt-3 space-y-1">
            {toc.map((t, i) => (
              <li key={t.id}><a href={`#${t.id}`} className="flex gap-3 rounded-xl px-2.5 py-2 font-semibold hover:bg-primary/5 hover:text-primary"><span className="grid h-6 w-6 place-items-center rounded-lg bg-primary/10 text-xs font-extrabold text-primary">{i + 1}</span>{t.text}</a></li>
            ))}
          </ol>
        </nav>
      ) : null}

      <div className="mx-auto max-w-[760px] px-6 text-[17px] leading-relaxed">
        <PostBody content={post.content} />
        {post.faq?.length ? (<section><h2 className="mt-10 text-2xl font-extrabold">Preguntas frecuentes</h2><Faq items={post.faq} /></section>) : null}
        {post.author?.bio ? (
          <aside className="my-8 rounded-3xl border border-slate-200 bg-white p-5"><span className="text-xs font-extrabold uppercase tracking-widest text-primary">Sobre la autora</span><b className="block">{post.author.name}</b><p className="text-slate-500">{post.author.bio}</p></aside>
        ) : null}
      </div>

      {post.relatedPosts?.length ? (
        <section className="mx-auto max-w-[1360px] px-6 py-14">
          <h2 className="text-2xl font-extrabold tracking-tight">Artículos relacionados</h2>
          <div className="mt-5 grid gap-5 md:grid-cols-3">
            {post.relatedPosts.map((r) => (
              <a key={r.slug} href={`/blog/${r.slug}`} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-card hover:shadow-float"><b>{r.title}</b><p className="mt-1 text-sm text-slate-500">{r.excerpt}</p></a>
            ))}
          </div>
        </section>
      ) : null}
    </article>
  )
}
