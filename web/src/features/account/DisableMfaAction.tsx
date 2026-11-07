"use client";

import { ShieldOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { disableOwnMfa } from "@/app/(backoffice)/cuenta/actions";
import { PanelAction } from "@/components/ui/PanelAction";
import { SwitchField } from "@/components/ui/SwitchField";
import type { AccessRequestState } from "@/lib/account";

const initial: AccessRequestState = { message: null, done: false };

export function DisableMfaAction() {
  const router = useRouter();
  const [confirmed, setConfirmed] = useState(false);

  return (
    <PanelAction<AccessRequestState>
      label="Desactivar"
      icon={<ShieldOff size={16} />}
      variant="secondary"
      formId="disable-own-mfa"
      title="Desactivar la verificación en dos pasos"
      description="Tu cuenta quedará protegida solo con la contraseña. Podrás volver a activarla cuando quieras desde esta misma página."
      submitLabel="Desactivar"
      action={disableOwnMfa}
      initial={initial}
      testId="account-mfa-disable"
      onDone={() => router.refresh()}
    >
      {() => (
        <SwitchField label="Entiendo que mi cuenta queda menos protegida" hint="Se borra tu código actual y los códigos de recuperación dejan de servir." name="confirm" checked={confirmed} onCheckedChange={setConfirmed} />
      )}
    </PanelAction>
  );
}
