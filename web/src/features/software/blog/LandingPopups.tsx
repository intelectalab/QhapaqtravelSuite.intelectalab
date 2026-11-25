"use client";

import { ArrowRight, Mail, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { loadPopups, recordPopup } from "@/app/(software)/software/actions";
import { cn } from "@/lib/cn";
import { popupDue, type PopupPage, popupPage, type PublicPopup, rememberSignupEmail } from "@/lib/landing-content";
import { NewsletterForm } from "./NewsletterForm";

const VISIT_KEY = "kipu_popup_visit";
const SHOWN_PREFIX = "kipu_popup_";
const LOAD_DELAY_MS = 3000;

function read(storage: "local" | "session", key: string): string | null {
  try {
    return (storage === "local" ? window.localStorage : window.sessionStorage).getItem(key);
  } catch {
    return null;
  }
}

function write(storage: "local" | "session", key: string, value: string) {
  try {
    (storage === "local" ? window.localStorage : window.sessionStorage).setItem(key, value);
  } catch {}
}

function scrolledPercent(): number {
  const max = document.documentElement.scrollHeight - window.innerHeight;
  return max <= 0 ? 100 : (window.scrollY / max) * 100;
}

function TrialCapture({ popup, onConvert }: { popup: PublicPopup; onConvert: () => void }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setError("Escribe un correo válido.");
        onConvert();
        rememberSignupEmail(email.trim());
        router.push(popup.cta_href ?? "/software/suscribirse?ciclo=prueba");
      }}
      className="grid gap-2"
    >
      <div className="flex items-center gap-1.5 rounded-[14px] border border-line bg-surface p-1.5 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/15">
        <Mail size={17} className="ml-2 flex-none text-fg-3" />
        <label htmlFor={`popup-${popup.code}`} className="sr-only">
          Correo electrónico
        </label>
        <input id={`popup-${popup.code}`} type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="tu@agencia.pe" className="h-10 min-w-0 flex-1 bg-transparent px-1.5 text-[14px] text-fg outline-none placeholder:text-fg-3" />
        <button type="submit" className="inline-flex h-10 flex-none items-center gap-1.5 rounded-[10px] bg-brand px-3.5 text-[13.5px] font-semibold text-brand-fg transition hover:brightness-110">
          {popup.cta_label}
          <ArrowRight size={15} />
        </button>
      </div>
      {error && (
        <p role="alert" className="text-[12.5px] font-medium text-bad">
          {error}
        </p>
      )}
    </form>
  );
}

function PopupBody({ popup, onConvert, onClose }: { popup: PublicPopup; onConvert: () => void; onClose: () => void }) {
  if (popup.kind === "boletin") return <NewsletterForm source={popup.trigger === "scroll_60" ? "scroll_60" : "popup_salida"} cta={popup.cta_label} onDone={onConvert} />;
  if (popup.kind === "prueba") return <TrialCapture popup={popup} onConvert={onConvert} />;
  return (
    <Link
      href={popup.cta_href ?? "/"}
      onClick={() => {
        onConvert();
        onClose();
      }}
      className="inline-flex h-11 w-fit items-center gap-2 rounded-[12px] bg-brand px-5 text-[14px] font-semibold text-brand-fg transition hover:gap-3 hover:brightness-110"
    >
      {popup.cta_label}
      <ArrowRight size={16} />
    </Link>
  );
}

export function LandingPopups({ signedIn }: { signedIn: boolean }) {
  const page = popupPage(usePathname());
  return page && !signedIn ? <PopupHost key={page} page={page} /> : null;
}

function PopupHost({ page }: { page: PopupPage }) {
  const [popups, setPopups] = useState<PublicPopup[]>([]);
  const [current, setCurrent] = useState<PublicPopup | null>(null);
  const converted = useRef(false);
  const lastFocus = useRef<HTMLElement | null>(null);
  const dialog = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (read("session", VISIT_KEY) === "1") return;
    const timer = window.setTimeout(() => {
      void loadPopups(page).then((list) => setPopups(list.filter((popup) => popupDue(read("local", SHOWN_PREFIX + popup.code), popup.freq_days))));
    }, LOAD_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [page]);

  const show = useCallback((popup: PublicPopup) => {
    if (read("session", VISIT_KEY) === "1") return;
    write("session", VISIT_KEY, "1");
    write("local", SHOWN_PREFIX + popup.code, String(Date.now()));
    lastFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    converted.current = false;
    setCurrent(popup);
    setPopups([]);
    void recordPopup(popup.code, "view");
  }, []);

  const close = useCallback(() => {
    setCurrent(null);
    lastFocus.current?.focus();
  }, []);

  const convert = useCallback(() => {
    if (!current || converted.current) return;
    converted.current = true;
    void recordPopup(current.code, "conversion");
  }, [current]);

  useEffect(() => {
    if (popups.length === 0) return;
    const desktop = window.matchMedia("(min-width: 1024px) and (pointer: fine)").matches;
    const exit = popups.find((popup) => popup.trigger === "salida");
    const scroll = popups.find((popup) => popup.trigger === "scroll_60");
    const timed = popups.find((popup) => popup.trigger === "tiempo_30s");
    const onLeave = (event: MouseEvent) => {
      if (exit && desktop && event.relatedTarget === null && event.clientY <= 0) show(exit);
    };
    const onScroll = () => {
      if (scroll && scrolledPercent() >= 60) show(scroll);
    };
    const timer = timed ? window.setTimeout(() => show(timed), 30_000 - LOAD_DELAY_MS) : undefined;
    document.addEventListener("mouseout", onLeave);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      document.removeEventListener("mouseout", onLeave);
      window.removeEventListener("scroll", onScroll);
      if (timer) window.clearTimeout(timer);
    };
  }, [popups, show]);

  useEffect(() => {
    if (!current) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    dialog.current?.querySelector<HTMLElement>("input, a, button:not([data-close])")?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [current, close]);

  if (!current) return null;
  const slide = current.trigger === "scroll_60";

  const card = (
    <div ref={dialog} role="dialog" aria-modal={!slide} aria-labelledby={`popup-title-${current.code}`} className={cn("relative isolate overflow-hidden rounded-[24px] border border-line bg-surface p-6 shadow-[0_30px_80px_-30px_rgb(14_17_32/0.55)]", slide ? "w-[min(380px,calc(100vw-32px))] animate-[rise-in_420ms_cubic-bezier(0.22,1,0.36,1)_backwards]" : "w-[min(480px,calc(100vw-32px))] animate-[rise-in_520ms_cubic-bezier(0.22,1,0.36,1)_backwards] sm:p-8")}>
      <span aria-hidden className="weave-band site-weave-run absolute inset-x-0 top-0 h-1.5 bg-[length:112px_100%]" />
      <span aria-hidden className="ambient-glow absolute inset-0 -z-10 opacity-70" />
      <button type="button" data-close onClick={close} aria-label="Cerrar" className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full text-fg-3 transition hover:rotate-90 hover:bg-surface-2 hover:text-fg">
        <X size={17} />
      </button>
      {current.eyebrow && <p className="text-[12px] font-semibold tracking-[0.08em] text-t3">{current.eyebrow}</p>}
      <h2 id={`popup-title-${current.code}`} className={cn("site-display mt-2 pr-8 font-bold leading-tight tracking-[-0.03em] text-fg", slide ? "text-[19px]" : "text-[25px]")}>
        {current.title}
      </h2>
      <p className="mb-5 mt-2 text-[14px] leading-relaxed text-fg-2">{current.body}</p>
      <PopupBody popup={current} onConvert={convert} onClose={close} />
      {!slide && (
        <button type="button" data-close onClick={close} className="mt-4 text-[13px] font-semibold text-fg-3 transition hover:text-fg">
          No, gracias
        </button>
      )}
    </div>
  );

  return slide ? (
    <div className="fixed bottom-4 right-4 z-50">{card}</div>
  ) : (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[rgb(14_17_32/0.55)] p-4 backdrop-blur-sm animate-[fade-in_240ms_ease-out_backwards]" onMouseDown={(event) => event.target === event.currentTarget && close()}>
      {card}
    </div>
  );
}
