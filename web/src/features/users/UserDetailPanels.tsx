import { Activity, Briefcase, IdCard, KeyRound, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { FieldList } from "@/components/ui/Details";
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
      <TintCardTitle icon={KeyRound} title="Permisos efectivos" aside={`${user.permissions.length}`} />
      {user.permission_modules.length === 0 ? (
        <p className="text-[13px] text-fg-3">Este usuario no tiene permisos.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {user.permission_modules.map((group) => (
            <div key={group.module}>
              <p className="mb-1.5 text-[12px] font-semibold text-fg-2">{group.module}</p>
              <div className="flex flex-wrap gap-1.5">
                {group.permissions.map((permission) => (
                  <span key={permission} title={permission} className="rounded-[8px] bg-surface-2 px-2 py-1 text-[12px] text-fg-2 transition-colors hover:bg-accent/10 hover:text-accent">
                    {PERMISSION_LABEL[permission] ?? permission}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      <p className="mt-3 text-[12px] text-fg-3">Vienen del rol. Para cambiarlos, edita el rol o asígnale otro.</p>
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
