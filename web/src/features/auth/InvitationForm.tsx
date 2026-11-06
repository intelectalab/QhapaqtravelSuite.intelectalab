"use client";

import { Lock, PartyPopper } from "lucide-react";
import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import type { FormState } from "@/lib/server/auth";
import { FormError } from "./AuthForms";

interface InvitationFormProps {
  action: (state: FormState, form: FormData) => Promise<FormState>;
  token: string;
  name: string;
  email: string;
  agency: string;
}

const initial: FormState = { message: null };

export function InvitationForm({ action: submit, token, name, email, agency }: InvitationFormProps) {
  const [state, action, pending] = useActionState(submit, initial);

  return (
    <form action={action} className="flex flex-col gap-4">
      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-t2/15 text-t2 motion-safe:animate-[pop-in_420ms_cubic-bezier(0.34,1.56,0.64,1)_backwards]">
        <PartyPopper size={24} />
      </span>
      <div className="mb-2">
        <h2 className="text-[28px] font-bold tracking-[-0.035em]">Hola, {name.split(" ")[0]}</h2>
        <p className="mt-1.5 text-fg-3">
          Eres el administrador de <b className="text-fg">{agency}</b>. Crea tu contraseña para entrar con <b className="text-fg">{email}</b>.
        </p>
      </div>
      <FormError message={state.message} />
      <input type="hidden" name="token" value={token} />
      <TextField label="Contraseña" name="password" revealable autoComplete="new-password" required minLength={10} autoFocus hint="Al menos 10 caracteres, con letras y números." icon={<Lock size={17} />} />
      <TextField label="Repite la contraseña" name="password_confirmation" revealable autoComplete="new-password" required minLength={10} icon={<Lock size={17} />} />
      <Button type="submit" variant="primary" disabled={pending} className="h-12 w-full text-[15px]">
        {pending ? "Un momento…" : "Activar mi cuenta"}
      </Button>
      <p className="text-center text-[12.5px] text-fg-3">Después te pediremos configurar la verificación en dos pasos.</p>
    </form>
  );
}
