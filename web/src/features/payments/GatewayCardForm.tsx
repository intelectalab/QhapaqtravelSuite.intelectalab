"use client";

import { CircleCheck, CreditCard, FlaskConical, Loader2, LockKeyhole, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { cn } from "@/lib/cn";
import { embedOf, testModeNote, type GatewayInfo, type GatewaySession, type PayResult, type SessionResult } from "@/lib/payment-gateway";
import { tokenizeCard } from "@/lib/site";
import { inlineWidget, mountWidget } from "./gateway-widgets";

type Phase = "idle" | "opening" | "ready" | "paying" | "done";

interface GatewayCardFormProps {
  info: GatewayInfo;
  amountLabel: string;
  openSession: () => Promise<SessionResult>;
  onToken: (token: string, sessionId: string) => Promise<PayResult>;
  onPaid?: (message: string | null) => void;
  className?: string;
}

function LocalCard({ disabled, onToken }: { disabled: boolean; onToken: (token: string) => void }) {
  const [number, setNumber] = useState("");
  const [holder, setHolder] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");
  const card = tokenizeCard(number);
  const ready = card.valid && /^(0[1-9]|1[0-2])\/\d{2}$/.test(expiry) && cvv.length >= 3 && holder.trim().length >= 3;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <TextField label="Número de tarjeta" inputMode="numeric" autoComplete="cc-number" maxLength={23} value={number} onChange={(event) => setNumber(event.target.value.replace(/[^\d ]/g, ""))} placeholder="0000 0000 0000 0000" error={number.replace(/\D/g, "").length >= 13 && !card.valid ? "El número de tarjeta no es válido." : undefined} />
      </div>
      <div className="sm:col-span-2">
        <TextField label="Nombre en la tarjeta" autoComplete="cc-name" maxLength={80} value={holder} onChange={(event) => setHolder(event.target.value)} />
      </div>
      <TextField label="Vencimiento (MM/AA)" inputMode="numeric" autoComplete="cc-exp" maxLength={5} value={expiry} onChange={(event) => setExpiry(event.target.value.replace(/[^\d/]/g, ""))} placeholder="08/29" />
      <TextField label="Código de seguridad" inputMode="numeric" autoComplete="cc-csc" maxLength={4} value={cvv} onChange={(event) => setCvv(event.target.value.replace(/\D/g, ""))} placeholder="123" />
      <div className="sm:col-span-2">
        <Button type="button" variant="primary" disabled={disabled || !ready} onClick={() => onToken(card.token)} icon={<CreditCard size={16} />}>
          Pagar
        </Button>
      </div>
    </div>
  );
}

export function GatewayCardForm({ info, amountLabel, openSession, onToken, onPaid, className }: GatewayCardFormProps) {
  const container = `pasarela-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const [phase, setPhase] = useState<Phase>("idle");
  const [session, setSession] = useState<GatewaySession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const sessionRef = useRef<GatewaySession | null>(null);
  const embed = session ? embedOf(session) : null;
  const note = testModeNote(embed ? { provider: embed.provider, label: embed.label ?? info.label, mode: embed.mode ?? info.mode } : info);

  const open = useCallback(async () => {
    setError(null);
    setPhase("opening");
    const result = await openSession();
    if (!result.ok) {
      setError(result.message);
      setPhase("idle");
      return;
    }
    sessionRef.current = result.session;
    setSession(result.session);
    setPhase("ready");
  }, [openSession]);

  const pay = useCallback(
    async (token: string) => {
      const current = sessionRef.current;
      if (!current) return;
      setError(null);
      setPhase("paying");
      const result = await onToken(token, current.session_id);
      sessionRef.current = null;
      if (result.ok) {
        setNotice(result.message);
        setPhase("done");
        onPaid?.(result.message);
        return;
      }
      setError(result.message ?? "La tarjeta fue rechazada. Prueba con otra tarjeta u otro medio de pago.");
      setSession(null);
      setPhase("idle");
    },
    [onToken, onPaid],
  );

  useEffect(() => {
    if (!session || phase !== "ready") return;
    const current = embedOf(session);
    if (current.provider === "sandbox") return;
    let cleanup: (() => void) | undefined;
    let active = true;
    void mountWidget(current, { container, onToken: pay, onError: (message) => setError(message) }).then((done) => {
      if (active) cleanup = done;
      else done();
    });
    return () => {
      active = false;
      cleanup?.();
    };
  }, [session, phase, container, pay]);

  if (phase === "done") {
    return (
      <p className={cn("flex items-center gap-2 rounded-2xl bg-[color-mix(in_srgb,var(--ok)_10%,var(--surface))] px-4 py-3 text-[13.5px] font-semibold text-fg", className)}>
        <CircleCheck size={18} className="text-ok" />
        {notice ?? "Pago aprobado."}
      </p>
    );
  }

  return (
    <div className={cn("grid gap-3", className)} data-testid="gateway-card-form" data-provider={info.provider}>
      {note && (
        <p className="flex items-start gap-2 rounded-xl bg-[color-mix(in_srgb,var(--warn)_12%,var(--surface))] px-3.5 py-2.5 text-[12.5px] text-fg-2">
          <FlaskConical size={15} className="mt-0.5 flex-none text-warn" />
          {note}
        </p>
      )}

      {phase === "idle" || phase === "opening" ? (
        <div>
          <Button type="button" variant="primary" disabled={phase === "opening"} onClick={() => void open()} icon={phase === "opening" ? <Loader2 size={16} className="animate-spin" /> : error ? <RotateCcw size={16} /> : <CreditCard size={16} />}>
            {phase === "opening" ? "Abriendo el pago seguro…" : error ? "Intentar de nuevo" : `Pagar ${amountLabel} con tarjeta`}
          </Button>
        </div>
      ) : embed?.provider === "sandbox" ? (
        <LocalCard disabled={phase === "paying"} onToken={(token) => void pay(token)} />
      ) : (
        <div className="grid gap-2">
          {inlineWidget(embed?.provider ?? "") ? <div id={container} className="min-h-[220px] rounded-2xl border border-line bg-surface p-3" /> : <p className="rounded-xl bg-surface-2 px-3.5 py-3 text-[13px] text-fg-2">Se abrió la ventana segura de {embed?.label ?? info.label}. Si no la ves, revisa que el navegador no la haya bloqueado.</p>}
          {phase === "paying" && (
            <p className="flex items-center gap-2 text-[13px] text-fg-2">
              <Loader2 size={15} className="animate-spin" />
              Confirmando el pago con {embed?.label ?? info.label}…
            </p>
          )}
        </div>
      )}

      {error && <p className="text-[13px] text-bad">{error}</p>}
      <p className="flex items-center gap-1.5 text-[12px] text-fg-3">
        <LockKeyhole size={13} />
        {info.provider === "sandbox" ? "Los datos de la tarjeta no pasan por nuestros servidores: la pasarela solo nos devuelve una referencia del cobro." : `Los datos de la tarjeta los recibe ${info.label} directamente; la agencia no los ve.`}
      </p>
    </div>
  );
}
