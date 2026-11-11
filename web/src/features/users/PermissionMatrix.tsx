"use client";

import { Check, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setRolePermissions } from "@/app/(backoffice)/admin/roles/actions";
import { Card } from "@/components/ui/Card";
import { SelectField } from "@/components/ui/SelectField";
import { cn } from "@/lib/cn";
import { PERMISSION_LABEL, type PermissionMatrixData } from "@/lib/roles";

export function PermissionMatrix({ data, canEdit }: { data: PermissionMatrixData; canEdit: boolean }) {
  const router = useRouter();
  const [module, setModule] = useState("");
  const [matrix, setMatrix] = useState(data.matrix);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [, start] = useTransition();
  const modules = data.modules.filter((item) => module === "" || item.module === module);

  const apply = (role: string, permissions: string[], grant: boolean, key: string) => {
    setBusy(key);
    setMessage(null);
    start(async () => {
      const result = await setRolePermissions(role, permissions, grant);
      setBusy(null);
      if (!result.ok) {
        setMessage(result.message);
        return;
      }
      const blocked = new Set(result.blocked.map((item) => item.permission));
      setMatrix((current) => ({ ...current, [role]: { ...current[role], ...Object.fromEntries(permissions.filter((permission) => !blocked.has(permission)).map((permission) => [permission, grant])) } }));
      if (result.blocked.length > 0) setMessage(result.blocked.map((item) => `${PERMISSION_LABEL[item.permission] ?? item.permission}: ${item.reason}`).join(" · "));
      router.refresh();
    });
  };

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-[260px_1fr] sm:items-end">
        <SelectField label="Módulo" name="module" options={data.modules.map((item) => ({ value: item.module, label: item.module }))} value={module} placeholder="Todos los módulos" clearable onChange={setModule} />
        <p className="text-[12.5px] text-fg-3 sm:pb-2.5">{canEdit ? "Marca o desmarca una celda para dar o quitar el permiso. El número del módulo marca o desmarca todo el módulo para ese rol. Los permisos protegidos no se pueden quitar." : "Solo lectura: no tienes permiso para configurar roles."}</p>
      </div>
      {message && <p className="rounded-xl border border-[color-mix(in_srgb,var(--warn)_35%,transparent)] bg-[color-mix(in_srgb,var(--warn)_8%,var(--surface))] px-4 py-3 text-[13px] text-fg">{message}</p>}
      <Card padded={false} className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse text-[12.5px]">
          <thead>
            <tr className="border-b border-line">
              <th className="sticky left-0 z-10 bg-surface px-4 py-3 text-left font-semibold text-fg-3">Permiso</th>
              {data.roles.map((role) => (
                <th key={role.code} className="px-2 py-3 text-center align-bottom">
                  <span className="mx-auto block max-w-[96px] text-[12px] font-semibold leading-tight text-fg">{role.name}</span>
                  <span className="mt-0.5 block text-[11px] text-fg-3">{role.users} {role.users === 1 ? "usuario" : "usuarios"}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {modules.map((item) => (
              <ModuleRows key={item.module} name={item.module} permissions={item.permissions} roles={data.roles} matrix={matrix} canEdit={canEdit} busy={busy} onApply={apply} />
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function ModuleRows({ name, permissions, roles, matrix, canEdit, busy, onApply }: { name: string; permissions: string[]; roles: PermissionMatrixData["roles"]; matrix: PermissionMatrixData["matrix"]; canEdit: boolean; busy: string | null; onApply: (role: string, permissions: string[], grant: boolean, key: string) => void }) {
  return (
    <>
      <tr className="bg-surface-2">
        <td className="sticky left-0 z-10 bg-surface-2 px-4 py-2 text-[12px] font-bold text-fg-2">{name}</td>
        {roles.map((role) => {
          const granted = permissions.filter((permission) => matrix[role.code]?.[permission]).length;
          const key = `${role.code}:${name}`;
          return (
            <td key={role.code} className="px-2 py-2 text-center">
              <button
                type="button"
                disabled={!canEdit || busy !== null}
                title={granted === permissions.length ? "Quitar todo el módulo" : "Dar todo el módulo"}
                onClick={() => onApply(role.code, permissions, granted !== permissions.length, key)}
                className={cn("inline-flex h-6 min-w-10 items-center justify-center rounded-full px-2 text-[11px] font-bold transition disabled:cursor-default", granted === permissions.length ? "bg-[color-mix(in_srgb,var(--ok)_16%,transparent)] text-ok" : granted > 0 ? "bg-[color-mix(in_srgb,var(--warn)_16%,transparent)] text-warn" : "bg-surface text-fg-3", canEdit && "hover:brightness-95")}
              >
                {busy === key ? <Loader2 size={12} className="animate-spin" /> : `${granted}/${permissions.length}`}
              </button>
            </td>
          );
        })}
      </tr>
      {permissions.map((permission) => (
        <tr key={permission} className="border-b border-line-2 transition hover:bg-[color-mix(in_srgb,var(--t1)_4%,transparent)]">
          <td className="sticky left-0 z-10 bg-surface px-4 py-2 text-fg">
            {PERMISSION_LABEL[permission] ?? permission}
            <span className="ml-2 font-mono text-[11px] text-fg-3">{permission}</span>
          </td>
          {roles.map((role) => {
            const on = Boolean(matrix[role.code]?.[permission]);
            const key = `${role.code}:${permission}`;
            return (
              <td key={role.code} className="px-2 py-2 text-center">
                {busy === key ? (
                  <Loader2 size={14} className="mx-auto animate-spin text-fg-3" />
                ) : (
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={on}
                    aria-label={`${PERMISSION_LABEL[permission] ?? permission} para ${role.name}`}
                    disabled={!canEdit || busy !== null}
                    onClick={() => onApply(role.code, [permission], !on, key)}
                    className={cn("mx-auto grid h-5 w-5 place-items-center rounded-md border transition disabled:cursor-default", on ? "border-transparent bg-brand text-brand-fg" : "border-line bg-surface text-transparent", canEdit && "hover:scale-110")}
                  >
                    <Check size={13} strokeWidth={3} />
                  </button>
                )}
              </td>
            );
          })}
        </tr>
      ))}
    </>
  );
}
