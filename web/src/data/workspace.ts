import tenantSeed from "./seed/tenant.json";
import usersSeed from "./seed/users.json";

export const BUSINESS_DATE = "2026-09-29";

export interface StaffMember {
  id: string;
  name: string;
  role: string;
}

const staff: StaffMember[] = (usersSeed as Array<{ id: string; name: string; role: string }>).map(({ id, name, role }) => ({ id, name, role }));

export function staffMember(id: string): StaffMember | undefined {
  return staff.find((member) => member.id === id);
}

export function staffName(id: string): string {
  return staffMember(id)?.name ?? "Sin asignar";
}

export function shortName(fullName: string): string {
  const [first, last] = fullName.split(" ");
  return last ? `${first} ${last}` : first;
}

export const workspace = {
  tenant: { name: tenantSeed.short, legalName: tenantSeed.name, initials: tenantSeed.logo, branch: "Sede Miraflores" },
  user: { id: "U01", name: "Mariela Quispe", role: "Gerencia" },
};
