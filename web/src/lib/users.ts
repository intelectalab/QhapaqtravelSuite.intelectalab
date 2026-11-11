export type UserStatus = "activo" | "pendiente" | "inactivo";

export interface TeamUser {
  id: string;
  code: string;
  name: string;
  email: string;
  phone: string | null;
  status: UserStatus;
  role: { code: string; name: string } | null;
  sede: { id: string; name: string } | null;
  mfa: { enabled: boolean; required: boolean };
  last_login_at: string | null;
  color: string | null;
  deactivated_reason: string | null;
  invitation_expires_at: string | null;
}

export interface UserDetail {
  id: string;
  code: string;
  name: string;
  email: string;
  phone: string | null;
  status: UserStatus;
  mfa_enabled: boolean;
  mfa_required: boolean;
  last_login_at: string | null;
  last_login_ip: string | null;
  invited_at: string | null;
  deactivated_at: string | null;
  deactivated_reason: string | null;
  locale: string | null;
  created_at: string | null;
  role: { code: string; name: string; scope: string } | null;
  sede: { id: string; name: string } | null;
  invitation_expires_at: string | null;
  permissions: string[];
  permission_modules: { module: string; permissions: string[] }[];
  workload: { opportunities: number; activities: number; clients: number };
  activity: { id: string; code: string; entity: string; entity_id: string; action: string; before: string | null; after: string | null; critical: boolean; at: string }[];
}

export interface TeamOptions {
  roles: { code: string; name: string; description: string | null; mfa: boolean }[];
  sedes: { id: string; name: string }[];
}

export interface TeamSede {
  id: string;
  code: string;
  name: string;
  city: string | null;
  address: string;
  phone: string | null;
  status: "activa" | "inactiva";
  is_main: boolean;
  manager: { id: string; name: string } | null;
  users: number;
  reservations: number;
}

export interface SedesData {
  sedes: TeamSede[];
  managers: { id: string; name: string }[];
  limit: number | null;
}
