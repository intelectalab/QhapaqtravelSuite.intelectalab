import { test, expect, expectForbidden } from '../fixtures/auth';
import { R } from '../support/routes';
import { T } from '../support/testids';
import type { RoleAlias } from '../support/users';

/**
 * Acceso 403 por rol (esp. 00 §2 pantalla 403 y §7.5 matriz ACCESS; 09 T-14; 13 §7; 14 §7; 17 §7).
 * La UI oculta el menú y muestra la pantalla 403 con los permisos requeridos; la API responde 403
 * con `required_permissions`. El frontend nunca es la autoridad: se prueban ambos.
 * Fase 0 (shell + 403) y se amplía por módulo en cada fase.
 */
const UI_CASES: Array<[RoleAlias, string, string, string]> = [
  // rol, ruta, permiso requerido (alguno de), clave del menú que no debe verse
  ['manager', R.users, 'admin.users.manage', 'admin-usuarios'],
  ['manager', R.subscription, 'admin.billing.manage', 'admin-suscripcion'],
  ['sales', R.receivables, 'finance.receivables', 'finanzas'],
  ['sales', '/marketing/campanas', 'marketing.campaigns.manage', 'marketing'],
  ['sales', R.bookingRules, 'admin.settings.manage', 'admin-reglas'],
  ['operations', R.quotes, 'quotes.view', 'cotizaciones'],
  ['finance', R.leads, 'crm.leads.view', 'crm'],
  ['finance', R.orders, 'operations.view', 'operaciones'],
  ['accounting', R.profitability(), 'finance.profitability', 'finanzas-rentabilidad'],
  ['tenantAdmin', R.platformTenants, 'admin.tenant.manage', 'plataforma'],
  ['superAdmin', R.leads, 'crm.leads.view', 'crm'],
];

test.describe('RBAC · pantalla 403 por rol @fase0 @rbac @smoke', () => {
  for (const [alias, path, perm, navKey] of UI_CASES) {
    test(`${alias} → ${path} = 403 (${perm})`, async ({ pageAs }) => {
      const page = await pageAs(alias);
      await page.goto(path);
      await expectForbidden(page, perm);
      await expect(page.getByTestId(T.forbiddenPath)).toContainText(path.split('?')[0]);
      await expect(page.getByTestId(T.navItem(navKey))).toHaveCount(0);
      if (!['superAdmin'].includes(alias)) await expect(page.getByTestId(T.forbiddenRequestAccess)).toBeVisible();
    });
  }

  test('externos nunca ven back-office (cliente, B2B, proveedor)', async ({ pageAs }) => {
    for (const [alias, path] of [['customer', R.reservations], ['b2b', R.leads], ['provider', R.receivables]] as const) {
      const page = await pageAs(alias);
      await page.goto(path);
      await expect(page.getByTestId(T.forbidden).or(page.getByTestId(T.notFound))).toBeVisible();
    }
  });

  test('el intento queda auditado como acceso_denegado', async ({ pageAs, apiAs }) => {
    const page = await pageAs('sales');
    await page.goto(R.receivables);
    await expectForbidden(page);
    const admin = await apiAs('tenantAdmin');
    const ev = await (await admin.get('/audit-events', { 'filter[action]': 'acceso_denegado', 'filter[user]': 'U03', 'page[size]': 5 })).json();
    expect(ev.data.length).toBeGreaterThan(0);
  });
});

/** API: 403 con formato de error estándar (esp. 00 §6). */
const API_CASES: Array<[RoleAlias, 'GET' | 'POST' | 'PATCH', string, string]> = [
  ['manager', 'PATCH', '/settings/policies', 'admin.settings.manage'],        // 09 T-14
  ['sales', 'GET', '/iam/users', 'admin.users.manage'],                        // 09 T-14
  ['superAdmin', 'GET', '/crm/leads', 'crm.leads.view'],                       // 09 T-14
  ['manager', 'GET', '/billing/subscription', 'admin.billing.manage'],         // 13 §10.10
  ['manager', 'GET', '/integrations/api-keys', 'admin.api.manage'],            // 13 §10.10
  ['tenantAdmin', 'GET', '/platform/metrics', 'admin.tenant.manage'],          // 13 §10.10
  ['sales', 'GET', '/marketing/campaigns', 'marketing.campaigns.manage'],      // 14 §10.2
  ['operations', 'GET', '/crm/sales-targets', 'crm.targets.view'],            // 14 §10.2
  ['operations', 'PATCH', '/admin/booking-rules/R-LODGING', 'admin.settings.manage'], // 17 §10.2
  ['manager', 'POST', '/channels/widget/rotate-key', 'admin.api.manage'],      // 17 §10.2
  ['sales', 'POST', '/reviews/RVO-0001/publish', 'channels.ecommerce.manage'], // 18 RVW-11
];

test.describe('RBAC · API 403 @fase0 @rbac', () => {
  for (const [alias, method, path, perm] of API_CASES) {
    test(`${alias} ${method} ${path} → 403`, async ({ apiAs }) => {
      const api = await apiAs(alias);
      const r = method === 'GET' ? await api.get(path) : method === 'POST' ? await api.postIdem(path, {}) : await api.patch(path, {}, { 'If-Match': '0' });
      expect(r.status()).toBe(403);
      const body = await r.json();
      expect(body.error).toBe('FORBIDDEN');
      expect(body.required_permissions).toContain(perm);
      expect(body.correlation_id).toBeTruthy();
    });
  }
});
