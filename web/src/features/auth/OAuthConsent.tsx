"use client";

import { AppWindow, ArrowLeftRight, Building2, CircleAlert, Link2, ShieldCheck } from "lucide-react";
import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import type { OAuthConsentData } from "@/lib/oauth";
import type { FormState } from "@/lib/server/auth";
import { FormError } from "./AuthForms";

type ConsentAction = (state: FormState, form: FormData) => Promise<FormState>;

const initial: FormState = { message: null };

export function OAuthConsent({ consent, fields, action: submit }: { consent: OAuthConsentData; fields: Record<string, string>; action: ConsentAction }) {
  const [state, action, pending] = useActionState(submit, initial);
  const host = (() => {
    try {
      return new URL(consent.redirect_uri).host;
    } catch {
      return consent.redirect_uri;
    }
  })();

  return (
    <form action={action} className="flex flex-col gap-5" data-testid="oauth-consent">
      <div className="flex items-center gap-3">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-accent/10 text-accent transition-transform duration-300 hover:-rotate-6 hover:scale-110">
          <AppWindow size={22} />
        </span>
        <ArrowLeftRight size={16} className="text-fg-3" />
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-t4/10 text-t4 transition-transform duration-300 hover:rotate-6 hover:scale-110">
          <Building2 size={22} />
        </span>
      </div>
      <div>
        <h2 className="text-[26px] font-bold tracking-[-0.035em]">{consent.name} quiere conectarse a {consent.agency}</h2>
        <p className="mt-1.5 text-fg-3">Aplicación de {consent.vendor}. Podrá usar estos datos en nombre de tu agencia hasta que la revoques desde API y webhooks.</p>
      </div>
      <FormError message={state.message} testId="oauth-error" />
      <ul className="flex flex-col gap-2">
        {consent.scopes.map((scope) => (
          <li key={scope.value} className="lift flex items-center gap-2.5 rounded-xl border border-line px-3.5 py-2.5 text-[14px] transition-colors hover:border-accent/40">
            <ShieldCheck size={16} className="flex-none text-ok" />
            {scope.label}
          </li>
        ))}
      </ul>
      <p className="flex items-center gap-1.5 text-[12.5px] text-fg-3">
        <Link2 size={13} className="flex-none" /> Al responder volverás a <span className="font-semibold text-fg-2">{host}</span>
      </p>
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <div className="grid grid-cols-2 gap-3">
        <Button type="submit" name="decision" value="deny" variant="secondary" disabled={pending} className="h-12 text-[15px]" data-testid="oauth-deny">
          Rechazar
        </Button>
        <Button type="submit" name="decision" value="approve" variant="primary" disabled={pending} className="h-12 text-[15px]" data-testid="oauth-approve">
          {pending ? "Un momento…" : "Autorizar"}
        </Button>
      </div>
    </form>
  );
}

export function OAuthConsentError({ message }: { message: string }) {
  return (
    <div className="flex flex-col gap-4" data-testid="oauth-consent-error">
      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-bad/10 text-bad">
        <CircleAlert size={22} />
      </span>
      <div>
        <h2 className="text-[26px] font-bold tracking-[-0.035em]">No podemos conectar la aplicación</h2>
        <p className="mt-1.5 text-fg-3">{message}</p>
      </div>
      <p className="text-[13px] text-fg-3">Avisa al proveedor de la aplicación o revisa su registro en API y webhooks.</p>
      <Button href="/admin/api/oauth" variant="secondary" className="h-11">
        Ir a aplicaciones OAuth
      </Button>
    </div>
  );
}
