import { History, LayoutGrid, Users } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { StatusBadge } from "@/components/ui/Badge";
import { formatDateTime } from "@/lib/format";
import { EXPERIENCE_LABEL, PERMISSION_LABEL, type PermissionModule, type RoleDetail } from "@/lib/roles";

const ACTION_LABEL: Record<string, string> = { otorgar_permiso: "Otorgó", revocar_permiso: "Quitó", crear_rol: "Creó el rol", editar_rol: "Editó el rol", eliminar_rol: "Eliminó el rol" };

function Panel({ icon, title, aside, children }: { icon: ReactNode; title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-tile border border-line-2 bg-surface p-4">
      <header className="mb-3 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-[13.5px] font-bold">
          <span className="text-[var(--tint)]">{icon}</span>
          {title}
        </h3>
        {aside}
      </header>
      {children}
    </section>
  );
}

export function RoleDetailPanels({ detail, catalog, granted }: { detail: RoleDetail; catalog: PermissionModule[]; granted: string[] }) {
  const pct = detail.screens.total > 0 ? Math.round((detail.screens.allowed / detail.screens.total) * 100) : 0;

  return (
    <div className="grid gap-4 border-t border-line p-5 xl:grid-cols-2">
      <Panel icon={<LayoutGrid size={16} />} title="Experiencia y acceso" aside={<Link href="/admin/roles/mapa" className="text-[12px] font-semibold text-accent hover:underline">Ver mapa de acceso</Link>}>
        <p className="text-[13px] text-fg-2">
          {EXPERIENCE_LABEL[detail.experience] ?? detail.experience} · {detail.custom ? "rol propio" : "rol base"} · identificador <span className="font-mono text-[12px]">{detail.code}</span>
        </p>
        {detail.data_scope && (
          <p className="mt-2 rounded-[10px] bg-[color-mix(in_srgb,var(--tint)_8%,var(--surface))] px-3 py-2 text-[12.5px]">
            <span className="font-semibold text-[var(--tint)]">Alcance de datos: </span>
            {detail.data_scope}
          </p>
        )}
        <div className="mt-3">
          <div className="flex items-center justify-between text-[12.5px]">
            <span className="text-fg-3">Pantallas del back-office</span>
            <b className="text-fg">
              {detail.screens.allowed} de {detail.screens.total}
            </b>
          </div>
          <span className="mt-1.5 block h-2 overflow-hidden rounded-full bg-surface-2">
            <span className="block h-full origin-left rounded-full bg-[var(--tint)] motion-safe:animate-[fill-x_700ms_cubic-bezier(0.22,1,0.36,1)_backwards]" style={{ width: `${Math.max(2, pct)}%` }} />
          </span>
        </div>
        <ul className="mt-4 grid gap-1.5">
          {catalog.map((group) => {
            const on = group.permissions.filter((permission) => granted.includes(permission)).length;
            return (
              <li key={group.module} className="group grid grid-cols-[120px_1fr_44px] items-center gap-2 text-[12px]" title={`${on} de ${group.permissions.length} permisos de ${group.module}`}>
                <span className="truncate text-fg-2">{group.module}</span>
                <span className="block h-1.5 overflow-hidden rounded-full bg-surface-2">
                  <span className="block h-full rounded-full bg-[var(--tint)] transition-[filter] group-hover:brightness-110" style={{ width: `${(on / Math.max(1, group.permissions.length)) * 100}%` }} />
                </span>
                <span className="text-right font-mono text-fg-3">
                  {on}/{group.permissions.length}
                </span>
              </li>
            );
          })}
        </ul>
      </Panel>

      <Panel icon={<Users size={16} />} title="Usuarios con este rol" aside={<span className="text-[12px] text-fg-3">{detail.users.length}</span>}>
        {detail.users.length === 0 ? (
          <p className="text-[13px] text-fg-3">Ningún usuario tiene este rol todavía.</p>
        ) : (
          <ul className="grid gap-2">
            {detail.users.map((user) => (
              <li key={user.email} className="flex items-center justify-between gap-3 rounded-xl border border-line-2 px-3 py-2">
                <span className="min-w-0">
                  <Link href={user.code ? `/admin/usuarios/${encodeURIComponent(user.code)}` : `/admin/usuarios?q=${encodeURIComponent(user.email)}`} className="block truncate text-[13px] font-semibold text-fg hover:text-accent">
                    {user.name}
                  </Link>
                  <span className="block truncate text-[12px] text-fg-3">
                    {user.email}
                    {user.sede ? ` · ${user.sede}` : ""}
                  </span>
                </span>
                <StatusBadge status={user.status} />
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <div className="xl:col-span-2">
        <Panel icon={<History size={16} />} title="Cambios de permisos" aside={<Link href={`/admin/auditoria?entidad=Permiso&q=${encodeURIComponent(detail.code)}`} className="text-[12px] font-semibold text-accent hover:underline">Ver en la auditoría</Link>}>
          {detail.audit.length === 0 ? (
            <p className="text-[13px] text-fg-3">Sin cambios registrados.</p>
          ) : (
            <ol className="grid gap-1.5">
              {detail.audit.map((event, index) => (
                <li key={`${event.at}-${index}`} className="grid gap-1 rounded-xl px-3 py-2 text-[12.5px] transition hover:bg-surface-2 sm:grid-cols-[150px_1fr_160px] sm:items-center">
                  <span className="text-fg-3">{formatDateTime(event.at)}</span>
                  <span className="text-fg">
                    <b className="font-semibold">{ACTION_LABEL[event.action] ?? event.action}</b>
                    {event.permission ? ` · ${PERMISSION_LABEL[event.permission] ?? event.permission}` : event.after ? ` · ${event.after}` : ""}
                  </span>
                  <span className="truncate text-fg-2 sm:text-right">{event.actor}</span>
                </li>
              ))}
            </ol>
          )}
        </Panel>
      </div>
    </div>
  );
}
