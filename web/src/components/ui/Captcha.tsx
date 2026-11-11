"use client";

import Script from "next/script";
import { useCallback, useEffect, useRef, useState } from "react";
import { loadCaptchaSiteKey } from "@/lib/server/captcha-key";

export const CAPTCHA_FIELD = "cf-turnstile-response";

interface TurnstileApi {
  render: (element: HTMLElement, options: Record<string, unknown>) => string;
  remove: (widgetId: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

export function Captcha({ theme = "auto" }: { theme?: "auto" | "light" | "dark" }) {
  const [siteKey, setSiteKey] = useState<string | null>(null);
  const holder = useRef<HTMLDivElement>(null);
  const widget = useRef<string | null>(null);

  useEffect(() => {
    let alive = true;
    loadCaptchaSiteKey()
      .then((key) => alive && setSiteKey(key))
      .catch(() => alive && setSiteKey(null));
    return () => {
      alive = false;
    };
  }, []);

  const mount = useCallback(() => {
    if (!siteKey || !holder.current || !window.turnstile || widget.current) return;
    widget.current = window.turnstile.render(holder.current, { sitekey: siteKey, appearance: "interaction-only", theme, language: "es", "response-field-name": CAPTCHA_FIELD });
  }, [siteKey, theme]);

  useEffect(() => {
    mount();
    return () => {
      if (widget.current && window.turnstile) window.turnstile.remove(widget.current);
      widget.current = null;
    };
  }, [mount]);

  if (siteKey === null) return null;
  return (
    <>
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" strategy="afterInteractive" onReady={mount} />
      <div ref={holder} />
    </>
  );
}
