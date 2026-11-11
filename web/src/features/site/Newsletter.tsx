"use client";

import { CheckCircle2, Mail, Send } from "lucide-react";
import { useActionState } from "react";
import { sendNewsletter } from "@/app/(sitio)/sitio/[agencia]/actions";
import { Captcha } from "@/components/ui/Captcha";
import { IDLE } from "@/lib/site";
import { Consent, FieldError, FormAlert } from "./FormBits";
import { useSite } from "./SiteContext";

export function Newsletter() {
  const { agencia, name, t } = useSite();
  const [state, action, pending] = useActionState(sendNewsletter.bind(null, agencia), IDLE);
  const done = state.status === "done";
  const existing = done && state.data?.status === "existente";

  return (
    <section className="relative overflow-hidden rounded-[28px] bg-menu px-6 py-10 text-white sm:px-10">
      <div className="weave-band absolute inset-x-0 top-0 h-1.5" />
      <div aria-hidden className="weave-tint absolute -right-10 top-0 h-full w-1/2 bg-white opacity-[0.05] [mask-size:36px_36px]" />
      <div className="relative grid items-center gap-8 lg:grid-cols-[1fr_1.1fr]">
        <div>
          <span className="inline-grid h-11 w-11 place-items-center rounded-2xl bg-white/10">
            <Mail size={20} className="text-t2" />
          </span>
          <h2 className="mt-4 text-[26px] font-bold leading-tight tracking-tight">{t.newsletter.title}</h2>
          <p className="mt-2 max-w-[46ch] text-[14px] leading-relaxed text-white/70">{t.newsletter.body}</p>
        </div>
        {done ? (
          <div className="flex items-start gap-3 rounded-2xl bg-white/10 p-5 animate-[rise-in_420ms_cubic-bezier(0.22,1,0.36,1)_backwards]">
            <CheckCircle2 size={22} className="flex-none text-ok" />
            <p className="text-[14px] leading-relaxed">
              {existing ? t.newsletter.existing : t.newsletter.done}
            </p>
          </div>
        ) : (
          <form action={action} className="grid gap-3 rounded-2xl bg-surface p-4 text-fg">
            <div className="flex flex-col gap-2 sm:flex-row">
              <label className="flex h-12 min-w-0 flex-1 items-center gap-2.5 rounded-control border border-line px-3.5 focus-within:border-accent">
                <Mail size={16} className="text-fg-3" />
                <span className="sr-only">{t.newsletter.email}</span>
                <input name="email" type="email" required placeholder={t.newsletter.placeholder} className="h-full min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-fg-3" />
              </label>
              <Captcha />
              <button type="submit" disabled={pending} className="inline-flex h-12 items-center justify-center gap-2 rounded-control bg-brand px-5 text-[14px] font-semibold text-brand-fg transition hover:brightness-110 disabled:opacity-60">
                <Send size={15} />
                {pending ? t.newsletter.sending : t.newsletter.subscribe}
              </button>
            </div>
            <FieldError message={state.errors?.email} />
            <Consent agency={name} error={state.errors?.consent} />
            {state.status === "error" && !state.errors?.email && !state.errors?.consent && <FormAlert message={state.message} />}
          </form>
        )}
      </div>
    </section>
  );
}
