"use client";

import { Link2, ThumbsDown, ThumbsUp } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { countRead, ratePost } from "@/app/(software)/software/actions";
import { toast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";

const READ_KEY = "kipu_blog_read_";

function readProgress(target: HTMLElement | null): number {
  if (!target) return 0;
  const rect = target.getBoundingClientRect();
  const total = rect.height - window.innerHeight * 0.6;
  if (total <= 0) return 100;
  return Math.max(0, Math.min(100, Math.round((-rect.top / total) * 100)));
}

export function useReadingProgress(targetId: string): number {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const target = document.getElementById(targetId);
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setProgress(readProgress(target)));
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [targetId]);
  return progress;
}

function storedFlag(key: string): boolean {
  try {
    return window.sessionStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function storeFlag(key: string) {
  try {
    window.sessionStorage.setItem(key, "1");
  } catch {}
}

export function ArticleOutline({ slug, outline, targetId, useful }: { slug: string; outline: { id: string; text: string }[]; targetId: string; useful: { yes: number; no: number } }) {
  const progress = useReadingProgress(targetId);
  const [active, setActive] = useState<string | null>(outline[0]?.id ?? null);
  const [votes, setVotes] = useState(useful);
  const [voted, setVoted] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!storedFlag(READ_KEY + slug)) {
      storeFlag(READ_KEY + slug);
      void countRead(slug);
    }
  }, [slug]);

  useEffect(() => {
    const headings = outline.map((item) => document.getElementById(item.id)).filter((node): node is HTMLElement => node !== null);
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setActive(visible.target.id);
      },
      { rootMargin: "-20% 0px -65% 0px" },
    );
    headings.forEach((heading) => observer.observe(heading));
    return () => observer.disconnect();
  }, [outline]);

  const rate = (value: boolean) =>
    startTransition(async () => {
      const result = await ratePost(slug, value);
      if (!result) {
        toast("No pudimos registrar tu opinión. Inténtalo de nuevo.", "bad");
        return;
      }
      setVotes({ yes: result.yes, no: result.no });
      setVoted(true);
      toast(result.message, result.counted ? "ok" : "warn");
    });

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href.split("#")[0] ?? "");
      toast("Enlace copiado.");
    } catch {
      toast("No pudimos copiar el enlace.", "bad");
    }
  };

  return (
    <nav aria-label="En este artículo" className="rounded-[20px] border border-line bg-surface p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[13px] font-bold text-fg">En este artículo</p>
        <span className="font-mono text-[12px] text-fg-3">{progress} %</span>
      </div>
      <span aria-hidden className="mt-3 block h-1.5 overflow-hidden rounded-full bg-surface-2">
        <span className="weave-line block h-full origin-left rounded-full transition-transform duration-200" style={{ transform: `scaleX(${progress / 100})` }} />
      </span>
      <ol className="mt-4 grid gap-0.5">
        {outline.map((item, index) => (
          <li key={item.id}>
            <a href={`#${item.id}`} aria-current={active === item.id ? "location" : undefined} className={cn("group flex gap-2.5 rounded-[10px] px-2 py-1.5 text-[13px] leading-snug transition", active === item.id ? "bg-surface-2 font-semibold text-fg" : "text-fg-2 hover:bg-surface-2 hover:text-fg")}>
              <span className={cn("font-mono text-[11.5px] leading-5", active === item.id ? "text-t3" : "text-fg-3")}>{String(index + 1).padStart(2, "0")}</span>
              {item.text}
            </a>
          </li>
        ))}
      </ol>
      <div className="mt-5 border-t border-line pt-4">
        <p className="text-[12.5px] font-semibold text-fg">¿Te sirvió este artículo?</p>
        <div className="mt-2.5 flex gap-2">
          <button type="button" disabled={pending || voted} onClick={() => rate(true)} className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-[10px] border border-line text-[13px] font-semibold text-fg-2 transition hover:-translate-y-px hover:border-ok hover:text-ok disabled:translate-y-0 disabled:opacity-60">
            <ThumbsUp size={15} />
            Útil <span className="font-mono text-[11.5px]">{votes.yes}</span>
          </button>
          <button type="button" aria-label="No me sirvió" disabled={pending || voted} onClick={() => rate(false)} className="inline-flex h-9 w-11 items-center justify-center rounded-[10px] border border-line text-fg-2 transition hover:-translate-y-px hover:border-bad hover:text-bad disabled:translate-y-0 disabled:opacity-60">
            <ThumbsDown size={15} />
          </button>
          <button type="button" aria-label="Copiar enlace" onClick={copy} className="inline-flex h-9 w-11 items-center justify-center rounded-[10px] border border-line text-fg-2 transition hover:-translate-y-px hover:border-accent hover:text-accent">
            <Link2 size={15} />
          </button>
        </div>
      </div>
    </nav>
  );
}
