"use client";

import * as Switch from "@radix-ui/react-switch";
import { CircleAlert, Copy, Pencil, Plus, ShieldCheck, Smartphone, Trash2, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useOptimistic, useState, useTransition } from "react";
import { createRole, deleteRole, setRolePermissions, updateRole, type RoleActionState } from "@/app/(backoffice)/admin/roles/actions";
import { ChoiceGroup } from "@/components/ui/ChoiceGroup";
import { PanelAction } from "@/components/ui/PanelAction";
import { SelectField } from "@/components/ui/SelectField";
import { TextArea } from "@/components/ui/TextArea";
import { TextField } from "@/components/ui/TextField";
import { ToneScope } from "@/components/ui/Tinted";
import { cn } from "@/lib/cn";
import { PERMISSION_LABEL, SCOPE_LABEL, type PermissionModule, type RoleDetail, type RoleScope, type TeamRole } from "@/lib/roles";
import type { Tone } from "@/lib/tone";
import { RoleDetailPanels } from "./RoleDetailPanels";

const initial: RoleActionState = { message: null, done: false };

const SCOPE_TONE: Record<RoleScope, Tone> = { tenant: "t1", mobile: "t4", canal: "violet" };

const SCOPE_ICON = { tenant: ShieldCheck, mobile: Smartphone, canal: Users };

export function RoleCreateAction({ roles }: { roles: TeamRole[] }) {
  const router = useRouter();
  return (
    <PanelAction<RoleActionState>
      label="Nuevo rol"
      icon={<Plus size={16} strokeWidth={2.4} />}
      variant="primary"
      formId="role-create"
      title="Nuevo rol"
      description="Puedes empezar copiando los permisos de otro rol y luego ajustarlos. El alcance no cambia después."
      submitLabel="Crear rol"
      action={createRole}
      initial={initial}
      onDone={(state) => state.code && router.push(`/admin/roles?rol=${state.code}`)}
    >
      {() => (
        <>
          <TextField label="Nombre" name="name" required maxLength={120} placeholder="Por ejemplo: Ventas senior" />
          <TextArea label="Para qué sirve" name="description" rows={2} required maxLength={250} placeholder="Ventas que además aprueban cotizaciones." />
          <ChoiceGroup label="Alcance" name="scope" defaultValue="tenant" options={(Object.keys(SCOPE_LABEL) as RoleScope[]).map((scope) => ({ value: scope, label: SCOPE_LABEL[scope] }))} />
          <SelectField label="Copiar permisos de (opcional)" name="copy_from" options={roles.map((role) => ({ value: role.code, label: role.name }))} placeholder="Empezar sin permisos" />
        </>
      )}
    </PanelAction>
  );
}

function RoleDuplicateAction({ role }: { role: TeamRole }) {
  const router = useRouter();
  return (
    <PanelAction<RoleActionState> label="Duplicar" icon={<Copy size={15} />} variant="ghost" size="sm" formId="role-duplicate" title="Duplicar rol" description={`Crea un rol propio con los ${role.permissions.length} permisos de ${role.name}. Luego puedes ajustarlos.`} submitLabel="Duplicar rol" action={createRole} initial={initial} onDone={(state) => state.code && router.push(`/admin/roles?rol=${state.code}`)}>
      {() => (
        <>
          <input type="hidden" name="copy_from" value={role.code} />
          <input type="hidden" name="scope" value={role.scope} />
          <TextField label="Nombre" name="name" required maxLength={120} defaultValue={`${role.name} (copia)`} />
          <TextArea label="Para qué sirve" name="description" rows={2} required maxLength={250} defaultValue={role.description ?? undefined} />
        </>
      )}
    </PanelAction>
  );
}

function RoleEditActions({ role }: { role: TeamRole }) {
  const router = useRouter();
  if (!role.custom) return <RoleDuplicateAction role={role} />;
  return (
    <div className="flex gap-1.5">
      <RoleDuplicateAction role={role} />
      <PanelAction<RoleActionState> label="Editar" icon={<Pencil size={15} />} variant="ghost" size="sm" formId="role-edit" title="Editar rol" description={`Alcance: ${SCOPE_LABEL[role.scope]}`} submitLabel="Guardar cambios" action={updateRole} initial={initial} onDone={() => router.refresh()}>
        {() => (
          <>
            <input type="hidden" name="code" value={role.code} />
            <TextField label="Nombre" name="name" required defaultValue={role.name} />
            <TextArea label="Para qué sirve" name="description" rows={2} required defaultValue={role.description ?? undefined} />
          </>
        )}
      </PanelAction>
      <PanelAction<RoleActionState> label="Eliminar" icon={<Trash2 size={15} />} variant="ghost" size="sm" formId="role-delete" title="Eliminar rol" description={role.users > 0 ? `${role.name} tiene ${role.users} usuarios. Cámbialos de rol antes de eliminarlo.` : `${role.name} no tiene usuarios, se puede eliminar.`} submitLabel="Eliminar rol" action={deleteRole} initial={initial} onDone={() => router.push("/admin/roles")}>
        {() => <input type="hidden" name="code" value={role.code} />}
      </PanelAction>
    </div>
  );
}

function PermissionSwitch({ checked, onChange, disabled, label, code }: { checked: boolean; onChange: (value: boolean) => void; disabled: boolean; label: string; code: string }) {
  return (
    <label className={cn("group/perm flex cursor-pointer items-center gap-3 rounded-[11px] px-3 py-2 transition-[background-color,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-surface", disabled && "cursor-not-allowed opacity-60")}>
      <Switch.Root checked={checked} onCheckedChange={onChange} disabled={disabled} className="relative h-6 w-11 flex-none rounded-full bg-[color-mix(in_srgb,var(--fg-3)_35%,transparent)] transition-colors duration-300 data-[state=checked]:bg-[var(--tint)]">
        <Switch.Thumb className="block h-5 w-5 translate-x-0.5 rounded-full bg-white shadow transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] data-[state=checked]:translate-x-[22px]" />
      </Switch.Root>
      <span className="min-w-0 flex-1 transition-transform duration-300 group-hover/perm:translate-x-0.5">
        <span className="block text-[13px] font-medium text-fg">{label}</span>
        <span className="block font-mono text-[11px] text-fg-3">{code}</span>
      </span>
    </label>
  );
}

export function RolesWorkspace({ roles, catalog, initial: initialCode, detail }: { roles: TeamRole[]; catalog: PermissionModule[]; initial?: string; detail?: RoleDetail | null }) {
  const router = useRouter();
  const selected = initialCode && roles.some((role) => role.code === initialCode) ? initialCode : roles[0]?.code;
  const role = roles.find((item) => item.code === selected) ?? roles[0];
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<string | null>(null);
  const [granted, applyOptimistic] = useOptimistic(role.permissions, (current: string[], change: { permissions: string[]; grant: boolean }) =>
    change.grant ? [...new Set([...current, ...change.permissions])] : current.filter((permission) => !change.permissions.includes(permission)),
  );

  const change = (permissions: string[], grant: boolean) => {
    setNotice(null);
    startTransition(async () => {
      applyOptimistic({ permissions, grant });
      const result = await setRolePermissions(role.code, permissions, grant);
      if (!result.ok) setNotice(result.message);
      else if (result.blocked.length > 0) setNotice(`${result.blocked.length === 1 ? "1 permiso bloqueado" : `${result.blocked.length} permisos bloqueados`} por reglas de seguridad: ${result.blocked[0].reason}`);
      router.refresh();
    });
  };

  const Icon = SCOPE_ICON[role.scope];

  return (
    <div>
      <ToneScope tone={SCOPE_TONE[role.scope]}>
        <section key={role.code} className="overflow-hidden rounded-card border border-line bg-surface shadow-card motion-safe:animate-[drop-in_260ms_ease-out_backwards]">
          <header className="relative flex flex-wrap items-center gap-3 overflow-hidden bg-[var(--tint)] px-5 py-4 text-white">
            <span aria-hidden className="weave-pattern absolute inset-0 bg-[length:20px_20px] opacity-[0.1]" />
            <span className="relative grid h-11 w-11 place-items-center rounded-[12px] bg-white/15">
              <Icon size={20} />
            </span>
            <div className="relative min-w-0 flex-1">
              <h2 className="text-[17px] font-bold">{role.name}</h2>
              <p className="text-[12.5px] text-white/80">{role.description ?? SCOPE_LABEL[role.scope]}</p>
            </div>
            <span className="relative rounded-full bg-white/15 px-3 py-1 text-[12.5px] font-semibold">
              {granted.length} de {catalog.reduce((total, group) => total + group.permissions.length, 0)} permisos
            </span>
            <div className="relative [&_button]:text-white">
              <RoleEditActions role={role} />
            </div>
          </header>

          {notice && (
            <p role="status" className="mx-5 mt-4 flex items-start gap-2 rounded-xl bg-warn/[0.1] px-3.5 py-2.5 text-[13px] text-warn">
              <CircleAlert size={16} className="mt-0.5 flex-none" />
              {notice}
            </p>
          )}

          <div className="grid gap-4 p-5 xl:grid-cols-2">
            {catalog.map((group) => {
              const on = group.permissions.filter((permission) => granted.includes(permission)).length;
              const all = on === group.permissions.length;
              return (
                <section key={group.module} className="rounded-tile border border-line-2 bg-[color-mix(in_srgb,var(--tint)_5%,var(--surface))] p-2">
                  <header className="flex items-center justify-between gap-2 px-2 py-1.5">
                    <h3 className="text-[13.5px] font-bold">{group.module}</h3>
                    <span className="flex items-center gap-2">
                      <span className="font-mono text-[11.5px] text-fg-3">
                        {on}/{group.permissions.length}
                      </span>
                      <button type="button" disabled={pending} onClick={() => change(group.permissions, !all)} className="rounded-full px-2.5 py-1 text-[12px] font-semibold text-[var(--tint)] transition-colors hover:bg-[color-mix(in_srgb,var(--tint)_12%,transparent)]">
                        {all ? "Quitar todos" : "Dar todos"}
                      </button>
                    </span>
                  </header>
                  <div className="flex flex-col">
                    {group.permissions.map((permission) => (
                      <PermissionSwitch key={permission} code={permission} label={PERMISSION_LABEL[permission] ?? permission} checked={granted.includes(permission)} disabled={false} onChange={(value) => change([permission], value)} />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
          {detail && detail.code === role.code && <RoleDetailPanels detail={detail} catalog={catalog} granted={granted} />}
        </section>
      </ToneScope>
    </div>
  );
}
