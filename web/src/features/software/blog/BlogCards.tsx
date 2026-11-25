import { ArrowUpRight, Clock, Eye, Sparkles } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/format";
import { type BlogCard, formatReads } from "@/lib/landing-content";

export function AuthorAvatar({ name, size = 32 }: { name: string; size?: number }) {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] ?? "")
    .join("")
    .toUpperCase();
  return (
    <span aria-hidden style={{ width: size, height: size }} className="grid flex-none place-items-center rounded-full bg-[color-mix(in_srgb,var(--t1)_14%,var(--surface))] text-[11.5px] font-bold text-t1">
      {initials}
    </span>
  );
}

export function SiteTag({ card }: { card: Pick<BlogCard, "site" | "site_label"> }) {
  return <span className={cn("rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold", card.site === "kipucontrol" ? "bg-[color-mix(in_srgb,var(--t1)_12%,transparent)] text-t1" : "bg-[color-mix(in_srgb,var(--t4)_14%,transparent)] text-t4")}>{card.site_label}</span>;
}

export function PostMeta({ card, className }: { card: BlogCard; className?: string }) {
  return (
    <p className={cn("flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-fg-3", className)}>
      <span className="inline-flex items-center gap-1">
        <Clock size={13} />
        {card.reading_minutes} min
      </span>
      <span>{formatDate(card.published_at)}</span>
      <span className="inline-flex items-center gap-1">
        <Eye size={13} />
        {formatReads(card.reads)}
      </span>
    </p>
  );
}

export function PostCard({ card }: { card: BlogCard }) {
  return (
    <Link href={card.href} className="lift group flex h-full flex-col rounded-[20px] border border-line bg-surface p-5 hover:border-[color-mix(in_srgb,var(--t1)_35%,transparent)]">
      <span className="flex flex-wrap items-center gap-2">
        <SiteTag card={card} />
        {card.category_label && <span className="text-[12px] font-semibold text-fg-2">{card.category_label}</span>}
      </span>
      <h3 className="mt-4 text-[17px] font-bold leading-snug tracking-tight text-fg transition-colors group-hover:text-t1">{card.title}</h3>
      <p className="mt-2 line-clamp-3 flex-1 text-[13.5px] leading-relaxed text-fg-2">{card.excerpt}</p>
      <PostMeta card={card} className="mt-4" />
      <span className="mt-4 flex items-center justify-between border-t border-line pt-4">
        <span className="flex min-w-0 items-center gap-2.5">
          <AuthorAvatar name={card.author} size={28} />
          <span className="truncate text-[13px] font-semibold text-fg">{card.author}</span>
        </span>
        <ArrowUpRight size={17} className="flex-none text-fg-3 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-t1" />
      </span>
    </Link>
  );
}

export function FeaturedPost({ card }: { card: BlogCard }) {
  return (
    <Link href={card.href} className="group relative isolate grid overflow-hidden rounded-[26px] bg-menu p-7 text-white transition-transform duration-500 hover:-translate-y-0.5 sm:p-10 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,0.7fr)] lg:gap-10">
      <span aria-hidden className="weave-band site-weave-run absolute inset-x-0 top-0 h-1.5 bg-[length:112px_100%]" />
      <span aria-hidden className="weave-tint absolute inset-0 -z-10 bg-white opacity-[0.05] [mask-size:36px_36px]" />
      <span aria-hidden className="absolute -right-24 -top-28 -z-10 h-80 w-80 rounded-full bg-t3 opacity-35 blur-[110px] transition-opacity duration-500 group-hover:opacity-55" />
      <div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[12px] font-semibold text-white/85">
          <Sparkles size={13} />
          Destacado · {card.category_label}
        </span>
        <h2 className="site-display mt-5 text-[26px] font-bold leading-[1.1] tracking-[-0.03em] sm:text-[36px]">
          {card.title} {card.title_accent && <span className="text-t2">{card.title_accent}</span>}
        </h2>
        <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-white/70">{card.excerpt}</p>
      </div>
      <div className="mt-8 flex flex-col justify-end gap-5 lg:mt-0">
        <span className="flex items-center gap-3">
          <AuthorAvatar name={card.author} size={40} />
          <span>
            <b className="block text-[14px]">{card.author}</b>
            {card.author_role && <span className="text-[12.5px] text-white/55">{card.author_role}</span>}
          </span>
        </span>
        <PostMeta card={card} className="text-white/55" />
        <span className="inline-flex w-fit items-center gap-2 rounded-[12px] bg-white px-4 py-2.5 text-[13.5px] font-semibold text-menu transition group-hover:gap-3">
          Leer artículo
          <ArrowUpRight size={16} />
        </span>
      </div>
    </Link>
  );
}

export function PopularList({ cards }: { cards: BlogCard[] }) {
  return (
    <ol className="grid gap-1">
      {cards.map((card, index) => (
        <li key={card.id}>
          <Link href={card.href} className="group flex gap-3 rounded-[12px] p-2.5 transition hover:bg-surface-2">
            <span className="font-mono text-[20px] font-bold leading-none text-fg-3 transition-colors group-hover:text-t3">{String(index + 1).padStart(2, "0")}</span>
            <span className="min-w-0">
              <span className="line-clamp-2 text-[13.5px] font-semibold leading-snug text-fg">{card.title}</span>
              <span className="mt-1 block text-[12px] text-fg-3">
                {formatReads(card.reads)} · {card.category_label ?? card.site_label}
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ol>
  );
}
