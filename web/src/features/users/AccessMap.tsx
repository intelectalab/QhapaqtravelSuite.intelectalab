"use client";

import { Check, Minus } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { SelectField } from "@/components/ui/SelectField";
import { NAV_GROUPS, screenFor } from "@/config/navigation";
import { cn } from "@/lib/cn";
import { EXPERIENCE_LABEL, SCOPE_LABEL, type AccessMapData, type RoleScope } from "@/lib/roles";

interface Row {
  path: string;
  label: string;
  group: string;
}

const OTHER = "Otras pantallas";

function humanize(segment: string): string {
  const text = segment.replace(/[-_]/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function rowOf(path: string): Row {
  for (const group of NAV_GROUPS) {
    const exact = group.screens.find((screen) => screen.href === path);
    if (exact) return { path, label: exact.label, group: group.label };
  }
  for (const group of NAV_GROUPS) {
    if (group.screens.some((screen) => screen.href.startsWith(`${path}/`))) return { path, label: `Todo el módulo ${group.label}`, group: group.label };
  }
  const parent = screenFor(path);
  const group = parent ? NAV_GROUPS.find((item) => item.screens.includes(parent)) : undefined;
  if (parent && group) return { path, label: `${parent.label} · ${humanize(path.slice(parent.href.length + 1).split("/")[0] ?? "")}`, group: group.label };
  return { path, label: humanize(path.split("/").filter(Boolean).join(" · ")), group: OTHER };
}

function rowsOf(data: AccessMapData): Row[] {
  const order = [...NAV_GROUPS.map((group) => group.label), OTHER];
  return data.screens.map((screen) => rowOf(screen.path)).sort((a, b) => order.indexOf(a.group) - order.indexOf(b.group));
}

export function AccessMap({ data }: { data: AccessMapData }) {
  const rows = useMemo(() => rowsOf(data), [data]);
  const groups = useMemo(() => Array.from(new Set(rows.map((row) => row.group))), [rows]);
  const [group, setGroup] = useState("");
  const [scope, setScope] = useState("");
  const [focus, setFocus] = useState<string | null>(null);
  const roles = data.roles.filter((role) => scope === "" || role.scope === scope);
  const visible = rows.filter((row) => group === "" || row.group === group);
  const selected = data.roles.find((role) => role.role === focus) ?? null;

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-[240px_240px_1fr] sm:items-end">
        <SelectField label="Módulo" name="group" options={groups.map((value) => ({ value, label: value }))} value={group} placeholder="Todos los módulos" clearable onChange={setGroup} />
        <SelectField label="Tipo de rol" name="scope" options={(Object.keys(SCOPE_LABEL) as RoleScope[]).map((value) => ({ value, label: SCOPE_LABEL[value] }))} value={scope} placeholder="Todos los roles" clearable onChange={setScope} />
        <p className="text-[12.5px] text-fg-3 sm:pb-2.5">Cada columna es un rol: toca su nombre para ver el resumen. Los roles de portal o app móvil no entran al back-office.</p>
      </div>

      {selected && (
        <Card className="animate-[rise-in_320ms_cubic-bezier(0.22,1,0.36,1)_backwards]">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <span className="text-[12px] font-semibold text-fg-3">{SCOPE_LABEL[selected.scope]}{selected.custom ? " · personalizado" : " · base"}</span>
              <h2 className="text-[17px] font-bold tracking-tight text-fg">{selected.name}</h2>
              <p className="mt-1 text-[13px] text-fg-2">
                {EXPERIENCE_LABEL[selected.experience] ?? selected.experience} · ve {selected.allowed} de {data.screens.length} pantallas del back-office
              </p>
            </div>
            <Link href={`/admin/roles?rol=${selected.role}`} className="text-[13px] font-semibold text-accent hover:underline">
              Editar permisos del rol
            </Link>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <h3 className="text-[12.5px] font-semibold text-ok">Puede entrar a</h3>
              <p className="mt-1 text-[12.5px] leading-relaxed text-fg-2">{rows.filter((row) => selected.screens[row.path]).map((row) => row.label).join(", ") || "Ninguna pantalla del back-office."}</p>
            </div>
            <div>
              <h3 className="text-[12.5px] font-semibold text-fg-3">No ve</h3>
              <p className="mt-1 text-[12.5px] leading-relaxed text-fg-3">{rows.filter((row) => !selected.screens[row.path]).map((row) => row.label).join(", ") || "Ve todas las pantallas."}</p>
            </div>
          </div>
        </Card>
      )}

      <Card padded={false} className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-[12.5px]">
          <thead>
            <tr className="border-b border-line">
              <th className="sticky left-0 z-10 bg-surface px-4 py-3 text-left font-semibold text-fg-3">Pantalla</th>
              {roles.map((role) => (
                <th key={role.role} className="px-2 py-3 text-center align-bottom">
                  <button type="button" onClick={() => setFocus(focus === role.role ? null : role.role)} className={cn("mx-auto block max-w-[96px] rounded-lg px-1.5 py-1 text-[12px] font-semibold leading-tight transition", focus === role.role ? "bg-brand text-brand-fg" : "text-fg hover:bg-surface-2")}>
                    {role.name}
                  </button>
                  <span className="mt-1 block text-[11px] font-medium text-fg-3">{role.allowed}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {groups
              .filter((name) => group === "" || name === group)
              .map((name) => (
                <GroupRows key={name} name={name} rows={visible.filter((row) => row.group === name)} roles={roles} focus={focus} />
              ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function GroupRows({ name, rows, roles, focus }: { name: string; rows: Row[]; roles: AccessMapData["roles"]; focus: string | null }) {
  return (
    <>
      <tr className="bg-surface-2">
        <td colSpan={roles.length + 1} className="sticky left-0 px-4 py-2 text-[12px] font-bold text-fg-2">
          {name}
        </td>
      </tr>
      {rows.map((row) => (
        <tr key={row.path} className="border-b border-line-2 transition hover:bg-[color-mix(in_srgb,var(--t1)_4%,transparent)]">
          <td className="sticky left-0 z-10 bg-surface px-4 py-2 text-fg">
            {row.label}
            <span className="ml-2 font-mono text-[11px] text-fg-3">{row.path}</span>
          </td>
          {roles.map((role) => (
            <td key={role.role} className={cn("px-2 py-2 text-center", focus === role.role && "bg-[color-mix(in_srgb,var(--brand)_8%,transparent)]")}>
              {role.screens[row.path] ? <Check size={15} className="mx-auto text-ok" aria-label="Puede entrar" /> : <Minus size={14} className="mx-auto text-line" aria-label="Sin acceso" />}
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
