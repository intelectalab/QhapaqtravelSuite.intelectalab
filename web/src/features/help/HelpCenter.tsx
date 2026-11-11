"use client";

import { Archive, ArrowRight, BookOpen, Building, LayoutGrid, ListChecks, MessageCircleQuestion, MonitorCog, PenLine, Search, Sparkles, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { MetricCard, MetricCardRow } from "@/components/ui/MetricCard";
import { SideFilterList } from "@/components/ui/SideFilterList";
import { cn } from "@/lib/cn";
import { groupByModule, helpHref, ORIGIN_TONES, type HelpArticleSummary, type HelpIndex, type HelpRealm } from "@/lib/help";
import type { Tone } from "@/lib/tone";

const SEARCH_DELAY_MS = 300;

interface Card {
  key: string;
  label: string;
  value: number;
  icon: React.ReactNode;
  tone: Tone;
  params: Record<string, string | null>;
}

function cardsFor(index: HelpIndex, platform: boolean): Card[] {
  const c = index.counts;
  if (platform) {
    return [
      { key: "agency", label: "Para agencias", value: c.agency ?? 0, icon: <Building size={18} />, tone: "t1", params: { audience: null, status: null, origen: null } },
      { key: "platform", label: "De la consola", value: c.platform ?? 0, icon: <MonitorCog size={18} />, tone: "t2", params: { audience: "platform", status: null, origen: null } },
      { key: "adapted", label: "Adaptados por agencias", value: c.adapted ?? 0, icon: <PenLine size={18} />, tone: "violet", params: { audience: null, status: null, origen: "adaptado" } },
      { key: "archived", label: "Archivados", value: c.archived ?? 0, icon: <Archive size={18} />, tone: "mute", params: { audience: "all", status: "archived", origen: null } },
    ];
  }
  return [
    { key: "all", label: "Artículos publicados", value: c.total ?? 0, icon: <BookOpen size={18} />, tone: "t1", params: { status: null, origen: null } },
    { key: "adapted", label: "Adaptados por tu agencia", value: c.adapted ?? 0, icon: <PenLine size={18} />, tone: "violet", params: { status: null, origen: "adaptado" } },
    { key: "own", label: "Propios de tu agencia", value: c.own ?? 0, icon: <Sparkles size={18} />, tone: "sun", params: { status: null, origen: "propio" } },
    { key: "archived", label: "Archivados", value: c.archived ?? 0, icon: <Archive size={18} />, tone: "mute", params: { status: "archived", origen: null } },
  ];
}

function ArticleCard({ article, realm, index }: { article: HelpArticleSummary; realm: HelpRealm; index: number }) {
  return (
    <Link href={helpHref(realm, article.slug)} data-testid={`help-article:${article.slug}`} className="lift group flex min-h-[148px] flex-col rounded-tile border border-line bg-surface p-4 shadow-card hover:border-accent/35 motion-safe:animate-[rise-in_360ms_ease-out_backwards]" style={{ animationDelay: `${Math.min(index, 8) * 35}ms` }}>
      <span className="flex items-start gap-3">
        <span className="grid h-9 w-9 flex-none place-items-center rounded-[11px] bg-accent/10 text-accent transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110">
          <BookOpen size={17} />
        </span>
        <span className="min-w-0 flex-1">
          <b className="block text-[14.5px] font-semibold leading-snug">{article.title}</b>
          <span className="mt-0.5 block truncate text-[12px] text-fg-3">{article.screen}</span>
        </span>
        <ArrowRight size={15} className="mt-1 flex-none text-fg-3 opacity-0 transition group-hover:translate-x-0.5 group-hover:text-accent group-hover:opacity-100" />
      </span>
      <span className="mt-2.5 line-clamp-2 flex-1 text-[13px] leading-relaxed text-fg-2">{article.summary}</span>
      <span className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[12px] text-fg-3">
        <span className="inline-flex items-center gap-1">
          <ListChecks size={13} />
          {article.steps_count} pasos
        </span>
        <span className="inline-flex items-center gap-1">
          <MessageCircleQuestion size={13} />
          {article.faqs_count} dudas
        </span>
        {article.origin !== "qhapaq" && <Badge tone={ORIGIN_TONES[article.origin]}>{article.origin_label}</Badge>}
        {(article.adaptations ?? 0) > 0 && <Badge tone="violet">{article.adaptations === 1 ? "1 agencia lo adaptó" : `${article.adaptations} agencias lo adaptaron`}</Badge>}
        {article.status === "archived" && <Badge tone="mute">Archivado</Badge>}
      </span>
    </Link>
  );
}

export function HelpCenter({ index, realm }: { index: HelpIndex; realm: HelpRealm }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [query, setQuery] = useState(index.filters.q);
  const [pending, startTransition] = useTransition();
  const input = useRef<HTMLInputElement>(null);
  const origin = params.get("origen") ?? "";

  const navigate = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    const search = next.toString();
    startTransition(() => router.replace(search ? `${pathname}?${search}` : pathname, { scroll: false }));
  };

  useEffect(() => {
    if (query === index.filters.q) return;
    const timer = window.setTimeout(() => navigate({ q: query.trim() || null }), SEARCH_DELAY_MS);
    return () => window.clearTimeout(timer);
  });

  useEffect(() => {
    const focus = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (event.key === "/" && !["INPUT", "TEXTAREA"].includes(target.tagName) && !target.isContentEditable) {
        event.preventDefault();
        input.current?.focus();
      }
    };
    window.addEventListener("keydown", focus);
    return () => window.removeEventListener("keydown", focus);
  }, []);

  const visible = index.articles.filter((article) => (origin === "" ? true : origin === "adaptado" && realm.platform ? (article.adaptations ?? 0) > 0 : article.origin === origin));
  const groups = groupByModule(visible, index.filters.q ? [...new Set(visible.map((article) => article.module))] : index.modules.map((item) => item.module));
  const cards = index.can_manage ? cardsFor(index, realm.platform) : [];
  const resolved = (key: string, value: string | null) => (key === "status" ? (value ?? "published") : key === "audience" ? (value ?? "agency") : value);
  const current = (key: string) => (key === "status" ? index.filters.status || "published" : key === "audience" ? index.filters.audience || "agency" : (params.get(key) ?? null));
  const activeCard = cards.find((card) => Object.entries(card.params).every(([key, value]) => resolved(key, value) === current(key)));

  return (
    <div className={cn("transition-opacity", pending && "opacity-70")}>
      {cards.length > 0 && (
        <MetricCardRow>
          {cards.map((card) => (
            <MetricCard key={card.key} label={card.label} value={card.value} icon={card.icon} tone={card.tone} active={activeCard?.key === card.key} onClick={() => navigate(activeCard?.key === card.key ? Object.fromEntries(Object.keys(card.params).map((key) => [key, null])) : card.params)} testId={`help-card:${card.key}`} />
          ))}
        </MetricCardRow>
      )}
      <div className="mb-5 flex flex-col gap-3">
        <label className="flex h-12 items-center gap-2.5 rounded-control border border-line bg-surface px-4 shadow-card transition focus-within:border-accent focus-within:shadow-[0_0_0_3px_color-mix(in_srgb,var(--accent)_14%,transparent)]">
          <Search size={17} className="flex-none text-fg-3" />
          <input ref={input} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Busca una pantalla, una acción o una duda, por ejemplo «anular factura»" aria-label="Buscar en el centro de ayuda" data-testid="help-search" className="h-full min-w-0 flex-1 bg-transparent text-[14px] outline-none placeholder:text-fg-3" />
          {query ? (
            <button type="button" aria-label="Limpiar búsqueda" onClick={() => setQuery("")} className="grid h-7 w-7 place-items-center rounded-lg text-fg-3 transition hover:bg-surface-2 hover:text-fg">
              <X size={15} />
            </button>
          ) : (
            <kbd className="rounded-md border border-line px-1.5 text-[11px] text-fg-3 max-sm:hidden">/</kbd>
          )}
        </label>
      </div>
      <div className="grid items-start gap-4 lg:grid-cols-[232px_minmax(0,1fr)] lg:gap-6">
        <SideFilterList label="Módulos" value={index.filters.module} onChange={(module) => navigate({ module: module || null })} options={[{ value: "", label: "Todos los módulos", count: index.modules.reduce((sum, item) => sum + item.count, 0), icon: <LayoutGrid size={15} /> }, ...index.modules.map((item) => ({ value: item.module, label: item.module, count: item.count, icon: <BookOpen size={15} /> }))]} testId="help-modules" />
        <div className="min-w-0">
          {groups.length === 0 ? (
            <EmptyState icon={<Search size={20} />} title="No encontramos artículos" description={index.filters.q ? `Nada coincide con «${index.filters.q}». Prueba con otra palabra o quita el filtro de módulo.` : "No hay artículos con estos filtros."} />
          ) : (
            <div className="flex flex-col gap-7">
              {groups.map((group) => (
                <section key={group.module} data-testid={`help-module:${group.module}`}>
                  <h2 className="mb-3 flex items-baseline gap-2 text-[16px] font-bold tracking-tight">
                    {group.module}
                    <span className="text-[12.5px] font-medium text-fg-3">{group.items.length === 1 ? "1 artículo" : `${group.items.length} artículos`}</span>
                  </h2>
                  <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
                    {group.items.map((article, position) => (
                      <ArticleCard key={article.slug} article={article} realm={realm} index={position} />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
