"use client";

import { CircleAlert, Copy, KeyRound, Lock, Mail, ShieldCheck, Smartphone } from "lucide-react";
import Link from "next/link";
import { useActionState, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import type { FormState, MfaSetupState } from "@/lib/server/auth";

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
      <TextField label="Código" hint="Si no tienes tu teléfono, usa uno de tus códigos de recuperación." name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={9} required autoFocus placeholder="000 000" icon={<KeyRound size={17} />} data-testid="mfa-code" />
      <SubmitButton pending={pending}>Verificar</SubmitButton>
      <Link href={switchHref} prefetch={false} className="text-center text-[13px] font-semibold text-fg-3 hover:text-fg">
        Entrar con otra cuenta
      </Link>
    </form>
  );
}

const groupKey = (secret: string) => secret.match(/.{1,4}/g)?.join(" ") ?? secret;

interface MfaSetupFormProps {
  begin: () => Promise<MfaSetupState>;
  finish: (state: MfaSetupState, form: FormData) => Promise<MfaSetupState>;
  next?: string;
  switchHref: string;
}

export function MfaSetupForm({ begin, finish, next, switchHref }: MfaSetupFormProps) {
  const [key, setKey] = useState<MfaSetupState>({ message: null });
  const [starting, startTransition] = useTransition();
  const [state, action, pending] = useActionState(finish, { message: null });
  const [copied, setCopied] = useState(false);

  const generate = () => startTransition(async () => setKey(await begin()));
  const copy = async () => {
    if (!key.secret) return;
    await navigator.clipboard.writeText(key.secret);
    setCopied(true);
  };

  if (state.codes) {
    return (
      <div className="flex flex-col gap-4">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-ok/10 text-ok">
          <ShieldCheck size={24} />
        </span>
        <div className="mb-1">
          <h2 className="text-[28px] font-bold tracking-[-0.035em]">Listo, tu cuenta está protegida</h2>
          <p className="mt-1.5 text-fg-3">Guarda estos códigos de recuperación en un lugar seguro. Cada uno sirve una sola vez si pierdes tu teléfono.</p>
        </div>
        <ul className="grid grid-cols-2 gap-2 rounded-xl border border-line bg-surface-2 p-4 font-mono text-[14px] font-semibold tracking-wider">
          {state.codes.map((code) => (
            <li key={code}>{code}</li>
          ))}
        </ul>
        <Button href={state.next ?? "/"} variant="primary" className="h-12 w-full text-[15px]">
          Ya los guardé, continuar
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-t4/10 text-t4">
        <Smartphone size={24} />
      </span>
      <div className="mb-1">
        <h2 className="text-[28px] font-bold tracking-[-0.035em]">Activa la verificación en dos pasos</h2>
        <p className="mt-1.5 text-fg-3">Tu rol la exige. Necesitas Google Authenticator o Microsoft Authenticator en tu teléfono.</p>
      </div>
      <FormError message={key.message} />
      {!key.secret ? (
        <Button variant="primary" onClick={generate} disabled={starting} className="h-12 w-full text-[15px]">
          {starting ? "Un momento…" : "Generar mi clave"}
        </Button>
      ) : (
        <form action={action} className="flex flex-col gap-4">
          <ol className="flex flex-col gap-3 text-[13.5px] text-fg-2">
            <li>
              <b className="text-fg">1.</b> En tu aplicación elige <b className="text-fg">Agregar</b> y luego <b className="text-fg">Ingresar clave de configuración</b>.
            </li>
            <li className="flex flex-col gap-2">
              <span>
                <b className="text-fg">2.</b> Escribe esta clave:
              </span>
              <span className="flex items-center gap-2 rounded-xl border border-line bg-surface-2 px-3.5 py-3">
                <code className="min-w-0 flex-1 break-all font-mono text-[14px] font-semibold tracking-wider text-fg">{groupKey(key.secret)}</code>
                <button type="button" onClick={copy} aria-label="Copiar la clave" title="Copiar la clave" className="grid h-8 w-8 flex-none place-items-center rounded-lg text-fg-3 hover:bg-surface hover:text-fg">
                  <Copy size={16} />
                </button>
              </span>
              {copied && <span className="text-xs text-ok">Clave copiada.</span>}
              {key.uri && (
                <a href={key.uri} className="text-[13px] font-semibold text-accent">
                  Si estás en tu teléfono, toca aquí para agregarla
                </a>
              )}
            </li>
            <li>
              <b className="text-fg">3.</b> Escribe el código de 6 dígitos que aparece.
            </li>
          </ol>
          <FormError message={state.message} />
          <input type="hidden" name="next" value={next ?? ""} />
          <TextField label="Código" name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={7} required autoFocus placeholder="000 000" icon={<KeyRound size={17} />} />
          <SubmitButton pending={pending}>Activar</SubmitButton>
        </form>
      )}
      <Link href={switchHref} prefetch={false} className="text-center text-[13px] font-semibold text-fg-3 hover:text-fg">
        Entrar con otra cuenta
      </Link>
    </div>
  );
}
