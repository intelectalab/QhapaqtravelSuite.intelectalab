"use client";

import { MapPin, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useRef } from "react";
import { startWidgetHandoff } from "@/app/(sitio)/widget/actions";
import type { ProductDetail, Quote, WidgetConfig } from "@/lib/site";
import { RatingLine } from "./Bits";
import { AvailabilityCalendar, BookingPanel, BookingProvider, type BookingSelection } from "./ProductBooking";
import { useSite } from "./SiteContext";

type WidgetEvent = "kipucontrol:ready" | "kipucontrol:resize" | "kipucontrol:date_selected" | "kipucontrol:quote" | "kipucontrol:checkout";

function parentOrigin(verified: string[]): string | null {
  if (typeof window === "undefined" || window.parent === window) return null;
  const ancestors = window.location.ancestorOrigins;
  const raw = ancestors && ancestors.length > 0 ? ancestors[0] : document.referrer;
  if (!raw) return null;
  try {
    const origin = new URL(raw).origin;
    const host = new URL(origin).hostname;
    return origin === window.location.origin || verified.includes(host) ? origin : null;
  } catch {
    return null;
  }
}

export function useWidgetEvents(verified: string[]) {
  const origin = useRef<string | null>(null);
  useEffect(() => {
    origin.current = parentOrigin(verified);
  }, [verified]);
  return useCallback((type: WidgetEvent, detail: Record<string, unknown>) => {
    const target = origin.current ?? parentOrigin(verified);
    if (target) window.parent.postMessage({ type, detail }, target);
  }, [verified]);
}

export function WidgetFrame({ verified, children }: { verified: string[]; children: React.ReactNode }) {
  const emit = useWidgetEvents(verified);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = root.current;
    if (!node) return;
    const observer = new ResizeObserver(() => emit("kipucontrol:resize", { height: Math.ceil(node.getBoundingClientRect().height) }));
    observer.observe(node);
    return () => observer.disconnect();
  }, [emit]);
  return (
    <div ref={root} className="mx-auto w-full max-w-[1080px] px-4 py-5 sm:px-6">
      {children}
    </div>
  );
}

export function WidgetBooking({ config, detail, widgetKey, currency, reviews }: { config: WidgetConfig; detail: ProductDetail; widgetKey: string | undefined; currency: string; reviews: boolean }) {
  const { t, locale } = useSite();
  const emit = useWidgetEvents(config.domains);
  const product = detail.product;
  const lastDate = useRef<string | null>(null);

  useEffect(() => {
    emit("kipucontrol:ready", { product: config.product?.code ?? null, currency, lang: locale });
  }, [emit, config.product, currency, locale]);

  const onQuote = useCallback((quote: Quote, selection: BookingSelection) => {
    if (lastDate.current !== selection.date) {
      lastDate.current = selection.date;
      emit("kipucontrol:date_selected", { date: selection.date });
    }
    emit("kipucontrol:quote", { total: Number(quote.total), currency: quote.currency, date: selection.date, adults: selection.adults, children: selection.children, infants: selection.infants });
  }, [emit]);

  const onReserve = useCallback(async (selection: BookingSelection) => {
    const origin = parentOrigin(config.domains);
    const result = await startWidgetHandoff(widgetKey, { product: selection.product, date: selection.date, adults: selection.adults, children: selection.children, infants: selection.infants, lang: locale, currency, origin });
    if (!result.ok || !result.handoff) return { ok: false, message: result.message };
    emit("kipucontrol:checkout", { handoffId: result.handoff.code, total: Number(result.handoff.total), currency: result.handoff.currency });
    window.open(result.handoff.checkout_url, window.parent === window ? "_self" : "_top");
    return { ok: true, message: null };
  }, [config.domains, widgetKey, locale, currency, emit]);

  return (
    <BookingProvider detail={detail}>
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[12px] font-semibold text-fg-3">{t.widget.eyebrow}</p>
          <h1 className="mt-0.5 text-[22px] font-bold leading-tight tracking-tight text-fg sm:text-[26px]">{product.name}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] text-fg-3">
            <span className="inline-flex items-center gap-1.5">
              <MapPin size={13} />
              {product.destination.name}
            </span>
            {reviews && product.rating && <RatingLine rating={product.rating} compact />}
          </p>
        </div>
      </header>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div id="calendario" className="min-w-0">
          <AvailabilityCalendar />
        </div>
        <BookingPanel onReserve={onReserve} onQuote={onQuote} reserveLabel={t.widget.continue} />
      </div>
      <p className="mt-5 flex items-center justify-center gap-1.5 text-[11.5px] text-fg-3">
        <ShieldCheck size={13} />
        {t.widget.poweredBy(config.agency.name)}
      </p>
    </BookingProvider>
  );
}
