"use client";

import { CircleAlert, CloudCheck, ExternalLink, LoaderCircle, Maximize2, Minimize2, Monitor, PencilLine, RefreshCw, Rocket, Smartphone, Tablet } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { saveSiteDraft } from "@/app/(backoffice)/admin/personalizacion/actions";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { SectionLayout } from "@/components/ui/SectionNav";
import { cn } from "@/lib/cn";
import { PREVIEW_MESSAGE, type SiteDesign, type SiteDesignOverview, type SiteThemeVars } from "@/lib/site-design";
import { PersonalizationNav } from "./PersonalizationNav";
import type { SiteSectionKey } from "./sections";
import { SiteSectionForm } from "./SiteSections";

type SaveStatus = "saved" | "dirty" | "saving" | "error" | "conflict";

type Device = "escritorio" | "tablet" | "movil";

const DEVICES: { id: Device; label: string; width: number; icon: typeof Monitor }[] = [
  { id: "escritorio", label: "Escritorio", width: 1280, icon: Monitor },
  { id: "tablet", label: "Tableta", width: 820, icon: Tablet },
  { id: "movil", label: "Celular", width: 390, icon: Smartphone },
];

const PAGES = [
  { value: "", label: "Inicio" },
  { value: "/tours", label: "Tours y paquetes" },
  { value: "/destinos", label: "Destinos" },
  { value: "/ofertas", label: "Ofertas" },
  { value: "/nosotros", label: "Nosotros" },
  { value: "/contacto", label: "Contacto" },
];

const SAVE_DELAY_MS = 700;

export interface StudioContext {
  data: SiteDesignOverview;
  design: SiteDesign;
  change: (recipe: (draft: SiteDesign) => void) => void;
  errors: Record<string, string>;
  setData: (data: SiteDesignOverview) => void;
  load: (data: SiteDesignOverview) => void;
  status: SaveStatus;
  pending: string[];
  imageHref: (id: string) => string;
}

function effectiveTheme(design: SiteDesign, panel: SiteDesignOverview["panel_colors"]): SiteThemeVars {
  const colors = design.theme.colors === "panel" ? panel : design.theme;
  return { brand: colors.brand, accent: colors.accent, menu: colors.menu, font: design.theme.font, corners: design.theme.corners };
}

export function SiteStudio({ data: initial, section }: { data: SiteDesignOverview; section: SiteSectionKey }) {
  const [data, setData] = useState(initial);
  const [design, setDesign] = useState(initial.draft);
  const [status, setStatus] = useState<SaveStatus>("saved");
  const [message, setMessage] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(initial.pending);
  const [savedAt, setSavedAt] = useState(initial.draft_updated_at);
  const latest = useRef(initial.draft);
  const lock = useRef(initial.lock_version);
  const saving = useRef(false);
  const again = useRef(false);
  const timer = useRef<number | undefined>(undefined);
  const frame = useRef<HTMLIFrameElement>(null);
  const flushRef = useRef<() => Promise<void>>(async () => undefined);
  const subdomain = initial.site.subdomain;
  const imageHref = useCallback((id: string) => `/sitio/${subdomain}/imagen/${id}`, [subdomain]);

  const post = useCallback((message: Record<string, unknown>) => {
    frame.current?.contentWindow?.postMessage({ source: PREVIEW_MESSAGE, ...message }, window.location.origin);
  }, []);

  const flush = useCallback(async () => {
    if (saving.current) {
      again.current = true;
      return;
    }
    saving.current = true;
    setStatus("saving");
    const snapshot = latest.current;
    const result = await saveSiteDraft(snapshot, lock.current);
    saving.current = false;
    if (result.ok) {
      lock.current = result.lock_version;
      setPending(result.pending);
      setSavedAt(result.draft_updated_at);
      setErrors({});
      setMessage(null);
      post({ action: "refresh" });
      if (again.current || latest.current !== snapshot) {
        again.current = false;
        setStatus("dirty");
        timer.current = window.setTimeout(() => void flushRef.current(), SAVE_DELAY_MS);
      } else {
        setStatus("saved");
      }
      return;
    }
    again.current = false;
    setErrors(result.errors);
    setMessage(result.message);
    setStatus(result.conflict ? "conflict" : "error");
  }, [post]);

  const change = useCallback(
    (recipe: (draft: SiteDesign) => void) => {
      const next = structuredClone(latest.current);
      recipe(next);
      latest.current = next;
      setDesign(next);
      setStatus("dirty");
      post({ action: "theme", theme: effectiveTheme(next, data.panel_colors) });
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => void flushRef.current(), SAVE_DELAY_MS);
    },
    [data.panel_colors, post],
  );

  useEffect(() => {
    flushRef.current = flush;
  }, [flush]);

  const load = useCallback(
    (next: SiteDesignOverview) => {
      window.clearTimeout(timer.current);
      setData(next);
      latest.current = next.draft;
      lock.current = next.lock_version;
      setDesign(next.draft);
      setPending(next.pending);
      setSavedAt(next.draft_updated_at);
      setErrors({});
      setMessage(null);
      setStatus("saved");
      post({ action: "refresh" });
    },
    [post],
  );

  useEffect(() => {
    if (status !== "dirty" && status !== "saving") return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [status]);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const context: StudioContext = { data, design, change, errors, setData, load, status, pending, imageHref };

  return (
    <SectionLayout nav={<PersonalizationNav active={section} pending={pending.length} />}>
      <div className="grid items-start gap-5 min-[1360px]:grid-cols-[minmax(340px,410px)_minmax(0,1fr)]">
        <div className="min-w-0">
          <StatusBar status={status} message={message} pending={pending} savedAt={savedAt} section={section} />
          <div className="mt-4">
            <SiteSectionForm section={section} studio={context} />
          </div>
        </div>
        <PreviewPane subdomain={subdomain} frame={frame} onReady={() => post({ action: "theme", theme: effectiveTheme(latest.current, data.panel_colors) })} post={post} />
      </div>
    </SectionLayout>
  );
}

function StatusBar({ status, message, pending, savedAt, section }: { status: SaveStatus; message: string | null; pending: string[]; savedAt: string | null; section: SiteSectionKey }) {
  const label = {
    saved: savedAt ? "Borrador guardado" : "Sin cambios todavía",
    dirty: "Cambios por guardar",
    saving: "Guardando borrador…",
    error: "No se guardó el último cambio",
    conflict: "Otra persona cambió el diseño",
  }[status];
  const Icon = status === "saving" || status === "dirty" ? LoaderCircle : status === "saved" ? CloudCheck : CircleAlert;

  return (
    <div data-testid="site-studio-status" data-status={status} className={cn("sticky top-20 z-20 rounded-card border bg-surface/95 p-3 shadow-card backdrop-blur", status === "error" || status === "conflict" ? "border-[color-mix(in_srgb,var(--bad)_40%,transparent)]" : "border-line")}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className={cn("inline-flex items-center gap-1.5 text-[13px] font-semibold", status === "saved" ? "text-ok" : status === "error" || status === "conflict" ? "text-bad" : "text-fg-2")}>
          <Icon size={15} className={cn(status === "saving" && "animate-spin")} />
          {label}
        </span>
        <span className="text-[12.5px] text-fg-3">{pending.length === 0 ? "El sitio publicado está al día." : `${pending.length === 1 ? "1 parte" : `${pending.length} partes`} sin publicar: ${pending.join(", ")}.`}</span>
        <div className="ml-auto flex items-center gap-2">
          {status === "conflict" && (
            <Button size="sm" icon={<RefreshCw size={14} />} onClick={() => window.location.reload()}>
              Recargar
            </Button>
          )}
          {section !== "sitio-publicar" && pending.length > 0 && (
            <Button size="sm" variant="primary" icon={<Rocket size={14} />} href="/admin/personalizacion?seccion=sitio-publicar" data-testid="site-studio-go-publish">
              Publicar
            </Button>
          )}
        </div>
      </div>
      {message && <p className="mt-2 flex items-start gap-1.5 text-[12.5px] font-semibold text-bad"><PencilLine size={14} className="mt-0.5 flex-none" />{message}</p>}
    </div>
  );
}

function PreviewPane({ subdomain, frame, onReady, post }: { subdomain: string; frame: RefObject<HTMLIFrameElement | null>; onReady: () => void; post: (message: Record<string, unknown>) => void }) {
  const [device, setDevice] = useState<Device>("escritorio");
  const [page, setPage] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [box, setBox] = useState({ width: 0, height: 0 });
  const stage = useRef<HTMLDivElement>(null);
  const home = `/sitio/${subdomain}`;
  const [src] = useState(() => `${home}/vista-previa?ruta=${encodeURIComponent(home)}`);
  const width = DEVICES.find((item) => item.id === device)?.width ?? 1280;
  const scale = box.width > 0 ? Math.min(1, box.width / width) : 1;

  useLayoutEffect(() => {
    const element = stage.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setBox({ width: entry.contentRect.width, height: entry.contentRect.height }));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== frame.current?.contentWindow) return;
      const data = event.data as { source?: string; action?: string };
      if (data?.source === PREVIEW_MESSAGE && data.action === "ready") {
        setLoaded(true);
        onReady();
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [frame, onReady]);

  useEffect(() => {
    if (!expanded) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setExpanded(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expanded]);

  return (
    <>
      {expanded && <div aria-hidden className="fixed inset-0 z-[60] bg-[rgb(14_17_32/0.45)] backdrop-blur-[2px]" onClick={() => setExpanded(false)} />}
      <section
        aria-label="Vista previa del sitio"
        data-testid="site-preview"
        className={cn("flex flex-col overflow-hidden rounded-card border border-line bg-surface shadow-card", expanded ? "fixed inset-3 z-[61] sm:inset-6" : "h-[600px] min-[1360px]:sticky min-[1360px]:top-20 min-[1360px]:h-[calc(100vh-6.5rem)] min-[1360px]:min-h-[520px]")}
      >
        <header className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2">
          <span className="mr-1 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-fg-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ok opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-ok" />
            </span>
            Vista previa del borrador
          </span>
          <Select
            value={page}
            onChange={(value) => {
              setPage(value);
              post({ action: "navigate", path: `${home}${value}` });
            }}
            options={PAGES}
            ariaLabel="Página de la vista previa"
            className="h-8 w-[170px]"
            testId="site-preview-page"
          />
          <div role="group" aria-label="Tamaño de pantalla" className="flex rounded-[10px] bg-surface-2 p-0.5">
            {DEVICES.map((item) => (
              <button key={item.id} type="button" onClick={() => setDevice(item.id)} aria-pressed={device === item.id} title={item.label} aria-label={item.label} data-testid={`site-preview-device:${item.id}`} className={cn("grid h-7 w-8 place-items-center rounded-[8px] transition", device === item.id ? "bg-surface text-fg shadow-sm" : "text-fg-3 hover:text-fg")}>
                <item.icon size={15} />
              </button>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-1">
            <button type="button" onClick={() => post({ action: "refresh" })} title="Recargar vista previa" aria-label="Recargar vista previa" className="grid h-8 w-8 place-items-center rounded-lg text-fg-3 transition hover:bg-surface-2 hover:text-fg">
              <RefreshCw size={15} />
            </button>
            <Link href={`${home}/vista-previa?ruta=${encodeURIComponent(`${home}${page}`)}`} target="_blank" title="Abrir en una pestaña nueva" aria-label="Abrir en una pestaña nueva" className="grid h-8 w-8 place-items-center rounded-lg text-fg-3 transition hover:bg-surface-2 hover:text-fg">
              <ExternalLink size={15} />
            </Link>
            <button type="button" onClick={() => setExpanded(!expanded)} title={expanded ? "Reducir" : "Ampliar"} aria-label={expanded ? "Reducir vista previa" : "Ampliar vista previa"} data-testid="site-preview-expand" className="grid h-8 w-8 place-items-center rounded-lg text-fg-3 transition hover:bg-surface-2 hover:text-fg">
              {expanded ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
            </button>
          </div>
        </header>
        <div ref={stage} className="relative flex-1 overflow-hidden bg-[repeating-conic-gradient(var(--surface-2)_0%_25%,transparent_0%_50%)] [background-size:18px_18px]">
          {!loaded && (
            <div className="absolute inset-0 z-10 grid place-items-center bg-surface/70 text-[13px] text-fg-3">
              <span className="inline-flex items-center gap-2"><LoaderCircle size={16} className="animate-spin" /> Cargando tu sitio…</span>
            </div>
          )}
          <div className="absolute top-0 h-full" style={{ width: width * scale, left: Math.max(0, (box.width - width * scale) / 2) }}>
            <iframe
              ref={frame}
              src={src}
              title="Vista previa del sitio web"
              data-testid="site-preview-frame"
              className={cn("origin-top-left border-0 bg-bg transition-[width] duration-300", device !== "escritorio" && "shadow-[0_0_0_1px_var(--line)]")}
              style={{ width, height: scale > 0 ? box.height / scale : box.height, transform: `scale(${scale})` }}
            />
          </div>
        </div>
      </section>
    </>
  );
}
