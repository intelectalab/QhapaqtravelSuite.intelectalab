import { ArrowLeft, BadgeCheck, CalendarCheck, Rocket } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Faq } from "@/features/software/Faq";
import { DemoTourButton } from "@/features/software/DemoTour";
import { ArticleBody } from "@/features/software/blog/ArticleBody";
import { ArticleOutline } from "@/features/software/blog/ArticleProgress";
import { AuthorAvatar, PostCard, PostMeta } from "@/features/software/blog/BlogCards";
import { CommentThread } from "@/features/software/blog/CommentThread";
import { breadcrumbNode, faqNode, StructuredData } from "@/features/site/StructuredData";
import { articleOutline, BLOG_BASE, blogHref } from "@/lib/landing-content";
import { getBlogPost, softwareOrigin } from "@/lib/server/landing-content";

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const post = await getBlogPost(slug);
  if (!post) return { title: "Artículo no encontrado" };
  const url = `${await softwareOrigin()}${post.href}`;
  return {
    title: post.title,
    description: post.excerpt,
    keywords: [post.keyword],
    alternates: { canonical: url },
    openGraph: { type: "article", title: post.title, description: post.excerpt, url, publishedTime: post.published_at, authors: [post.author] },
  };
}

function InlineCta() {
  return (
    <aside className="relative isolate my-10 overflow-hidden rounded-[22px] bg-menu p-6 text-white sm:p-7">
      <span aria-hidden className="weave-band site-weave-run absolute inset-x-0 top-0 h-1.5 bg-[length:112px_100%]" />
      <span aria-hidden className="absolute -right-20 -top-20 -z-10 h-64 w-64 rounded-full bg-t3 opacity-35 blur-[90px]" />
      <p className="text-[12px] font-semibold tracking-[0.08em] text-white/55">Ordena tu operación</p>
      <p className="site-display mt-2 text-[22px] font-bold leading-snug tracking-[-0.02em]">Arma cotizaciones impecables en menos de 10 minutos.</p>
      <p className="mt-2 text-[14px] text-white/70">14 días gratis, sin tarjeta y con acompañamiento en la puesta en marcha.</p>
      <div className="mt-5 flex flex-wrap gap-2">
        <Button href="/software/suscribirse?ciclo=prueba" variant="primary" icon={<Rocket size={16} />}>
          Probar gratis
        </Button>
        <DemoTourButton tone="dark" label="Ver recorrido de 2 minutos" className="h-10" />
      </div>
    </aside>
  );
}

export default async function BlogPostPage({ params }: { params: Params }) {
  const { slug } = await params;
  const post = await getBlogPost(slug);
  if (!post) notFound();
  const origin = await softwareOrigin();
  const url = `${origin}${post.href}`;
  const outline = [...articleOutline(post.body), ...(post.faq.length > 0 ? [{ id: "preguntas", text: "Preguntas frecuentes" }] : []), { id: "comentarios", text: "Comentarios" }];
  const categoryHref = post.category ? blogHref({ category: post.category }) : BLOG_BASE;

  return (
    <article>
      <header className="relative isolate overflow-hidden border-b border-line">
        <span aria-hidden className="ambient-glow absolute inset-0 -z-10" />
        <div className="mx-auto max-w-[1200px] px-5 pb-12 pt-10 sm:px-8 sm:pb-16 sm:pt-14">
          <nav aria-label="Ruta" className="flex flex-wrap items-center gap-2 text-[13px] text-fg-3">
            <Link href={BLOG_BASE} className="inline-flex items-center gap-1.5 font-semibold text-fg-2 transition hover:-translate-x-0.5 hover:text-fg">
              <ArrowLeft size={15} />
              Blog
            </Link>
            {post.category_label && (
              <>
                <span aria-hidden>/</span>
                <Link href={categoryHref} className="font-semibold text-fg-2 hover:text-fg">
                  {post.category_label}
                </Link>
              </>
            )}
          </nav>
          <h1 className="site-display mt-6 max-w-4xl text-[34px] font-bold leading-[1.06] tracking-[-0.045em] text-fg sm:text-[50px]">
            {post.title} {post.title_accent && <span className="text-t3">{post.title_accent}</span>}
          </h1>
          <p className="mt-5 max-w-3xl text-[17px] leading-relaxed text-fg-2">{post.excerpt}</p>
          <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-3">
            <span className="flex items-center gap-3">
              <AuthorAvatar name={post.author} size={42} />
              <span>
                <b className="flex items-center gap-1.5 text-[14.5px] text-fg">
                  {post.author}
                  <BadgeCheck size={15} className="text-t1" aria-label="Autor verificado" />
                </b>
                {post.author_role && <span className="text-[13px] text-fg-3">{post.author_role}</span>}
              </span>
            </span>
            <PostMeta card={post} />
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1200px] gap-12 px-5 py-12 sm:px-8 sm:py-16 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div id="articulo" className="min-w-0 max-w-[740px]">
          <ArticleBody body={post.body} after={{ index: 2, node: <InlineCta /> }} />
          {post.faq.length > 0 && (
            <section id="preguntas" aria-labelledby="preguntas-titulo" className="mt-14 scroll-mt-28">
              <h2 id="preguntas-titulo" className="site-display mb-5 text-[25px] font-bold tracking-[-0.025em] text-fg">
                Preguntas frecuentes
              </h2>
              <Faq items={post.faq.map((item) => ({ question: item.q, answer: item.a }))} />
            </section>
          )}
          <div className="mt-14 flex gap-4 rounded-[20px] border border-line bg-surface p-5">
            <AuthorAvatar name={post.author} size={48} />
            <div>
              <p className="text-[14.5px] font-bold text-fg">Sobre {post.author}</p>
              <p className="mt-1 text-[13.5px] leading-relaxed text-fg-2">{post.author_role ? `${post.author_role}. ` : ""}Escribe sobre ventas, operación y gestión para agencias de viaje del Perú.</p>
            </div>
          </div>
          <div className="mt-14">
            <CommentThread slug={post.slug} comments={post.comments} count={post.comment_count} open={post.allow_comments} />
          </div>
        </div>
        <aside className="hidden lg:block">
          <div className="sticky top-24 grid gap-4">
            <ArticleOutline slug={post.slug} outline={outline} targetId="articulo" useful={post.useful} />
            <Link href="/software/contacto?tipo=demo" className="lift group flex items-center gap-3 rounded-[18px] border border-line bg-surface p-4">
              <span className="grid h-10 w-10 flex-none place-items-center rounded-[12px] bg-[color-mix(in_srgb,var(--t1)_12%,transparent)] text-t1 transition-transform group-hover:-rotate-6">
                <CalendarCheck size={18} />
              </span>
              <span className="text-[13px] leading-snug text-fg-2">
                <b className="block text-fg">¿Lo vemos con tu operación?</b>
                Agenda una demo de 30 minutos.
              </span>
            </Link>
          </div>
        </aside>
      </div>

      {post.related.length > 0 && (
        <section className="border-t border-line bg-surface py-14 sm:py-20">
          <div className="mx-auto max-w-[1200px] px-5 sm:px-8">
            <h2 className="site-display text-[26px] font-bold tracking-[-0.03em] text-fg sm:text-[32px]">Sigue leyendo</h2>
            <div className="mt-8 grid gap-5 md:grid-cols-3">
              {post.related.map((card) => (
                <PostCard key={card.id} card={card} />
              ))}
            </div>
          </div>
        </section>
      )}

      <StructuredData
        data={[
          {
            "@context": "https://schema.org",
            "@type": "BlogPosting",
            headline: post.title,
            description: post.excerpt,
            keywords: post.keyword,
            url,
            mainEntityOfPage: url,
            datePublished: post.published_at,
            author: { "@type": "Person", name: post.author, jobTitle: post.author_role ?? undefined },
            publisher: { "@type": "Organization", name: "KipuControl", url: origin },
            commentCount: post.comment_count,
          },
          breadcrumbNode([{ name: "Blog", url: `${origin}${BLOG_BASE}` }, ...(post.category_label ? [{ name: post.category_label, url: `${origin}${categoryHref}` }] : []), { name: post.title, url }]),
          ...[faqNode(post.faq)].filter((node): node is Record<string, unknown> => node !== null),
        ]}
      />
    </article>
  );
}
