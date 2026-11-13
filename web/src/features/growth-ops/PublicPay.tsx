"use client";

import { CircleCheck, CreditCard, Gift, LockKeyhole, Search, Smartphone } from "lucide-react";
import { useActionState, useState } from "react";
import { buyGiftCard, giftCardBalance, payLink, type PublicStepResult } from "@/app/(sitio)/crecimiento-actions";
import { Button } from "@/components/ui/Button";
import { TextArea } from "@/components/ui/TextArea";
import { TextField } from "@/components/ui/TextField";
import { FormError } from "@/features/auth/AuthForms";
import type { PublicPayLink } from "@/lib/growth-ops";
import { cn } from "@/lib/cn";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { tokenizeCard } from "@/lib/site";

const initial: PublicStepResult = { message: null, done: false, data: null };

function CardFields({ installments }: { installments: number }) {
  const [number, setNumber] = useState("");
  const card = tokenizeCard(number);
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <TextField label="Número de tarjeta" inputMode="numeric" autoComplete="cc-number" maxLength={23} value={number} onChange={(event) => setNumber(event.target.value.replace(/[^\d ]/g, ""))} placeholder="0000 0000 0000 0000" required />
      </div>
      <div className="sm:col-span-2">
        <TextField label="Nombre en la tarjeta" autoComplete="cc-name" maxLength={80} required />
      </div>
      <TextField label="Vencimiento (MM/AA)" inputMode="numeric" autoComplete="cc-exp" maxLength={5} placeholder="08/29" required pattern="(0[1-9]|1[0-2])/\d{2}" />
      <TextField label="Código de seguridad" inputMode="numeric" autoComplete="cc-csc" maxLength={4} placeholder="123" required pattern="\d{3,4}" />
      {installments > 1 && (
        <div className="sm:col-span-2">
          <TextField label={`Cuotas (hasta ${installments})`} name="installments" type="number" min="1" max={installments} defaultValue="1" />
        </div>
      )}
      <input type="hidden" name="card_token" value={card.valid ? card.token : ""} />
      <p className="flex items-center gap-1.5 text-[12px] text-fg-3 sm:col-span-2">
        <LockKeyhole size={13} />
        Los datos de la tarjeta van directo a la pasarela; la agencia no los ve.
      </p>
    </div>
  );
}

export function PublicPayView({ agencia, token, link }: { agencia: string; token: string; link: PublicPayLink }) {
  const [method, setMethod] = useState(link.methods[0]?.key ?? "card");
  const [state, run, pending] = useActionState(payLink.bind(null, agencia, token), initial);
  const paid = link.status === "pagado" || state.data?.result === "aprobado";

  return (
    <div className="mx-auto grid w-full max-w-[560px] gap-5 px-4 py-10">
      <div className="rounded-2xl border border-line bg-surface px-5 py-5 shadow-card">
        <p className="text-[12.5px] font-semibold text-fg-3">{link.agency}</p>
        <h1 className="mt-1 text-[22px] font-semibold tracking-tight">{link.concept}</h1>
        <p className="text-[13px] text-fg-2">{link.reservation ? `${link.reservation.title} · ${link.reservation.code}` : link.code}{link.client_name ? ` · ${link.client_name}` : ""}</p>
        <p className="mt-4 font-mono text-[30px] font-bold tracking-tight">{formatMoney(link.amount, link.currency)}</p>
        <p className="text-[12.5px] text-fg-3">{paid ? `Pagado${link.paid_at ? ` el ${formatDateTime(link.paid_at)}` : ""}` : link.status === "activo" ? `Vence el ${formatDateTime(link.expires_at)}` : link.status_label}</p>
      </div>

      {paid ? (
        <div className="grid justify-items-center gap-2 rounded-2xl bg-[color-mix(in_srgb,var(--ok)_10%,var(--surface))] px-5 py-8 text-center">
          <CircleCheck size={36} className="text-ok" />
          <p className="text-[15px] font-semibold">Pago recibido</p>
          <p className="text-[13px] text-fg-2">{state.data?.message ?? "La agencia ya tiene la confirmación. Gracias."}</p>
        </div>
      ) : link.status !== "activo" ? (
        <p className="rounded-2xl bg-surface-2 px-5 py-6 text-center text-[13.5px] text-fg-2">{link.status === "vencido" ? "Este link venció. Pide a la agencia uno nuevo." : "Este link ya no está disponible."}</p>
      ) : state.data?.result === "pendiente" ? (
        <div className="grid gap-2 rounded-2xl bg-surface-2 px-5 py-6 text-center">
          <Smartphone size={28} className="mx-auto text-accent" />
          <p className="text-[14px] font-semibold">Completa el pago en tu app</p>
          <p className="text-[13px] text-fg-2">{state.data.message}</p>
          <p className="font-mono text-[12px] text-fg-3">Referencia {state.data.gateway_session}</p>
        </div>
      ) : (
        <form action={run} className="grid gap-4 rounded-2xl border border-line bg-surface px-5 py-5 shadow-card">
          <FormError message={state.message} />
          <div role="radiogroup" aria-label="Medio de pago" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {link.methods.map((option) => (
              <button key={option.key} type="button" role="radio" aria-checked={method === option.key} onClick={() => setMethod(option.key)} className={cn("lift flex flex-col items-center gap-1.5 rounded-2xl border px-3 py-3 text-[13px] font-semibold transition", method === option.key ? "border-brand bg-[color-mix(in_srgb,var(--brand)_8%,var(--surface))] text-fg" : "border-line text-fg-2")}>
                {option.key === "card" ? <CreditCard size={18} /> : <Smartphone size={18} />}
                {option.label}
              </button>
            ))}
          </div>
          <input type="hidden" name="method" value={method} />
          {method === "card" ? <CardFields installments={link.installments_max} /> : <p className="rounded-xl bg-surface-2 px-3.5 py-3 text-[13px] text-fg-2">Te llevaremos a {link.methods.find((item) => item.key === method)?.label} para aprobar el pago. Confirmamos el link apenas la pasarela nos avise.</p>}
          <TextField label="Correo para el comprobante (opcional)" name="email" type="email" maxLength={190} />
          <Button type="submit" variant="primary" disabled={pending}>{pending ? "Procesando…" : `Pagar ${formatMoney(link.amount, link.currency)}`}</Button>
        </form>
      )}
    </div>
  );
}

const AMOUNTS = ["100", "200", "300", "500"];

export function GiftShopView({ agencia, agency }: { agencia: string; agency: string }) {
  const [amount, setAmount] = useState("200");
  const [currency, setCurrency] = useState("PEN");
  const [state, run, pending] = useActionState(buyGiftCard.bind(null, agencia), initial);
  const [balance, check, checking] = useActionState(giftCardBalance.bind(null, agencia), initial);

  return (
    <div className="mx-auto grid w-full max-w-[980px] gap-6 px-4 py-10 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <section className="grid gap-4 rounded-2xl border border-line bg-surface px-5 py-6 shadow-card">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[color-mix(in_srgb,var(--brand)_10%,transparent)] px-3 py-1 text-[12px] font-semibold text-brand"><Gift size={13} />Vale de regalo</span>
          <h1 className="mt-2 text-[24px] font-semibold tracking-tight">Regala un viaje con {agency}</h1>
          <p className="text-[13.5px] text-fg-2">El vale llega por correo con su código y sirve para cualquier tour o paquete durante 12 meses.</p>
        </div>
        {state.done && state.data ? (
          <div className="grid gap-2 rounded-2xl bg-[color-mix(in_srgb,var(--ok)_10%,var(--surface))] px-5 py-6">
            <p className="flex items-center gap-2 text-[15px] font-semibold"><CircleCheck size={18} className="text-ok" />Vale {state.data.code} listo</p>
            <p className="font-mono text-[20px] font-bold tracking-wider">{state.data.redeem_code}</p>
            <p className="text-[13px] text-fg-2">{formatMoney(state.data.amount ?? "0", state.data.currency ?? "PEN")} · vence el {formatDate(state.data.expires_at ?? "")}. {state.data.message}</p>
          </div>
        ) : (
          <form action={run} className="grid gap-4">
            <FormError message={state.message} />
            <div className="flex flex-wrap gap-2">
              {AMOUNTS.map((value) => (
                <button key={value} type="button" onClick={() => setAmount(value)} className={cn("lift rounded-xl border px-4 py-2 font-mono text-[14px] font-semibold transition", amount === value ? "border-brand bg-[color-mix(in_srgb,var(--brand)_8%,var(--surface))]" : "border-line text-fg-2")}>
                  {formatMoney(value, currency)}
                </button>
              ))}
              {["PEN", "USD"].map((value) => (
                <button key={value} type="button" onClick={() => setCurrency(value)} className={cn("rounded-xl border px-3 py-2 text-[12.5px] font-semibold transition", currency === value ? "border-brand text-fg" : "border-line text-fg-3")}>{value === "PEN" ? "Soles" : "Dólares"}</button>
              ))}
            </div>
            <TextField label="Monto" name="amount" type="number" min="20" max="20000" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} required />
            <input type="hidden" name="currency" value={currency} />
            <div className="grid gap-3 sm:grid-cols-2">
              <TextField label="Tu nombre" name="buyer_name" required minLength={3} maxLength={160} />
              <TextField label="Tu correo" name="buyer_email" type="email" required maxLength={190} />
              <TextField label="Para (nombre)" name="recipient_name" maxLength={160} />
              <TextField label="Correo de quien lo recibe" name="recipient_email" type="email" maxLength={190} />
            </div>
            <TextArea label="Mensaje (opcional)" name="message" rows={3} maxLength={500} />
            <CardFields installments={1} />
            <Button type="submit" variant="primary" disabled={pending}>{pending ? "Procesando…" : `Comprar vale de ${formatMoney(amount || "0", currency)}`}</Button>
          </form>
        )}
      </section>
      <aside className="grid content-start gap-3 rounded-2xl border border-line bg-surface px-5 py-6 shadow-card">
        <h2 className="flex items-center gap-2 text-[15px] font-semibold"><Search size={16} />Consulta el saldo de tu vale</h2>
        <form action={check} className="grid gap-3">
          <FormError message={balance.done ? null : balance.message} />
          <TextField label="Código de canje" name="redeem_code" required placeholder="XXXX-XXXX-XXXX-XXXX" autoComplete="off" />
          <Button type="submit" variant="secondary" disabled={checking}>{checking ? "Consultando…" : "Consultar"}</Button>
        </form>
        {balance.done && balance.data && (
          <div className="rounded-xl bg-surface-2 px-4 py-3 text-[13px]">
            <p className="font-mono text-[20px] font-bold">{formatMoney(balance.data.balance ?? "0", balance.data.currency ?? "PEN")}</p>
            <p className="text-fg-2">{balance.data.status_label} · de {formatMoney(balance.data.initial_amount ?? "0", balance.data.currency ?? "PEN")} · vence el {formatDate(balance.data.expires_at ?? "")}</p>
          </div>
        )}
      </aside>
    </div>
  );
}
