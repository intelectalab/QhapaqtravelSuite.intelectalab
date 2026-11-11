"use client";

import { Clock, ShieldAlert, UserCheck, UserX } from "lucide-react";
import Link from "next/link";
import { DataTable } from "@/components/table/DataTable";
import type { Column, FilterConfig, MetricFilter, SortOption } from "@/components/table/types";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { formatDateTime } from "@/lib/format";
import type { TeamOptions, TeamUser } from "@/lib/users";
import { MFA_STATE, mfaState, USER_STATUS } from "./UserDetailPanels";
import { UserRowActions } from "./UserForms";

export function UsersTable({ users, options, viewerId, initialSearch }: { users: TeamUser[]; options: TeamOptions; viewerId: string; initialSearch?: string }) {
  const columns: Column<TeamUser>[] = [
    {
      id: "user",
      header: "Usuario",
      mobile: "title",
      cell: (user) => (
        <div className="flex min-w-0 items-center gap-3">
          <Avatar name={user.name} size="sm" />
          <div className="min-w-0">
            <Link href={`/admin/usuarios/${user.code}`} className="block truncate text-[13.5px] font-semibold hover:text-accent">
              {user.name}
              {user.id === viewerId && <span className="ml-1.5 text-[11.5px] font-medium text-accent">Tú</span>}
            </Link>
            <span className="block truncate text-xs text-fg-3">{user.email}</span>
          </div>
        </div>
      ),
    },
    { id: "role", header: "Rol", cell: (user) => <span className="text-[13px]">{user.role?.name ?? "Sin rol"}</span> },
    { id: "sede", header: "Sede", wideOnly: true, cell: (user) => <span className="text-[13px] text-fg-2">{user.sede?.name ?? "—"}</span> },
    {
      id: "status",
      header: "Estado",
      cell: (user) => (
        <span className="flex flex-col items-start gap-1">
          <Badge tone={USER_STATUS[user.status].tone}>{USER_STATUS[user.status].label}</Badge>
          {user.mfa.required && !user.mfa.enabled && user.status === "activo" && <span className="text-[11.5px] text-warn">Falta configurar 2 pasos</span>}
        </span>
      ),
    },
    { id: "mfa", header: "Dos pasos", wideOnly: true, cell: (user) => <Badge tone={MFA_STATE[mfaState(user.mfa.enabled, user.mfa.required)].tone}>{MFA_STATE[mfaState(user.mfa.enabled, user.mfa.required)].label}</Badge> },
    { id: "last", header: "Último acceso", wideOnly: true, cell: (user) => <span className="text-[12.5px] text-fg-3">{user.last_login_at ? formatDateTime(user.last_login_at) : "Nunca"}</span> },
    { id: "actions", header: "", align: "right", mobile: "detail", cell: (user) => <UserRowActions user={user} options={options} isSelf={user.id === viewerId} /> },
  ];

  const metrics: MetricFilter<TeamUser>[] = [
    { id: "active", label: "Activos", tone: "ok", icon: <UserCheck size={19} />, matches: (user) => user.status === "activo" },
    { id: "pending", label: "Invitados sin entrar", tone: "sun", icon: <Clock size={19} />, matches: (user) => user.status === "pendiente" },
    { id: "mfa", label: "Sin 2 pasos", tone: "bad", icon: <ShieldAlert size={19} />, matches: (user) => user.mfa.required && !user.mfa.enabled && user.status !== "inactivo" },
    { id: "inactive", label: "Desactivados", tone: "mute", icon: <UserX size={19} />, matches: (user) => user.status === "inactivo" },
  ];

  const filters: FilterConfig<TeamUser>[] = [
    { id: "role", label: "Rol", options: [...new Map(users.filter((user) => user.role).map((user) => [user.role!.code, user.role!.name])).entries()].map(([value, label]) => ({ value, label })), value: (user) => user.role?.code ?? "" },
    { id: "status", label: "Estado", options: Object.entries(USER_STATUS).map(([value, item]) => ({ value, label: item.label })), value: (user) => user.status },
    { id: "mfa", label: "Dos pasos", options: Object.entries(MFA_STATE).map(([value, item]) => ({ value, label: item.label })), value: (user) => mfaState(user.mfa.enabled, user.mfa.required) },
    { id: "sede", label: "Sede", options: options.sedes.map((sede) => ({ value: sede.id, label: sede.name })), value: (user) => user.sede?.id ?? "" },
  ];

  const sorts: SortOption<TeamUser>[] = [
    { id: "name", label: "Nombre", type: "text", value: (user) => user.name },
    { id: "last", label: "Último acceso", type: "date", value: (user) => user.last_login_at },
  ];

  return (
    <DataTable
      screen="usuarios"
      initialSearch={initialSearch}
      rows={users}
      columns={columns}
      getKey={(user) => user.code}
      entityLabel="usuarios"
      searchText={(user) => `${user.name} ${user.email} ${user.role?.name ?? ""}`}
      searchPlaceholder="Buscar por nombre, correo o rol"
      metrics={metrics}
      filters={filters}
      sorts={sorts}
    />
  );
}
