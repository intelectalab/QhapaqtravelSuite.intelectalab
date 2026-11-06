"use client";

import { KeyRound, Lock, Mail, MailCheck } from "lucide-react";
import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import type { FormState } from "@/lib/server/auth";
import { FormError } from "./AuthForms";

export interface RecoveryState extends FormState {
  sent?: string;
}

type RecoveryAction = (state: RecoveryState, form: FormData) => Promise<RecoveryState>;

const initial: RecoveryState = { message: null };

function Heading({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <>
      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-accent/12 text-accent motion-safe:animate-[pop-in_420ms_cubic-bezier(0.34,1.56,0.64,1)_backwards]">{icon}</span>
      <div className="mb-2">
        <h2 className="text-[28px] font-bold tracking-[-0.035em]">{title}</h2>
        <p className="mt-1.5 text-fg-3">{children}</p>
      </div>
    </>
  );
}

function BackToLogin() {
  return (
    <Link href="/login" prefetch={false} className="text-center text-[13px] font-semibold text-fg-3 hover:text-fg">
      Volver a iniciar sesión
    </Link>
  );
}

export function ForgotPasswordForm({ action: submit }: { action: RecoveryAction }) {
  const [state, action, pending] = useActionState(submit, initial);

  if (state.sent) {
    return (
      <div className="flex flex-col gap-4">
        <Heading icon={<MailCheck size={24} />} title="Revisa tu correo">
          {state.sent}
        </Heading>
        <BackToLogin />
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      <Heading icon={<KeyRound size={24} />} title="Recupera tu acceso">
        Escribe el correo de tu cuenta y te enviaremos un enlace para crear una contraseña nueva.
      </Heading>
      <FormError message={state.message} />
      <TextField label="Correo" name="email" type="email" autoComplete="email" required autoFocus defaultValue={state.fields?.email} placeholder="tu@empresa.pe" icon={<Mail size={17} />} />
      <Button type="submit" variant="primary" disabled={pending} className="h-12 w-full text-[15px]">
        {pending ? "Un momento…" : "Enviar enlace"}
      </Button>
      <BackToLogin />
    </form>
  );
}

export function ResetPasswordForm({ action: submit, token, email }: { action: RecoveryAction; token: string; email: string }) {
  const [state, action, pending] = useActionState(submit, initial);

  return (
    <form action={action} className="flex flex-col gap-4">
      <Heading icon={<Lock size={24} />} title="Crea tu nueva contraseña">
        Será la contraseña de <b className="text-fg">{email}</b>. El enlace sirve una sola vez.
      </Heading>
      <FormError message={state.message} />
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="email" value={email} />
      <TextField label="Contraseña nueva" name="password" revealable autoComplete="new-password" required minLength={10} autoFocus hint="Al menos 10 caracteres, con letras y números." icon={<Lock size={17} />} />
      <TextField label="Repite la contraseña" name="password_confirmation" revealable autoComplete="new-password" required minLength={10} icon={<Lock size={17} />} />
      <Button type="submit" variant="primary" disabled={pending} className="h-12 w-full text-[15px]">
        {pending ? "Un momento…" : "Guardar contraseña"}
      </Button>
      <BackToLogin />
    </form>
  );
}
