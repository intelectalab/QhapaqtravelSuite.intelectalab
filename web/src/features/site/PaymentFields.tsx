"use client";

import { Building2, CreditCard, Smartphone } from "lucide-react";
import { useEffect, useState } from "react";
import { TextField } from "@/components/ui/TextField";
import { cn } from "@/lib/cn";
import { tokenizeCard, type CheckoutTerms } from "@/lib/site";
import { FieldError } from "./FormBits";

export interface PaymentValue {
  method: string;
  card_token?: string;
  card_holder?: string;
  operation_ref?: string;
  ready: boolean;
}

const ICONS: Record<string, typeof CreditCard> = { tarjeta: CreditCard, transferencia: Building2, yape: Smartphone, plin: Smartphone };

export function PaymentFields({ methods, accounts, walletPhone, onChange, errors = {} }: { methods: CheckoutTerms["methods"]; accounts: CheckoutTerms["bank_accounts"]; walletPhone: string | null; onChange: (value: PaymentValue) => void; errors?: Record<string, string> }) {
  const [method, setMethod] = useState(methods[0]?.value ?? "tarjeta");
  const [number, setNumber] = useState("");
  const [holder, setHolder] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");
  const [operation, setOperation] = useState("");
  const card = tokenizeCard(number);
  const expiryOk = /^(0[1-9]|1[0-2])\/\d{2}$/.test(expiry);
  const cardError = number.replace(/\D/g, "").length >= 13 && !card.valid ? "El número de tarjeta no es válido." : undefined;

  useEffect(() => {
    if (method === "tarjeta") {
      onChange({ method, card_token: card.token, card_holder: holder.trim(), ready: card.valid && expiryOk && cvv.length >= 3 && holder.trim().length >= 3 });
    } else {
      onChange({ method, operation_ref: operation.trim(), ready: operation.trim().length >= 4 });
    }
  }, [method, card.token, card.valid, holder, expiryOk, cvv, operation, onChange]);

  return (
    <div className="grid gap-4">
      <div role="radiogroup" aria-label="Medio de pago" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {methods.map((option) => {
          const Icon = ICONS[option.value] ?? CreditCard;
          const active = method === option.value;
          return (
            <button key={option.value} type="button" role="radio" aria-checked={active} onClick={() => setMethod(option.value)} className={cn("lift flex flex-col items-center gap-1.5 rounded-2xl border px-3 py-3 text-[13px] font-semibold transition", active ? "border-brand bg-[color-mix(in_srgb,var(--brand)_8%,var(--surface))] text-fg" : "border-line bg-surface text-fg-2 hover:border-[color-mix(in_srgb,var(--brand)_40%,transparent)]")}>
              <Icon size={18} className={active ? "text-brand" : "text-fg-3"} />
              {option.label}
            </button>
          );
        })}
      </div>

      {method === "tarjeta" && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <TextField label="Número de tarjeta" inputMode="numeric" autoComplete="cc-number" maxLength={23} value={number} onChange={(event) => setNumber(event.target.value.replace(/[^\d ]/g, ""))} placeholder="0000 0000 0000 0000" />
            <FieldError message={cardError ?? errors.card_token} />
          </div>
          <div className="sm:col-span-2">
            <TextField label="Nombre en la tarjeta" autoComplete="cc-name" maxLength={80} value={holder} onChange={(event) => setHolder(event.target.value)} />
            <FieldError message={errors.card_holder} />
          </div>
          <TextField label="Vencimiento (MM/AA)" inputMode="numeric" autoComplete="cc-exp" maxLength={5} value={expiry} onChange={(event) => setExpiry(event.target.value.replace(/[^\d/]/g, ""))} placeholder="08/29" />
          <TextField label="Código de seguridad" inputMode="numeric" autoComplete="cc-csc" maxLength={4} value={cvv} onChange={(event) => setCvv(event.target.value.replace(/\D/g, ""))} placeholder="123" />
          <p className="text-[12px] text-fg-3 sm:col-span-2">Los datos de la tarjeta no pasan por nuestros servidores: la pasarela solo nos devuelve una referencia del cobro.</p>
        </div>
      )}

      {method === "transferencia" && (
        <div className="grid gap-3">
          {accounts.length > 0 ? (
            <ul className="grid gap-2">
              {accounts.map((account) => (
                <li key={account.account_number} className="rounded-xl bg-surface-2 px-3.5 py-2.5 text-[13px]">
                  <b className="block font-semibold text-fg">{[account.bank, account.currency === "USD" ? "Dólares" : "Soles"].filter(Boolean).join(" · ")}</b>
                  <span className="font-mono text-fg-2">Cuenta {account.account_number}{account.cci ? ` · CCI ${account.cci}` : ""}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[13px] text-fg-2">Te enviaremos las cuentas de la agencia por correo.</p>
          )}
          <div>
            <TextField label="Número de operación" maxLength={40} value={operation} onChange={(event) => setOperation(event.target.value)} placeholder="Figura en tu constancia" />
            <FieldError message={errors.operation_ref} />
          </div>
        </div>
      )}

      {(method === "yape" || method === "plin") && (
        <div className="grid gap-3">
          <p className="rounded-xl bg-surface-2 px-3.5 py-2.5 text-[13px] text-fg-2">
            {walletPhone ? <>Paga con {method === "yape" ? "Yape" : "Plin"} al número <b className="font-mono text-fg">{walletPhone}</b>. </> : null}
            El cobro es en soles al tipo de cambio del día.
          </p>
          <div>
            <TextField label="Código de operación" maxLength={40} value={operation} onChange={(event) => setOperation(event.target.value)} placeholder="Figura en la constancia de la app" />
            <FieldError message={errors.operation_ref} />
          </div>
        </div>
      )}

      {method !== "tarjeta" && <p className="text-[12px] text-fg-3">Validamos tu pago en un plazo de 4 horas hábiles. Tus cupos quedan reservados mientras tanto.</p>}
    </div>
  );
}
