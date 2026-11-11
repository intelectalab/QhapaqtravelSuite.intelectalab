import "server-only";
import { redirect } from "next/navigation";
import { REALMS } from "@/lib/realms";
import type { AccessMapData, PermissionMatrixData, PermissionModule, RoleDetail, TeamRole } from "@/lib/roles";
import type { SedesData, TeamOptions, TeamSede, TeamUser, UserDetail } from "@/lib/users";
import { apiFetch } from "./api";
import { getResource } from "./resource";

export async function listTeam(): Promise<{ users: TeamUser[]; options: TeamOptions } | null> {
  const result = await apiFetch<{ data: TeamUser[]; meta: TeamOptions }>("/iam/users", { raw: true });
  if (result.status === 401) redirect(REALMS.agency.logout);
  if (result.status === 403 && result.error?.code === "MFA_REQUIRED") redirect(REALMS.agency.mfaPage);
  if (result.status === 403) return null;
  if (!result.ok || !result.data) throw new Error(result.error?.message ?? "No pudimos cargar los usuarios.");
  return { users: result.data.data, options: result.data.meta };
}

export async function listSedes(): Promise<SedesData | null> {
  const result = await apiFetch<{ data: TeamSede[]; meta: { managers: SedesData["managers"]; limit: number | null } }>("/iam/sedes", { raw: true });
  if (result.status === 401) redirect(REALMS.agency.logout);
  if (result.status === 403 && result.error?.code === "MFA_REQUIRED") redirect(REALMS.agency.mfaPage);
  if (result.status === 403) return null;
  if (!result.ok || !result.data) throw new Error(result.error?.message ?? "No pudimos cargar las sedes.");
  return { sedes: result.data.data, managers: result.data.meta.managers, limit: result.data.meta.limit };
}

export async function listRoles(): Promise<{ roles: TeamRole[]; catalog: PermissionModule[] } | null> {
  const result = await apiFetch<{ data: TeamRole[]; meta: { catalog: PermissionModule[] } }>("/iam/roles", { raw: true });
  if (result.status === 401) redirect(REALMS.agency.logout);
  if (result.status === 403 && result.error?.code === "MFA_REQUIRED") redirect(REALMS.agency.mfaPage);
  if (result.status === 403) return null;
  if (!result.ok || !result.data) throw new Error(result.error?.message ?? "No pudimos cargar los roles.");
  return { roles: result.data.data, catalog: result.data.meta.catalog };
}

export async function getAccessMap(): Promise<AccessMapData | null> {
  return getResource<AccessMapData>("/iam/access-map", "No pudimos cargar el mapa de acceso.");
}

export async function getPermissionMatrix(): Promise<PermissionMatrixData | null> {
  return getResource<PermissionMatrixData>("/iam/role-permissions", "No pudimos cargar la matriz de permisos.");
}

export async function getRoleDetail(code: string): Promise<RoleDetail | null> {
  const result = await apiFetch<RoleDetail>(`/iam/roles/${encodeURIComponent(code)}`);
  return result.ok ? result.data : null;
}

export async function getUserDetail(code: string): Promise<UserDetail | null> {
  return getResource<UserDetail>(`/iam/users/${encodeURIComponent(code)}`, "No pudimos cargar el usuario.");
}
