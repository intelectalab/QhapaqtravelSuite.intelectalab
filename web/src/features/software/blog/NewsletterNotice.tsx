"use client";

import { CheckCircle2, CircleAlert, MailX } from "lucide-react";
import type { ReactNode } from "react";
import { useActionState } from "react";
import { unsubscribeNewsletter } from "@/app/(software)/software/actions";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import type { FormResult } from "@/lib/landing-content";

export function NewsletterNotice({ tone, title, children, actions }: { tone: "ok" | "bad" | "warn"; title: string; children: ReactNode; actions?: ReactNode }) {
  const Icon = tone === "ok" ? CheckCircle2 : tone === "warn" ? MailX : CircleAlert;
  return (
    <section className="relative isolate overflow-hidden">
      <span aria-hidden className="ambient-glow absolute inset-0 -z-10" />
      <div className="mx-auto max-w-[560px] px-5 py-20 sm:py-28">
        <div className="rounded-[26px] border border-line bg-surface p-8 text-center shadow-[var(--shadow-card)] animate-[rise-in_520ms_cubic-bezier(0.22,1,0.36,1)_backwards] sm:p-10">
          <span className={cn("mx-auto grid h-14 w-14 place-items-center rounded-[18px]", tone === "ok" ? "bg-ok/12 text-ok" : tone === "warn" ? "bg-warn/12 text-warn" : "bg-bad/12 text-bad")}>
            <Icon size={26} />
          </span>
          <h1 className="site-display mt-5 text-[26px] font-bold tracking-[-0.03em] text-fg">{title}</h1>
          <div className="mt-3 text-[15px] leading-relaxed text-fg-2">{children}</div>
          {actions && <div className="mt-7 flex flex-wrap justify-center gap-2">{actions}</div>}
        </div>
      </div>
    </section>
  );
}

export function UnsubscribeForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState<FormResult | null, FormData>(unsubscribeNewsletter, null);
  if (state?.ok) {
    return (
      <NewsletterNotice tone="ok" title="Listo, te diste de baja" actions={<Button href="/software/blog">Volver al blog</Button>}>
        {state.message}
      </NewsletterNotice>
    );
  }
  return (
    <NewsletterNotice tone="warn" title="¿Darte de baja del boletín?">
      <p>Dejarás de recibir el boletín mensual de KipuControl. Puedes volver a suscribirte cuando quieras.</p>
      <form action={action} className="mt-7 flex flex-wrap justify-center gap-2">
        <input type="hidden" name="token" value={token} />
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Aplicando…" : "Darme de baja"}
        </Button>
        <Button href="/software/blog" variant="ghost">
          Seguir suscrito
        </Button>
      </form>
      {state && !state.ok && (
        <p role="alert" className="mt-4 text-[13px] font-medium text-bad">
          {state.message}
        </p>
      )}
    </NewsletterNotice>
  );
}
