import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * Usuarios de prueba = kit-ia/seeds/users.json (los mismos del prototipo, U01…U17).
 * El E2ESeeder de Laravel los crea en TNT-0001 con password E2E_PASSWORD y, si mfa=true,
 * con el secreto TOTP E2E_TOTP_SECRET (supuesto del kit; nunca en producción).
 */
const here = path.dirname(fileURLToPath(import.meta.url));
const seedsDir = path.resolve(here, '../../../seeds');

export type SeedUser = { id: string; name: string; email: string; role: string; sede: string; status: string; mfa: boolean };
export type SeedTenant = { id: string; name: string; subdomain: string; plan: string; adminEmail: string; status: string };

export const SEED_USERS: SeedUser[] = JSON.parse(readFileSync(path.join(seedsDir, 'users.json'), 'utf8'));
export const SEED_TENANTS: SeedTenant[] = JSON.parse(readFileSync(path.join(seedsDir, 'tenants.json'), 'utf8'));

export const byId = (id: string): SeedUser => {
  const u = SEED_USERS.find((x) => x.id === id);
  if (!u) throw new Error(`Usuario ${id} no existe en seeds/users.json`);
  return u;
};

/** Alias de rol → usuario semilla. Los tests usan SIEMPRE estos alias, nunca correos sueltos. */
export const ROLE_USERS = {
  tenantAdmin: 'U01', // Mariela Quispe · tenant_admin · MFA
  manager: 'U02',     // Renato Salazar · manager · MFA
  sales: 'U03',       // Lucía Paredes · sales · sin MFA · cartera CLI-0003/4/6/10
  sales2: 'U04',      // Diego Fernández · sales · MFA · cartera CLI-0001/5/8
  operations: 'U05',  // Karina Huamán · operations · MFA
  finance: 'U07',     // Patricia León · finance · MFA
  accounting: 'U08',  // César Villanueva · accounting · MFA
  guide: 'U09',       // Wilber Condori · guide (app operador; recurso G01)
  driver: 'U11',      // Edwin Choque · driver (recurso C01)
  inactiveSales: 'U12', // Rosa Tito · sales · inactivo (login debe fallar)
  b2b: 'U13',         // Wayra Viajes · b2b (AGB-01 / CLI-0007)
  customer: 'U14',    // Gabriela Ríos · customer (CLI-0001)
  passenger: 'U15',   // Thomas Keller · passenger (CLI-0003 / RES-2026-000347)
  superAdmin: 'U16',  // Superadmin Plataforma · super_admin · MFA
  provider: 'U17',    // Hotel Tambo Real · provider (PRV-001)
} as const;

export type RoleAlias = keyof typeof ROLE_USERS;

export const userFor = (alias: RoleAlias): SeedUser => byId(ROLE_USERS[alias]);

/** Tenant A (demo) y tenant B (aislamiento E2E-08). */
export const TENANT_A = SEED_TENANTS.find((t) => t.id === 'TNT-0001')!;
export const TENANT_B = SEED_TENANTS.find((t) => t.id === 'TNT-0002')!;
/** Admin de TNT-0002: lo crea el E2ESeeder con el correo de tenants.json (supuesto). */
export const TENANT_B_ADMIN = { id: 'TNT-0002-ADMIN', email: TENANT_B.adminEmail, role: 'tenant_admin', mfa: false };

export const PASSWORD = process.env.E2E_PASSWORD ?? 'KipuControl#E2E-2026';
export const TOTP_SECRET = process.env.E2E_TOTP_SECRET ?? 'JBSWY3DPEHPK3PXP';
