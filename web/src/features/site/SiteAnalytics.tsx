"use client";

import { BarChart3 } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { recordSiteEvents } from "@/app/(sitio)/sitio/[agencia]/actions";
import { ANALYTICS_CONSENT_KEY, SITE_TRACK_EVENT, type SiteEvent, type SiteEventName } from "@/lib/site-analytics";
import { useStoredValue } from "@/lib/useStoredValue";
import { useSite } from "./SiteContext";

type Consent = "granted" | "denied" | null;

const SESSION_KEY = "site_analytics_session";

const FLUSH_MS = 4000;

const parseConsent = (raw: string | null): Consent => (raw === "granted" || raw === "denied" ? raw : null);

const serializeConsent = (value: Consent): string => value ?? "";

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
  const { agencia, base } = useSite();
  const pathname = usePathname();
  const [consent, setConsent] = useStoredValue<Consent>(ANALYTICS_CONSENT_KEY, parseConsent, serializeConsent);
  const queue = useRef<SiteEvent[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (consent !== "granted") return;
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
  }, [consent, agencia]);

  useEffect(() => {
    if (consent !== "granted") return;
    const page = base && pathname.startsWith(base) ? pathname.slice(base.length) || "/" : pathname;
    window.dispatchEvent(new CustomEvent<SiteEvent>(SITE_TRACK_EVENT, { detail: { event: "page_view", params: { page, title: document.title } } }));
  }, [pathname, consent, base]);

  if (consent !== null) return null;

  return (
    <div role="region" aria-label="Preferencias de cookies" className="fixed inset-x-3 bottom-3 z-40 mx-auto max-w-[560px] rounded-card border border-line bg-surface/95 p-4 shadow-[0_24px_50px_-24px_rgb(14_17_32/0.45)] backdrop-blur animate-[rise-in_420ms_cubic-bezier(0.22,1,0.36,1)_backwards]">
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 flex-none place-items-center rounded-xl bg-[color-mix(in_srgb,var(--t1)_11%,transparent)] text-t1">
          <BarChart3 size={17} />
        </span>
        <p className="min-w-0 text-[13px] leading-relaxed text-fg-2">Usamos cookies analíticas para saber qué páginas visitas y mejorar el sitio. No las activamos sin tu permiso.</p>
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <button type="button" onClick={() => setConsent("denied")} className="h-9 rounded-control px-3.5 text-[13px] font-semibold text-fg-2 transition hover:bg-surface-2 hover:text-fg">
          Solo las necesarias
        </button>
        <button type="button" onClick={() => setConsent("granted")} className="h-9 rounded-control bg-brand px-3.5 text-[13px] font-semibold text-brand-fg transition hover:brightness-110">
          Aceptar analíticas
        </button>
      </div>
    </div>
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
