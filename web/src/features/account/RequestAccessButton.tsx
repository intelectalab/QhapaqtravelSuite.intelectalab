"use client";

import { CircleCheck, KeyRound } from "lucide-react";
import { useActionState } from "react";
import { requestAccess } from "@/app/(backoffice)/cuenta/actions";
import { Button } from "@/components/ui/Button";
import type { AccessRequestState } from "@/lib/account";

const initial: AccessRequestState = { message: null, done: false };

export function RequestAccessButton({ path }: { path: string }) {
  const [state, action, pending] = useActionState(requestAccess, initial);

  if (state.done) {
    return (
      <p role="status" data-testid="forbidden-request-sent" className="mx-auto mb-8 flex max-w-sm items-start gap-2.5 rounded-xl bg-[color-mix(in_srgb,var(--ok)_10%,transparent)] px-3.5 py-3 text-left text-[13px] text-fg">
        <CircleCheck size={17} className="mt-px flex-none text-ok" />
        {state.message}
      </p>
    );
  }

  return (
    <form action={action} className="mx-auto mb-8 flex max-w-sm flex-col items-center gap-2">
      <input type="hidden" name="path" value={path} />
      <Button type="submit" variant="secondary" icon={<KeyRound size={16} />} disabled={pending} data-testid="forbidden-request-access">
        {pending ? "Enviando…" : "Solicitar acceso"}
      </Button>
      {state.message && (
        <p role="alert" className="text-center text-[12.5px] text-bad">
          {state.message}
        </p>
      )}
    </form>
  );
}
