"use client";

import { Loader2, MessageCircle, Send, X } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { openSiteChat, readSiteChat, sendSiteChat } from "@/app/(sitio)/sitio/[agencia]/actions";
import { cn } from "@/lib/cn";
import type { ChatMessage } from "@/lib/site";
import { trackSiteEvent } from "@/lib/site-analytics";
import { CheckBox } from "./FormBits";
import { useSite } from "./SiteContext";

const POLL_MS = 15_000;

const COPY = {
  es: {
    open: "Chatea con nosotros",
    title: "Escríbenos",
    intro: "Un asesor te responde aquí mismo. Si cierras la página, seguimos la conversación por tu correo o WhatsApp.",
    name: "Tu nombre",
    contact: "Correo o WhatsApp",
    message: "¿En qué te ayudamos?",
    consent: (agency: string) => `Autorizo a ${agency} a usar estos datos para responder mi consulta (Ley 29733).`,
    start: "Iniciar chat",
    write: "Escribe tu mensaje",
    send: "Enviar",
    close: "Cerrar chat",
    you: "Tú",
    team: "Equipo",
    system: "Aviso",
  },
  en: {
    open: "Chat with us",
    title: "Message us",
    intro: "An advisor replies right here. If you close the page, we continue by email or WhatsApp.",
    name: "Your name",
    contact: "Email or WhatsApp",
    message: "How can we help?",
    consent: (agency: string) => `I authorize ${agency} to use this data to answer my request (Peruvian Law 29733).`,
    start: "Start chat",
    write: "Type your message",
    send: "Send",
    close: "Close chat",
    you: "You",
    team: "Team",
    system: "Notice",
  },
} as const;

const input = "h-10 w-full rounded-control border border-line bg-surface px-3 text-[13.5px] text-fg outline-none transition placeholder:text-fg-3 focus:border-brand";

export function SiteChat() {
  const { agencia, name: agency, locale } = useSite();
  const c = COPY[locale === "en" ? "en" : "es"];
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[] | null>(null);
  const [form, setForm] = useState({ name: "", contact: "", message: "", consent: false });
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    const load = async () => {
      const result = await readSiteChat(agencia);
      if (alive && result.messages) setMessages(result.messages);
    };
    void load();
    const timer = window.setInterval(load, POLL_MS);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [open, agencia]);

  useEffect(() => {
    end.current?.scrollIntoView({ block: "nearest" });
  }, [messages?.length]);

  const begin = () =>
    start(async () => {
      const result = await openSiteChat(agencia, form);
      setError(result.message);
      if (result.messages) {
        setMessages(result.messages);
        trackSiteEvent("generate_lead", { source: "web_chat" });
      }
    });

  const send = () =>
    start(async () => {
      const body = draft.trim();
      if (!body) return;
      const result = await sendSiteChat(agencia, body);
      setError(result.message);
      if (result.messages) {
        setMessages(result.messages);
        setDraft("");
      }
    });

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-3 max-sm:bottom-20">
      {open && (
        <section aria-label={c.title} className="flex max-h-[min(560px,calc(100dvh-140px))] w-[min(360px,calc(100vw-40px))] animate-[rise-in_260ms_cubic-bezier(0.22,1,0.36,1)_backwards] flex-col overflow-hidden rounded-card border border-line bg-surface shadow-[0_24px_60px_-28px_rgb(14_17_32/0.55)]">
          <header className="flex items-center justify-between gap-3 bg-brand px-4 py-3 text-brand-fg">
            <b className="text-[14.5px] font-semibold">{c.title}</b>
            <button type="button" onClick={() => setOpen(false)} aria-label={c.close} className="grid h-8 w-8 place-items-center rounded-lg transition hover:bg-white/15">
              <X size={16} />
            </button>
          </header>
          {messages ? (
            <>
              <div className="scroll-thin flex flex-1 flex-col gap-2.5 overflow-y-auto px-4 py-3">
                {messages.map((item, index) => {
                  const mine = item.from === "contacto";
                  return (
                    <div key={`${item.at}-${index}`} className={cn("flex flex-col", mine ? "items-end" : "items-start")}>
                      <span className="mb-0.5 text-[11px] text-fg-3">{mine ? c.you : item.from === "sistema" ? c.system : (item.author ?? c.team)}</span>
                      <p className={cn("max-w-[85%] whitespace-pre-line rounded-2xl px-3 py-2 text-[13px] leading-relaxed", mine ? "rounded-br-md bg-brand text-brand-fg" : item.from === "sistema" ? "rounded-bl-md bg-surface-2 text-fg-2" : "rounded-bl-md border border-line bg-surface text-fg")}>{item.body}</p>
                    </div>
                  );
                })}
                <div ref={end} />
              </div>
              <form
                className="flex items-end gap-2 border-t border-line px-3 py-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  send();
                }}
              >
                <textarea value={draft} onChange={(event) => setDraft(event.target.value)} rows={2} maxLength={1000} placeholder={c.write} aria-label={c.write} className="min-w-0 flex-1 resize-none rounded-control border border-line bg-surface px-3 py-2 text-[13.5px] text-fg outline-none placeholder:text-fg-3 focus:border-brand" />
                <button type="submit" disabled={pending || !draft.trim()} aria-label={c.send} className="grid h-10 w-10 flex-none place-items-center rounded-control bg-brand text-brand-fg transition hover:brightness-110 disabled:opacity-50">
                  {pending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                </button>
              </form>
            </>
          ) : (
            <form
              className="grid gap-2.5 px-4 py-4"
              onSubmit={(event) => {
                event.preventDefault();
                begin();
              }}
            >
              <p className="text-[12.5px] leading-relaxed text-fg-2">{c.intro}</p>
              <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder={c.name} aria-label={c.name} autoComplete="name" required minLength={2} maxLength={150} className={input} />
              <input value={form.contact} onChange={(event) => setForm({ ...form, contact: event.target.value })} placeholder={c.contact} aria-label={c.contact} required maxLength={190} className={input} />
              <textarea value={form.message} onChange={(event) => setForm({ ...form, message: event.target.value })} placeholder={c.message} aria-label={c.message} required minLength={2} maxLength={1000} rows={3} className="w-full resize-none rounded-control border border-line bg-surface px-3 py-2 text-[13.5px] text-fg outline-none placeholder:text-fg-3 focus:border-brand" />
              <CheckBox name="chat_consent" label={<span className="text-[12px] leading-snug">{c.consent(agency)}</span>} onChange={(checked) => setForm({ ...form, consent: checked })} />
              <button type="submit" disabled={pending || !form.consent} className="inline-flex h-10 items-center justify-center gap-2 rounded-control bg-brand text-[13.5px] font-semibold text-brand-fg transition hover:brightness-110 disabled:opacity-50">
                {pending ? <Loader2 size={16} className="animate-spin" /> : <MessageCircle size={16} />}
                {c.start}
              </button>
            </form>
          )}
          {error && <p className="border-t border-line bg-[color-mix(in_srgb,var(--bad)_8%,transparent)] px-4 py-2 text-[12.5px] text-bad">{error}</p>}
        </section>
      )}
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="group inline-flex h-12 items-center gap-2 rounded-full bg-brand px-4 text-[13.5px] font-semibold text-brand-fg shadow-[0_14px_30px_-14px_var(--brand)] transition hover:-translate-y-0.5 hover:brightness-110">
        {open ? <X size={18} /> : <MessageCircle size={18} className="transition-transform duration-300 group-hover:-rotate-12" />}
        <span className="max-sm:sr-only">{open ? c.close : c.open}</span>
      </button>
    </div>
  );
}
