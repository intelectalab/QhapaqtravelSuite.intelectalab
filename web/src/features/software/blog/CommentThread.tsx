"use client";

import { BadgeCheck, CornerDownRight, MessageSquareText, ThumbsUp, X } from "lucide-react";
import Link from "next/link";
import { useActionState, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { markCommentUseful, submitComment } from "@/app/(software)/software/actions";
import { Button } from "@/components/ui/Button";
import { SwitchField } from "@/components/ui/SwitchField";
import { TextArea } from "@/components/ui/TextArea";
import { TextField } from "@/components/ui/TextField";
import { toast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/format";
import type { BlogComment, BlogThread, FormResult } from "@/lib/landing-content";
import { AuthorAvatar } from "./BlogCards";

type Order = "utiles" | "recientes";

function UsefulButton({ comment }: { comment: BlogComment }) {
  const [count, setCount] = useState(comment.useful);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending || done}
      onClick={() =>
        startTransition(async () => {
          const result = await markCommentUseful(comment.id);
          if (!result) {
            toast("No pudimos registrar tu voto.", "bad");
            return;
          }
          setCount(result.useful);
          setDone(true);
          if (!result.counted) toast(result.message, "warn");
        })
      }
      className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12.5px] font-semibold transition", done ? "bg-ok/12 text-ok" : "text-fg-2 hover:bg-surface-2 hover:text-fg")}
    >
      <ThumbsUp size={13} />
      Útil <span className="font-mono">{count}</span>
    </button>
  );
}

function CommentItem({ comment, onReply, nested = false }: { comment: BlogComment; onReply?: () => void; nested?: boolean }) {
  return (
    <article className={cn("group flex gap-3", nested && "rounded-[16px] bg-surface-2/70 p-3.5")}>
      <AuthorAvatar name={comment.name} size={nested ? 30 : 36} />
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <b className="text-[14px] text-fg">{comment.name}</b>
          {comment.staff && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[color-mix(in_srgb,var(--t1)_12%,transparent)] px-2 py-0.5 text-[11px] font-semibold text-t1">
              <BadgeCheck size={12} />
              Equipo KipuControl
            </span>
          )}
          <span className="text-[12px] text-fg-3">{formatDate(comment.created_at)}</span>
        </p>
        <p className="mt-1.5 whitespace-pre-line text-[14.5px] leading-relaxed text-fg-2">{comment.body}</p>
        <div className="mt-2 flex items-center gap-1">
          {onReply && (
            <button type="button" onClick={onReply} className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12.5px] font-semibold text-fg-2 transition hover:bg-surface-2 hover:text-fg">
              <CornerDownRight size={13} />
              Responder
            </button>
          )}
          <UsefulButton comment={comment} />
        </div>
      </div>
    </article>
  );
}

function CommentForm({ slug, replyTo, onCancel }: { slug: string; replyTo: BlogThread | null; onCancel: () => void }) {
  const [state, action, pending] = useActionState<FormResult | null, FormData>(submitComment, null);
  const [consent, setConsent] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  const handled = useRef<FormResult | null>(null);

  useEffect(() => {
    if (state?.ok && handled.current !== state) {
      handled.current = state;
      toast(state.message);
      form.current?.reset();
      setConsent(false);
      onCancel();
    }
  }, [state, onCancel]);

  const errors = state?.errors ?? {};
  return (
    <form ref={form} action={action} noValidate className="rounded-[20px] border border-line bg-surface p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[15px] font-bold text-fg">{replyTo ? `Responder a ${replyTo.name}` : "Deja tu consulta"}</p>
          <p className="mt-1 text-[13px] text-fg-3">El equipo responde en menos de 24 horas. Revisamos cada comentario antes de publicarlo.</p>
        </div>
        {replyTo && (
          <button type="button" onClick={onCancel} aria-label="Cancelar respuesta" className="grid h-8 w-8 flex-none place-items-center rounded-full text-fg-3 transition hover:bg-surface-2 hover:text-fg">
            <X size={16} />
          </button>
        )}
      </div>
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="parent_id" value={replyTo?.id ?? ""} />
      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden className="absolute -left-[9999px] h-px w-px opacity-0" />
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <TextField label="Nombre" name="name" autoComplete="name" required maxLength={80} error={errors.name} />
        <TextField label="Correo" name="email" type="email" autoComplete="email" required maxLength={160} hint="No se publica." error={errors.email} />
      </div>
      <TextArea className="mt-4" label="Comentario" name="body" rows={4} required maxLength={1500} error={errors.body} />
      <div className="mt-4">
        <SwitchField name="consent" label="Acepto que se publique mi nombre y el tratamiento de mis datos (Ley 29733)" hint={errors.consent} checked={consent} onCheckedChange={setConsent} />
        <p className="ml-[52px] mt-1 text-[12px] text-fg-3">
          Más detalle en la{" "}
          <Link href="/software/legal/privacidad" className="font-semibold text-accent hover:underline">
            política de privacidad
          </Link>
          .
        </p>
      </div>
      {state && !state.ok && Object.keys(errors).length === 0 && (
        <p role="alert" className="mt-4 text-[13px] font-medium text-bad">
          {state.message}
        </p>
      )}
      <div className="mt-5 flex justify-end">
        <Button type="submit" variant="primary" disabled={pending} icon={<MessageSquareText size={16} />}>
          {pending ? "Enviando…" : "Publicar comentario"}
        </Button>
      </div>
    </form>
  );
}

export function CommentThread({ slug, comments, count, open }: { slug: string; comments: BlogThread[]; count: number; open: boolean }) {
  const [order, setOrder] = useState<Order>("utiles");
  const [replyTo, setReplyTo] = useState<BlogThread | null>(null);
  const sorted = useMemo(() => [...comments].sort((a, b) => (order === "utiles" ? b.useful - a.useful : b.created_at.localeCompare(a.created_at))), [comments, order]);
  const anchor = useRef<HTMLDivElement>(null);

  const reply = (comment: BlogThread) => {
    setReplyTo(comment);
    anchor.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  return (
    <section id="comentarios" aria-labelledby="comentarios-titulo" className="scroll-mt-28">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 id="comentarios-titulo" className="site-display text-[25px] font-bold tracking-[-0.025em] text-fg">
          Comentarios <span className="font-mono text-[18px] text-fg-3">{count}</span>
        </h2>
        {comments.length > 1 && (
          <span className="inline-flex rounded-[12px] border border-line bg-surface p-1 text-[12.5px]">
            {(["utiles", "recientes"] as Order[]).map((value) => (
              <button key={value} type="button" onClick={() => setOrder(value)} aria-pressed={order === value} className={cn("rounded-[9px] px-3 py-1 font-semibold transition", order === value ? "bg-surface-2 text-fg" : "text-fg-2 hover:text-fg")}>
                {value === "utiles" ? "Más útiles" : "Más recientes"}
              </button>
            ))}
          </span>
        )}
      </div>
      {sorted.length === 0 ? (
        <p className="mt-5 rounded-[16px] border border-dashed border-line px-5 py-6 text-center text-[14px] text-fg-3">Todavía no hay comentarios. Cuéntanos cómo lo resuelve tu agencia.</p>
      ) : (
        <div className="mt-6 grid gap-6">
          {sorted.map((comment) => (
            <div key={comment.id} className="grid gap-3">
              <CommentItem comment={comment} onReply={open ? () => reply(comment) : undefined} />
              {comment.replies.length > 0 && (
                <div className="ml-12 grid gap-2.5 border-l-2 border-line pl-4">
                  {comment.replies.map((child) => (
                    <CommentItem key={child.id} comment={child} nested />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      <div ref={anchor} className="mt-8">
        {open ? <CommentForm slug={slug} replyTo={replyTo} onCancel={() => setReplyTo(null)} /> : <p className="text-[13.5px] text-fg-3">Los comentarios de este artículo están cerrados.</p>}
      </div>
    </section>
  );
}
