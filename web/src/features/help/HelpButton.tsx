"use client";

import { ArrowRight, BookOpen, CircleHelp, Compass, Pencil } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { SidePanel } from "@/components/ui/SidePanel";
import { helpHref, ORIGIN_TONES, type HelpArticleSummary, type HelpRealm, type HelpScreen } from "@/lib/help";
import { HelpArticleBody } from "./HelpArticleBody";

type ScreenResult = { kind: "ok"; screen: HelpScreen } | { kind: "expired" } | { kind: "unavailable" };

async function fetchScreen(url: string, path: string): Promise<ScreenResult> {
  try {
    const response = await fetch(`${url}?path=${encodeURIComponent(path)}`, { cache: "no-store", headers: { Accept: "application/json" } });
    const json = (response.headers.get("content-type") ?? "").includes("application/json");
    if (response.status === 401 || response.redirected || !json) return { kind: "expired" };
    if (!response.ok) return { kind: "unavailable" };
    return { kind: "ok", screen: (await response.json()) as HelpScreen };
  } catch {
    return { kind: "unavailable" };
  }
}

export function HelpLinkList({ title, items, realm, onOpen }: { title: string; items: HelpArticleSummary[]; realm: HelpRealm; onOpen?: () => void }) {
  if (items.length === 0) return null;
  return (
    <section>
      <h3 className="mb-2 text-[12.5px] font-semibold text-fg-3">{title}</h3>
      <ul className="flex flex-col gap-1.5">
        {items.map((item) => (
          <li key={item.slug}>
            <Link href={helpHref(realm, item.slug)} onClick={onOpen} className="group flex items-center gap-3 rounded-[12px] border border-line-2 px-3 py-2.5 transition hover:-translate-y-px hover:border-accent/35 hover:bg-surface-2">
              <BookOpen size={15} className="flex-none text-fg-3 transition group-hover:text-accent" />
              <span className="min-w-0 flex-1">
                <b className="block truncate text-[13px] font-semibold">{item.title}</b>
                <span className="block truncate text-[12px] text-fg-3">{item.summary}</span>
              </span>
              <ArrowRight size={14} className="flex-none text-fg-3 opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-100" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function PanelContent({ screen, pending, failed, realm, close }: { screen: HelpScreen | null; pending: boolean; failed: boolean; realm: HelpRealm; close: () => void }) {
  if (screen === null) {
    return <p className="py-10 text-center text-[13px] text-fg-3">{pending || !failed ? "Buscando la ayuda de esta pantalla…" : "No pudimos cargar la ayuda. Intenta de nuevo en un momento."}</p>;
  }

  const article = screen.article;

  return (
    <div data-testid="help-panel" data-slug={article?.slug ?? ""} className="flex flex-col gap-6">
      {article ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="t1" dot={false}>
              {article.module}
            </Badge>
            {article.origin !== "kipucontrol" && <Badge tone={ORIGIN_TONES[article.origin]}>{article.origin_label}</Badge>}
          </div>
          <HelpArticleBody summary={article.summary} steps={article.steps} faqs={article.faqs} compact />
          <HelpLinkList title="Más sobre esta pantalla" items={screen.more} realm={realm} onOpen={close} />
          <HelpLinkList title="Relacionado" items={screen.related} realm={realm} onOpen={close} />
        </>
      ) : (
        <>
          <div className="flex flex-col items-center rounded-[16px] border border-dashed border-line px-6 py-8 text-center">
            <span className="mb-3 grid h-11 w-11 place-items-center rounded-[14px] bg-surface-2 text-fg-3">
              <Compass size={20} />
            </span>
            <p className="text-[13.5px] font-semibold">Esta pantalla aún no tiene un artículo propio</p>
            <p className="mt-1 text-[12.5px] text-fg-3">Busca en el centro de ayuda o empieza por estas guías.</p>
          </div>
          <HelpLinkList title="Para empezar" items={screen.related} realm={realm} onOpen={close} />
        </>
      )}
    </div>
  );
}

export function HelpButton({ realm }: { realm: HelpRealm }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [screen, setScreen] = useState<HelpScreen | null>(null);
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();

  const load = useCallback(() => {
    setScreen(null);
    setFailed(false);
    startTransition(async () => {
      const result = await fetchScreen(realm.screenUrl, pathname);
      if (result.kind === "ok") setScreen(result.screen);
      if (result.kind === "unavailable") setFailed(true);
      if (result.kind === "expired") window.location.reload();
    });
  }, [realm.screenUrl, pathname]);

  const [openedAt, setOpenedAt] = useState(pathname);
  if (open && openedAt !== pathname) {
    setOpen(false);
    setOpenedAt(pathname);
  }

  const close = () => setOpen(false);
  const article = screen?.article ?? null;

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpenedAt(pathname);
          setOpen(true);
          load();
        }}
        aria-label="Ayuda de esta pantalla"
        title="Ayuda de esta pantalla"
        data-testid="help-button"
        className="group relative grid h-10 w-10 flex-none place-items-center rounded-xl text-fg-2 transition hover:bg-surface-2 hover:text-fg"
      >
        <CircleHelp size={18} className="transition-transform duration-300 group-hover:rotate-12 group-hover:scale-110" />
      </button>
      <SidePanel
        open={open}
        onOpenChange={setOpen}
        title={article?.title ?? "Ayuda"}
        description={article ? "Ayuda de la pantalla en la que estás." : "Guías y respuestas para trabajar en KipuControl."}
        footer={
          <>
            {article && screen?.can_manage && (
              <Button variant="ghost" size="sm" href={helpHref(realm, article.slug, true)} icon={<Pencil size={14} />}>
                Editar
              </Button>
            )}
            <Button variant="primary" size="sm" href={realm.centerHref} icon={<BookOpen size={15} />} data-testid="help-center-link">
              Ver todo en el centro de ayuda
            </Button>
          </>
        }
      >
        <PanelContent screen={screen} pending={pending} failed={failed} realm={realm} close={close} />
      </SidePanel>
    </>
  );
}
