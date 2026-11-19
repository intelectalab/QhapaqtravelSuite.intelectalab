"use client";

import { KeyRound, Mail, Phone, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { inviteProviderUser } from "@/app/(backoffice)/catalogo/proveedores/actions";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { InfoTip } from "@/components/ui/InfoTip";
import { PanelAction } from "@/components/ui/PanelAction";
import { TextField } from "@/components/ui/TextField";
import { HiddenFields, PanelSection, STEP_INITIAL } from "@/features/catalog-shared/CatalogPanels";
import { USER_STATUS } from "@/features/users/UserDetailPanels";
import type { ProviderExtranetUser, ProviderRow } from "@/lib/catalog-providers";
import { formatDateTime } from "@/lib/format";
import type { StepResult } from "@/lib/server/resource";

function accessNote(user: ProviderExtranetUser): string {
  if (user.last_login_at) return `Último ingreso ${formatDateTime(user.last_login_at)}`;
  if (user.status === "pendiente") return user.invited_at ? `Invitado el ${formatDateTime(user.invited_at)}, aún no crea su clave` : "Aún no crea su clave";
  return "Nunca ingresó";
}

export function ProviderInviteAction({ provider, users }: { provider: ProviderRow; users: ProviderExtranetUser[] }) {
  const router = useRouter();
  const suggest = !!provider.email && !users.some((user) => user.email.toLowerCase() === provider.email?.toLowerCase());
  if (provider.state !== "activo") {
    return (
      <span className="inline-flex items-center gap-1.5">
        <Button size="sm" variant="secondary" icon={<KeyRound size={15} />} disabled>
          Invitar a la extranet
        </Button>
        <InfoTip label="Por qué no se puede invitar">Solo se da acceso a proveedores activos. Activa el proveedor o renueva su contrato primero.</InfoTip>
      </span>
    );
  }
  return (
    <PanelAction<StepResult>
      label="Invitar a la extranet"
      icon={<KeyRound size={15} />}
      size="sm"
      formId={`provider-invite-${provider.ref}`}
      title="Invitar a la extranet"
      description={`${provider.name} · la persona recibe un correo para crear su clave y entrar al portal de proveedores.`}
      submitLabel="Enviar invitación"
      action={inviteProviderUser}
      initial={STEP_INITIAL}
      successToast="Invitación enviada"
      onDone={() => router.refresh()}
    >
      {() => (
        <>
          <HiddenFields values={{ ref: provider.ref }} />
          <TextField label="Nombre" name="name" required minLength={3} maxLength={150} defaultValue={suggest ? provider.contact_name || undefined : undefined} icon={<UserRound size={16} />} />
          <TextField label="Correo" name="email" type="email" required maxLength={190} defaultValue={suggest ? provider.email ?? undefined : undefined} icon={<Mail size={16} />} hint="Debe ser un correo que no use otro usuario." />
          <TextField label="Teléfono" name="phone" maxLength={30} defaultValue={suggest ? provider.phone ?? undefined : undefined} icon={<Phone size={16} />} />
        </>
      )}
    </PanelAction>
  );
}

export function ProviderExtranet({ provider, users }: { provider: ProviderRow; users: ProviderExtranetUser[] }) {
  return (
    <PanelSection title={`Acceso a la extranet (${users.length})`}>
      {users.length === 0 ? (
        <p className="rounded-xl bg-surface-2 px-3.5 py-3 text-[13px] text-fg-2">Nadie de este proveedor entra todavía al portal de proveedores. Con acceso confirma servicios, sube facturas y pide cambios de tarifa.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {users.map((user) => (
            <li key={user.code} className="flex items-start justify-between gap-3 rounded-xl border border-line-2 px-3.5 py-2.5 transition hover:border-line hover:bg-surface-2">
              <span className="min-w-0 text-[13px]">
                <b className="block font-semibold">{user.name}</b>
                <span className="block truncate text-fg-3">{user.email}</span>
                <span className="block text-[12px] text-fg-3">{accessNote(user)}</span>
              </span>
              <Badge tone={USER_STATUS[user.status].tone}>{USER_STATUS[user.status].label}</Badge>
            </li>
          ))}
        </ul>
      )}
      <div className="self-start">
        <ProviderInviteAction provider={provider} users={users} />
      </div>
    </PanelSection>
  );
}
