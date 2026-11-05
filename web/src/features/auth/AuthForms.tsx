"use client";

import { CircleAlert, KeyRound, Lock, Mail, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import type { FormState } from "@/lib/server/auth";

type FormAction = (state: FormState, form: FormData) => Promise<FormState>;

const initial: FormState = { message: null };

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="flex items-start gap-2.5 rounded-xl bg-bad/[0.08] px-3.5 py-3 text-[13.5px] text-bad">
      <CircleAlert size={17} className="mt-px flex-none" />
      {message}
    </p>
  );
}

function SubmitButton({ pending, children }: { pending: boolean; children: string }) {
  return (
    <Button type="submit" variant="primary" disabled={pending} className="h-12 w-full text-[15px]">
      {pending ? "Un momento…" : children}
    </Button>
  );
}

interface LoginFormProps {
  action: FormAction;
  next?: string;
  title?: string;
  description?: string;
  placeholder?: string;
}

export function LoginForm({ action: submit, next, title = "Inicia sesión", description = "Entra con el correo y la contraseña de tu cuenta.", placeholder = "tu@empresa.pe" }: LoginFormProps) {
  const [state, action, pending] = useActionState(submit, initial);

  return (
    <form action={action} className="flex flex-col gap-4" data-testid="login-form">
      <div className="mb-2">
        <h2 className="text-[28px] font-bold tracking-[-0.035em]">{title}</h2>
        <p className="mt-1.5 text-fg-3">{description}</p>
      </div>
      <FormError message={state.message} />
      <input type="hidden" name="next" value={next ?? ""} />
      <TextField label="Correo" name="email" type="email" autoComplete="email" required autoFocus defaultValue={state.fields?.email} placeholder={placeholder} icon={<Mail size={17} />} data-testid="login-email" />
      <TextField label="Contraseña" name="password" revealable autoComplete="current-password" required icon={<Lock size={17} />} data-testid="login-password" />
      <SubmitButton pending={pending}>Ingresar</SubmitButton>
    </form>
  );
}

export function MfaForm({ action: submit, next, switchHref }: { action: FormAction; next?: string; switchHref: string }) {
  const [state, action, pending] = useActionState(submit, initial);

  return (
    <form action={action} className="flex flex-col gap-4" data-testid="mfa-form">
      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-t4/10 text-t4">
        <ShieldCheck size={24} />
      </span>
      <div className="mb-2">
        <h2 className="text-[28px] font-bold tracking-[-0.035em]">Verificación en dos pasos</h2>
        <p className="mt-1.5 text-fg-3">Escribe el código de 6 dígitos que muestra tu aplicación de autenticación.</p>
      </div>
      <FormError message={state.message} />
      <input type="hidden" name="next" value={next ?? ""} />
      <TextField label="Código" name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={7} required autoFocus placeholder="000 000" icon={<KeyRound size={17} />} data-testid="mfa-code" />
      <SubmitButton pending={pending}>Verificar</SubmitButton>
      <Link href={switchHref} prefetch={false} className="text-center text-[13px] font-semibold text-fg-3 hover:text-fg">
        Entrar con otra cuenta
      </Link>
    </form>
  );
}
