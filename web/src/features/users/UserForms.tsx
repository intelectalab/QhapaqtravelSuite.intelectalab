"use client";

import { AlertTriangle, AtSign, KeyRound, MailPlus, Pencil, Phone, Power, PowerOff, User, UserPlus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { activateUser, deactivateUser, inviteUser, resendInvitation, resetUserMfa, updateUser, type UserActionState } from "@/app/(backoffice)/admin/usuarios/actions";
import { RowActions, RowIcon } from "@/components/table/RowActions";
import { PanelAction } from "@/components/ui/PanelAction";
import { SelectField } from "@/components/ui/SelectField";
import { SwitchField } from "@/components/ui/SwitchField";
import { TextArea } from "@/components/ui/TextArea";
import { TextField } from "@/components/ui/TextField";
import type { TeamOptions, TeamUser } from "@/lib/users";

const initial: UserActionState = { message: null, done: false };

function PersonFields({ options, user }: { options: TeamOptions; user?: TeamUser }) {
  return (
    <>
      <TextField label="Nombre completo" name="name" required defaultValue={user?.name} icon={<User size={17} />} />
      {!user && <TextField label="Correo" name="email" type="email" required hint="Le llegará la invitación. Después no se puede cambiar." icon={<AtSign size={17} />} />}
      <TextField label="Teléfono (opcional)" name="phone" inputMode="tel" defaultValue={user?.phone ?? undefined} icon={<Phone size={17} />} />
      <SelectField label="Rol" name="role" options={options.roles.map((role) => ({ value: role.code, label: role.name }))} defaultValue={user?.role?.code ?? "sales"} />
      <SelectField label="Sede" name="sede_id" options={options.sedes.map((sede) => ({ value: sede.id, label: sede.name }))} defaultValue={user?.sede?.id ?? options.sedes[0]?.id} />
      {!user && <RequireMfaField options={options} />}
    </>
  );
}

function RequireMfaField({ options }: { options: TeamOptions }) {
  const [checked, setChecked] = useState(false);
  const always = options.roles.filter((role) => role.mfa).map((role) => role.name);
  return <SwitchField label="Exigir verificación en dos pasos en el primer acceso" name="require_mfa" checked={checked} onCheckedChange={setChecked} hint={always.length > 0 ? `${always.join(", ")} la exigen siempre.` : undefined} />;
}

function ReassignNotice({ user }: { user: TeamUser }) {
  const opportunities = user.workload?.opportunities ?? 0;
  const activities = user.workload?.activities ?? 0;
  if (opportunities + activities === 0) return null;
  const items = [
    { value: opportunities, one: "oportunidad abierta", many: "oportunidades abiertas", href: `/crm/oportunidades?q=${encodeURIComponent(user.name)}` },
    { value: activities, one: "actividad pendiente", many: "actividades pendientes", href: `/crm/actividades?q=${encodeURIComponent(user.name)}` },
  ].filter((item) => item.value > 0);
  return (
    <div className="rounded-[12px] border border-[color-mix(in_srgb,var(--warn)_30%,transparent)] bg-[color-mix(in_srgb,var(--warn)_8%,var(--surface))] p-3 text-[13px]">
      <p className="mb-2 flex items-center gap-1.5 font-semibold text-warn">
        <AlertTriangle size={15} />
        Reasigna antes su trabajo
      </p>
      <ul className="grid grid-cols-2 gap-2">
        {items.map((item) => (
          <li key={item.one}>
            <Link href={item.href} className="lift block rounded-[10px] bg-surface px-3 py-2 hover:text-accent">
              <b className="block text-[18px] tabular-nums">{item.value}</b>
              <span className="text-[11.5px] text-fg-3">{item.value === 1 ? item.one : item.many}</span>
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[12px] text-fg-3">Puedes desactivarlo igual: lo que tenga a su cargo queda sin responsable activo.</p>
    </div>
  );
}

export function UserInviteAction({ options }: { options: TeamOptions }) {
  return (
    <PanelAction<UserActionState>
      label="Invitar usuario"
      icon={<UserPlus size={16} />}
      variant="primary"
      formId="user-invite"
      title="Invitar usuario"
      description="Le enviamos un correo para que cree su contraseña. Nunca mandamos contraseñas por correo."
      submitLabel="Enviar invitación"
      action={inviteUser}
      initial={initial}
    >
      {() => <PersonFields options={options} />}
    </PanelAction>
  );
}

export function UserRowActions({ user, options, isSelf, withView = true }: { user: TeamUser; options: TeamOptions; isSelf: boolean; withView?: boolean }) {
  return (
    <RowActions>
      {withView && <RowIcon tone="view" label="Ver detalle" href={`/admin/usuarios/${user.code}`} />}
      <PanelAction<UserActionState> label="Editar" icon={<Pencil size={15} />} variant="ghost" size="sm" formId={`user-edit-${user.code}`} trigger={(open) => <RowIcon tone="edit" label="Editar" onClick={open} />} title="Editar usuario" description={`${user.name} · ${user.email}`} submitLabel="Guardar cambios" action={updateUser} initial={initial}>
        {() => (
          <>
            <input type="hidden" name="code" value={user.code} />
            <PersonFields options={options} user={user} />
            {isSelf && <p className="text-[12.5px] text-fg-3">Tu propio rol solo lo puede cambiar otro administrador.</p>}
          </>
        )}
      </PanelAction>
      {user.status === "pendiente" && (
        <PanelAction<UserActionState> label="Reenviar" icon={<MailPlus size={15} />} variant="ghost" size="sm" formId={`user-resend-${user.code}`} trigger={(open) => <RowIcon tone="neutral" label="Reenviar invitación" icon={<MailPlus size={15} />} onClick={open} />} title="Reenviar invitación" description={`Enviaremos un enlace nuevo a ${user.email}. El anterior deja de funcionar.`} submitLabel="Reenviar invitación" action={resendInvitation} initial={initial}>
          {() => <input type="hidden" name="code" value={user.code} />}
        </PanelAction>
      )}
      {!isSelf && user.status !== "inactivo" && (
        <PanelAction<UserActionState> label="Reiniciar 2 pasos" icon={<KeyRound size={15} />} variant="ghost" size="sm" formId={`user-mfa-${user.code}`} trigger={(open) => <RowIcon tone="neutral" label="Reiniciar verificación en dos pasos" icon={<KeyRound size={15} />} onClick={open} />} title="Reiniciar verificación en dos pasos" description={user.mfa.enabled ? `${user.name} tendrá que volver a configurarla la próxima vez que entre. Sus sesiones abiertas se cierran.` : `${user.name} aún no la configura. Reiniciar borra cualquier intento a medias y cierra sus sesiones.`} submitLabel="Reiniciar" action={resetUserMfa} initial={initial}>
          {() => (
            <>
              <input type="hidden" name="code" value={user.code} />
              <TextArea label="Motivo" name="reason" rows={2} required minLength={3} placeholder="Por ejemplo: cambió de teléfono." />
            </>
          )}
        </PanelAction>
      )}
      {user.status === "inactivo" ? (
        <PanelAction<UserActionState> label="Reactivar" icon={<Power size={15} />} variant="ghost" size="sm" formId={`user-activate-${user.code}`} trigger={(open) => <RowIcon tone="neutral" label="Reactivar" icon={<Power size={15} />} onClick={open} />} title="Reactivar usuario" description={`${user.name} podrá volver a entrar. Cuenta para el límite de usuarios de tu plan.`} submitLabel="Reactivar" action={activateUser} initial={initial}>
          {() => <input type="hidden" name="code" value={user.code} />}
        </PanelAction>
      ) : (
        !isSelf && (
          <PanelAction<UserActionState> label="Desactivar" icon={<PowerOff size={15} />} variant="ghost" size="sm" formId={`user-deactivate-${user.code}`} trigger={(open) => <RowIcon tone="delete" label="Desactivar" icon={<PowerOff size={15} />} onClick={open} />} title="Desactivar usuario" description={`${user.name} no podrá entrar y sus sesiones se cierran. Su historial se conserva.`} submitLabel="Desactivar" action={deactivateUser} initial={initial}>
            {() => (
              <>
                <input type="hidden" name="code" value={user.code} />
                <ReassignNotice user={user} />
                <TextArea label="Motivo" name="reason" rows={2} required minLength={3} placeholder="Por ejemplo: dejó la empresa." />
              </>
            )}
          </PanelAction>
        )
      )}
    </RowActions>
  );
}
