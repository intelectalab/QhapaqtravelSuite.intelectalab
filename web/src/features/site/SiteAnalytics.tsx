"use client";

import { Cookie } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { recordSiteEvents } from "@/app/(sitio)/sitio/[agencia]/actions";
import { cn } from "@/lib/cn";
import { ANALYTICS_CONSENT_KEY, COOKIE_POLICY_VERSION, COOKIE_PREFERENCES_EVENT, SITE_TRACK_EVENT, type SiteEvent, type SiteEventName } from "@/lib/site-analytics";
import { useStoredValue } from "@/lib/useStoredValue";
import { useSite } from "./SiteContext";

interface Consent {
  version: string;
  analytics: boolean;
  marketing: boolean;
  at: string;
}

const SESSION_KEY = "site_analytics_session";

const FLUSH_MS = 4000;

const parseConsent = (raw: string | null): Consent | null => {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<Consent>;
    return value.version === COOKIE_POLICY_VERSION ? { version: value.version, analytics: value.analytics === true, marketing: value.marketing === true, at: String(value.at ?? "") } : null;
  } catch {
    return null;
  }
};

const serializeConsent = (value: Consent | null): string => (value ? JSON.stringify(value) : "");

const COPY = {
  es: {
    region: "Preferencias de cookies",
    intro: "Usamos cookies técnicas para que el sitio funcione. Las analíticas y de marketing solo se activan si las aceptas.",
    necessary: ["Técnicas", "Carrito, idioma y sesión. Siempre activas."],
    analytics: ["Analíticas", "Páginas visitadas y búsquedas, para mejorar el sitio."],
    marketing: ["Marketing", "Medir campañas y mostrarte ofertas relevantes."],
    configure: "Configurar",
    reject: "Solo las necesarias",
    accept: "Aceptar todas",
    save: "Guardar preferencias",
    version: (version: string) => `Política de cookies ${version}`,
  },
  en: {
    region: "Cookie preferences",
    intro: "We use technical cookies so the site works. Analytics and marketing cookies are only enabled if you accept them.",
    necessary: ["Technical", "Cart, language and session. Always on."],
    analytics: ["Analytics", "Pages visited and searches, to improve the site."],
    marketing: ["Marketing", "Measure campaigns and show you relevant offers."],
    configure: "Customize",
    reject: "Necessary only",
    accept: "Accept all",
    save: "Save preferences",
    version: (version: string) => `Cookie policy ${version}`,
  },
} as const;

function CookieToggle({ title, text, checked, disabled, onChange }: { title: string; text: string; checked: boolean; disabled?: boolean; onChange?: (value: boolean) => void }) {
  return (
    <label className={cn("flex items-start gap-3 rounded-tile border border-line px-3 py-2.5", disabled ? "opacity-70" : "cursor-pointer hover:bg-surface-2")}>
      <span className="min-w-0 flex-1">
        <b className="block text-[13px] font-semibold">{title}</b>
        <span className="block text-[12px] text-fg-3">{text}</span>
      </span>
      <span className={cn("relative mt-0.5 inline-flex h-5 w-9 flex-none rounded-full transition", checked ? "bg-brand" : "bg-line")}>
        <input type="checkbox" className="peer sr-only" checked={checked} disabled={disabled} onChange={(event) => onChange?.(event.target.checked)} />
        <span className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all", checked ? "left-[18px]" : "left-0.5")} />
      </span>
    </label>
  );
}

function sessionId(): string {
  try {
    const stored = sessionStorage.getItem(SESSION_KEY);
    if (stored) return stored;
    const created = crypto.randomUUID().replaceAll("-", "").slice(0, 24);
    sessionStorage.setItem(SESSION_KEY, created);
    return created;
  } catch {
    return crypto.randomUUID().replaceAll("-", "").slice(0, 24);
  }
}

export function SiteAnalytics() {
  const { agencia, base, locale } = useSite();
  const pathname = usePathname();
  const [consent, setConsent] = useStoredValue<Consent | null>(ANALYTICS_CONSENT_KEY, parseConsent, serializeConsent);
  const [reopened, setReopened] = useState(false);
  const [custom, setCustom] = useState<{ analytics: boolean; marketing: boolean } | null>(null);
  const queue = useRef<SiteEvent[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const analytics = consent?.analytics === true;
  const t = COPY[locale === "en" ? "en" : "es"];

  useEffect(() => {
    const open = () => {
      setReopened(true);
      setCustom(null);
    };
    window.addEventListener(COOKIE_PREFERENCES_EVENT, open);
    return () => window.removeEventListener(COOKIE_PREFERENCES_EVENT, open);
  }, []);

  useEffect(() => {
    if (!analytics) return;
    const flush = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      const events = queue.current.splice(0, 50);
      if (events.length > 0) void recordSiteEvents(agencia, { session_id: sessionId(), events });
    };
    const push = (event: SiteEvent) => {
      queue.current.push(event);
      if (queue.current.length >= 20) flush();
      else if (!timer.current) timer.current = setTimeout(flush, FLUSH_MS);
    };
    const onTrack = (event: Event) => push((event as CustomEvent<SiteEvent>).detail);
    const onHide = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener(SITE_TRACK_EVENT, onTrack);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener(SITE_TRACK_EVENT, onTrack);
      document.removeEventListener("visibilitychange", onHide);
      flush();
    };
  }, [analytics, agencia]);

  useEffect(() => {
    if (!analytics) return;
    const page = base && pathname.startsWith(base) ? pathname.slice(base.length) || "/" : pathname;
    window.dispatchEvent(new CustomEvent<SiteEvent>(SITE_TRACK_EVENT, { detail: { event: "page_view", params: { page, title: document.title } } }));
  }, [pathname, analytics, base]);

  if (consent !== null && !reopened) return null;

  const save = (choice: { analytics: boolean; marketing: boolean }) => {
    setConsent({ version: COOKIE_POLICY_VERSION, ...choice, at: new Date().toISOString() });
    setReopened(false);
    setCustom(null);
  };

  return (
    <div role="region" aria-label={t.region} data-testid="cookie-banner" className="fixed inset-x-3 bottom-3 z-40 mx-auto max-w-[560px] rounded-card border border-line bg-surface/95 p-4 shadow-[0_24px_50px_-24px_rgb(14_17_32/0.45)] backdrop-blur animate-[rise-in_420ms_cubic-bezier(0.22,1,0.36,1)_backwards]">
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 flex-none place-items-center rounded-xl bg-[color-mix(in_srgb,var(--t1)_11%,transparent)] text-t1">
          <Cookie size={17} />
        </span>
        <span className="min-w-0">
          <p className="text-[13px] leading-relaxed text-fg-2">{t.intro}</p>
          <span className="mt-0.5 block text-[11.5px] text-fg-3">{t.version(COOKIE_POLICY_VERSION)}</span>
        </span>
      </div>
      {custom && (
        <div className="mt-3 flex flex-col gap-2">
          <CookieToggle title={t.necessary[0]} text={t.necessary[1]} checked disabled />
          <CookieToggle title={t.analytics[0]} text={t.analytics[1]} checked={custom.analytics} onChange={(value) => setCustom({ ...custom, analytics: value })} />
          <CookieToggle title={t.marketing[0]} text={t.marketing[1]} checked={custom.marketing} onChange={(value) => setCustom({ ...custom, marketing: value })} />
        </div>
      )}
      <div className="mt-3 flex flex-wrap justify-end gap-2">
        {custom ? (
          <button type="button" onClick={() => save(custom)} className="h-9 rounded-control bg-brand px-3.5 text-[13px] font-semibold text-brand-fg transition hover:brightness-110">
            {t.save}
          </button>
        ) : (
          <>
            <button type="button" onClick={() => setCustom({ analytics: consent?.analytics ?? false, marketing: consent?.marketing ?? false })} className="h-9 rounded-control px-3.5 text-[13px] font-semibold text-fg-2 transition hover:bg-surface-2 hover:text-fg">
              {t.configure}
            </button>
            <button type="button" onClick={() => save({ analytics: false, marketing: false })} className="h-9 rounded-control px-3.5 text-[13px] font-semibold text-fg-2 transition hover:bg-surface-2 hover:text-fg">
              {t.reject}
            </button>
            <button type="button" onClick={() => save({ analytics: true, marketing: true })} className="h-9 rounded-control bg-brand px-3.5 text-[13px] font-semibold text-brand-fg transition hover:brightness-110">
              {t.accept}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export function CookiePreferencesButton({ label, className }: { label: string; className?: string }) {
  return (
    <button type="button" onClick={() => window.dispatchEvent(new Event(COOKIE_PREFERENCES_EVENT))} className={className}>
      {label}
    </button>
  );
}

export function TrackEvent({ event, params }: { event: SiteEventName; params?: SiteEvent["params"] }) {
  const key = JSON.stringify([event, params ?? {}]);
  useEffect(() => {
    const [name, detail] = JSON.parse(key) as [SiteEventName, SiteEvent["params"]];
    const id = setTimeout(() => window.dispatchEvent(new CustomEvent<SiteEvent>(SITE_TRACK_EVENT, { detail: { event: name, params: detail } })), 0);
    return () => clearTimeout(id);
  }, [key]);
  return null;
}
