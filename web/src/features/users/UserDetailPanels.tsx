import { Activity, Briefcase, ChevronDown, IdCard, KeyRound, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { FieldList } from "@/components/ui/Details";
import { InfoTip } from "@/components/ui/InfoTip";
import { TintCardTitle } from "@/components/ui/Tinted";
import { actionLabel } from "@/lib/admin";
import { formatDateTime } from "@/lib/format";
import { PERMISSION_LABEL } from "@/lib/roles";
import type { UserDetail } from "@/lib/users";

export const USER_STATUS = { activo: { label: "Activo", tone: "ok" }, pendiente: { label: "Invitado", tone: "sun" }, inactivo: { label: "Desactivado", tone: "mute" } } as const;

export const MFA_STATE = { configurada: { label: "Configurada", tone: "ok" }, pendiente: { label: "Pendiente", tone: "warn" }, opcional: { label: "Opcional", tone: "mute" } } as const;

export function mfaState(enabled: boolean, required: boolean): keyof typeof MFA_STATE {
  return enabled ? "configurada" : required ? "pendiente" : "opcional";
}

export function UserProfileCard({ user }: { user: UserDetail }) {
  return (
    <Card>
      <TintCardTitle icon={IdCard} title="Perfil" />
      <FieldList
        fields={[
          { label: "Correo", value: user.email },
          { label: "Teléfono", value: user.phone ?? "—" },
          { label: "Rol", value: user.role ? <Link href={`/admin/roles?rol=${user.role.code}`} className="hover:text-accent">{user.role.name}</Link> : "Sin rol" },
          { label: "Sede", value: user.sede?.name ?? "—" },
          { label: "Código", value: <span className="font-mono text-[12.5px]">{user.code}</span> },
          { label: "Alta", value: user.created_at ? formatDateTime(user.created_at) : "—" },
          { label: "Último acceso", value: user.last_login_at ? `${formatDateTime(user.last_login_at)}${user.last_login_ip ? ` · ${user.last_login_ip}` : ""}` : "Nunca" },
        ]}
      />
    </Card>
  );
}

export function UserSecurityCard({ user }: { user: UserDetail }) {
  const mfa = MFA_STATE[mfaState(user.mfa_enabled, user.mfa_required)];
  return (
    <Card>
      <TintCardTitle icon={ShieldCheck} title="Acceso y seguridad" />
      <FieldList
        fields={[
          { label: "Estado", value: <Badge tone={USER_STATUS[user.status].tone}>{USER_STATUS[user.status].label}</Badge> },
          { label: "Dos pasos", value: <Badge tone={mfa.tone}>{mfa.label}</Badge> },
          ...(user.status === "pendiente" ? [{ label: "Invitación", value: user.invitation_expires_at ? `Vence el ${formatDateTime(user.invitation_expires_at)}` : "Vencida: reenvíala" }] : []),
          ...(user.status === "inactivo" ? [{ label: "Desactivado", value: <span title={user.deactivated_reason ?? undefined}>{user.deactivated_at ? formatDateTime(user.deactivated_at) : "—"}{user.deactivated_reason ? ` · ${user.deactivated_reason}` : ""}</span> }] : []),
        ]}
      />
    </Card>
  );
}

export function UserWorkloadCard({ user }: { user: UserDetail }) {
  const items = [
    { label: "Oportunidades abiertas", value: user.workload.opportunities, href: "/crm/oportunidades" },
    { label: "Actividades pendientes", value: user.workload.activities, href: "/crm/actividades" },
    { label: "Clientes en su cartera", value: user.workload.clients, href: "/crm/clientes" },
  ];
  const open = user.workload.opportunities + user.workload.activities;
  return (
    <Card>
      <TintCardTitle icon={Briefcase} title="Trabajo a su cargo" />
      <div className="grid grid-cols-3 gap-2">
        {items.map((item) => (
          <Link key={item.label} href={item.href} className="lift rounded-[12px] border border-line-2 px-3 py-2.5 hover:border-accent/40">
            <b className="block text-[20px] font-semibold tabular-nums">{item.value}</b>
            <span className="block text-[11.5px] leading-tight text-fg-3">{item.label}</span>
          </Link>
        ))}
      </div>
      {user.status !== "inactivo" && open > 0 && <p className="mt-3 text-[12.5px] text-warn">Si lo desactivas, reasigna antes sus oportunidades y actividades.</p>}
    </Card>
  );
}

export function UserPermissionsCard({ user }: { user: UserDetail }) {
  return (
    <Card>
      <TintCardTitle
        icon={KeyRound}
        title="Permisos efectivos"
        aside={
          <span className="flex items-center gap-1.5 text-[12.5px] text-fg-3">
            {user.permissions.length}
            <InfoTip label="De dónde vienen">Vienen del rol. Para cambiarlos, edita el rol o asígnale otro.</InfoTip>
          </span>
        }
      />
      {user.permission_modules.length === 0 ? (
        <p className="text-[13px] text-fg-3">Este usuario no tiene permisos.</p>
      ) : (
        <ul className="grid gap-1">
          {user.permission_modules.map((group) => {
            const total = Math.max(group.total ?? group.permissions.length, group.permissions.length);
            return (
              <li key={group.module}>
                <details className="group/module rounded-lg px-1.5 py-1 transition hover:bg-surface-2">
                  <summary className="grid cursor-pointer list-none grid-cols-[130px_1fr_44px_16px] items-center gap-2 text-[12.5px]">
                    <span className="truncate text-fg-2">{group.module}</span>
                    <span className="block h-1.5 overflow-hidden rounded-full bg-surface-2">
                      <span className="block h-full rounded-full bg-[var(--tint,var(--t1))]" style={{ width: `${(group.permissions.length / total) * 100}%` }} />
                    </span>
                    <span className="text-right font-mono text-[12px] text-fg-3">
                      {group.permissions.length}/{total}
                    </span>
                    <ChevronDown size={14} className="text-fg-3 transition group-open/module:rotate-180" />
                  </summary>
                  <ul className="mt-1.5 flex flex-wrap gap-1 pb-1 pl-1">
                    {group.permissions.map((permission) => (
                      <li key={permission} title={permission} className="rounded-md bg-surface px-2 py-0.5 text-[11.5px] text-fg-2">
                        {PERMISSION_LABEL[permission] ?? permission}
                      </li>
                    ))}
                  </ul>
                </details>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

export function UserActivityCard({ user }: { user: UserDetail }) {
  return (
    <Card>
      <TintCardTitle icon={Activity} title="Actividad reciente" aside={<Link href={`/admin/auditoria?periodo=0&q=${encodeURIComponent(user.name)}`} className="text-[12.5px] font-semibold text-accent hover:underline">Ver en la auditoría</Link>} />
      {user.activity.length === 0 ? (
        <p className="text-[13px] text-fg-3">Sin actividad registrada.</p>
      ) : (
        <ol className="flex flex-col">
          {user.activity.map((event) => (
            <li key={event.id}>
              <Link href={`/admin/auditoria/${event.code}`} className="group flex items-center gap-3 rounded-[11px] px-2 py-2.5 transition-colors hover:bg-surface-2">
                <span className={event.critical ? "h-2 w-2 flex-none rounded-full bg-bad" : "h-2 w-2 flex-none rounded-full bg-accent"} />
                <span className="min-w-0 flex-1 truncate text-[13px] font-semibold group-hover:text-accent">
                  {actionLabel(event.action)} <span className="font-normal text-fg-3">· {event.entity} {event.entity_id}</span>
                </span>
                <span className="flex-none text-[11.5px] text-fg-3">{formatDateTime(event.at, false)}</span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
