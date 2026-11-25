"use client";

import { ArrowRight, CheckCircle2, Mail } from "lucide-react";
import Link from "next/link";
import { useActionState, useEffect } from "react";
import { subscribeNewsletter } from "@/app/(software)/software/actions";
import { cn } from "@/lib/cn";
import type { FormResult, NewsletterSource } from "@/lib/landing-content";

interface NewsletterFormProps {
  source: NewsletterSource;
  tone?: "light" | "dark";
  cta?: string;
  placeholder?: string;
  onDone?: () => void;
}

export function NewsletterForm({ source, tone = "light", cta = "Suscribirme", placeholder = "tu@agencia.pe", onDone }: NewsletterFormProps) {
  const [state, action, pending] = useActionState<FormResult | null, FormData>(subscribeNewsletter, null);
  const dark = tone === "dark";

  useEffect(() => {
    if (state?.ok) onDone?.();
  }, [state, onDone]);

  if (state?.ok) {
    return (
      <p role="status" className={cn("flex items-start gap-2.5 rounded-[14px] px-3.5 py-3 text-[13.5px] font-medium animate-[rise-in_420ms_cubic-bezier(0.22,1,0.36,1)_backwards]", dark ? "bg-white/10 text-white" : "bg-ok/10 text-fg")}>
        <CheckCircle2 size={18} className="mt-px flex-none text-ok" />
        {state.message}
      </p>
    );
  }

  return (
    <form action={action} noValidate className="grid gap-2">
      <input type="hidden" name="source" value={source} />
      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden className="absolute -left-[9999px] h-px w-px opacity-0" />
      <div className={cn("group flex items-center gap-1.5 rounded-[14px] border p-1.5 transition focus-within:ring-2", dark ? "border-white/15 bg-white/[0.07] focus-within:border-white/40 focus-within:ring-white/15" : "border-line bg-surface focus-within:border-accent focus-within:ring-accent/15")}>
        <Mail size={17} className={cn("ml-2 flex-none", dark ? "text-white/50" : "text-fg-3")} />
        <label className="sr-only" htmlFor={`newsletter-${source}`}>
          Correo electrónico
        </label>
        <input id={`newsletter-${source}`} name="email" type="email" required autoComplete="email" placeholder={placeholder} className={cn("h-10 min-w-0 flex-1 bg-transparent px-1.5 text-[14px] outline-none", dark ? "text-white placeholder:text-white/40" : "text-fg placeholder:text-fg-3")} />
        <button type="submit" disabled={pending} className="inline-flex h-10 flex-none items-center gap-1.5 rounded-[10px] bg-brand px-3.5 text-[13.5px] font-semibold text-brand-fg transition hover:brightness-110 disabled:opacity-60">
          {pending ? "Enviando…" : cta}
          <ArrowRight size={15} className="transition-transform duration-300 group-hover:translate-x-0.5" />
        </button>
      </div>
      {state && !state.ok && (
        <p role="alert" className={cn("text-[12.5px] font-medium", dark ? "text-[color-mix(in_srgb,var(--bad)_55%,white)]" : "text-bad")}>
          {state.message}
        </p>
      )}
      <p className={cn("text-[11.5px] leading-snug", dark ? "text-white/45" : "text-fg-3")}>
        Te pediremos confirmar el correo. Baja en un clic.{" "}
        <Link href="/software/legal/privacidad" className={cn("underline-offset-2 hover:underline", dark ? "text-white/65" : "text-fg-2")}>
          Privacidad
        </Link>
      </p>
    </form>
  );
}
