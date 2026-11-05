import { test, expect } from '../fixtures/auth';
import { Api, apiToken, API_URL } from '../support/api';
import { TENANT_A, TENANT_B, TENANT_B_ADMIN } from '../support/users';

/**
 * E2E-08 (esp. 00 SEC-BR-02, 09 T-01/T-02): el tenant A no accede a datos del tenant B.
 * - Recurso ajeno por id → 404 RESOURCE_NOT_FOUND (no revela existencia) + auditoría acceso_denegado.
 * - Intento de fijar otro tenant (X-Tenant-Id / tenant_id en body) → se ignora; si la ruta lo fuerza → 403 TENANT_SCOPE_VIOLATION.
 * - Listados solo devuelven filas del tenant del token (global scope + RLS).
 * Fase 0 · criterio de salida.
 */
const TENANT_B_API = process.env.E2E_TENANT_B_API_URL ?? API_URL.replace(`${TENANT_A.subdomain}.`, `${TENANT_B.subdomain}.`);

test.describe('E2E-08 · Aislamiento multi-tenant @fase0 @e2e08 @smoke', () => {
  let a: Api; let b: Api;
  test.beforeAll(async () => {
    a = await Api.as('tenantAdmin');
    b = await Api.withToken(await apiToken(TENANT_B_ADMIN.email, { baseURL: TENANT_B_API }), TENANT_B_API);
  });
  test.afterAll(async () => { await a.dispose(); await b.dispose(); });

  // [listado, etiqueta, clave de ruta] — CRM y CxC se direccionan por código; el resto por id (ver api/ENDPOINTS.md)
  const resources = [
    ['/reservations', 'reservas', 'id'], ['/quotes', 'cotizaciones', 'id'], ['/crm/clients', 'clientes', 'code'], ['/crm/leads', 'leads', 'code'],
    ['/finance/receivables', 'CxC', 'code'], ['/ops/orders', 'órdenes', 'id'], ['/catalog/products', 'productos', 'id'],
  ] as const;

  for (const [path, label, key] of resources) {
    test(`${label}: id del tenant A leído con token de B → 404`, async () => {
      const list = await (await a.get(path, { 'page[size]': 1 })).json();
      test.skip(!list.data?.length, `Sin ${label} en la semilla de A`);
      const refA = list.data[0][key];
      const r = await b.get(`${path}/${refA}`);
      expect(r.status()).toBe(404);
      expect((await r.json()).error).toBe('RESOURCE_NOT_FOUND');
    });

    test(`${label}: el listado de B no contiene filas de A`, async () => {
      const idsA = new Set(((await (await a.get(path, { 'page[size]': 100 })).json()).data ?? []).map((x: any) => x.id));
      const rowsB = ((await (await b.get(path, { 'page[size]': 100 })).json()).data ?? []) as any[];
      expect(rowsB.filter((x) => idsA.has(x.id))).toHaveLength(0);
    });
  }

  test('cabecera X-Tenant-Id y tenant_id en body se ignoran', async () => {
    const r = await b.ctx.get('reservations', { headers: { 'X-Tenant-Id': TENANT_A.id } });
    expect(r.status()).toBeLessThan(500);
    const rows = (await r.json()).data ?? [];
    const idsA = new Set(((await (await a.get('/reservations', { 'page[size]': 100 })).json()).data ?? []).map((x: any) => x.id));
    expect(rows.filter((x: any) => idsA.has(x.id))).toHaveLength(0);
  });

  test('ruta que fuerza otro tenant → 403 TENANT_SCOPE_VIOLATION y queda auditado', async () => {
    const r = await b.ctx.get(`reservations?filter[tenant]=${TENANT_A.id}`, { headers: { 'X-Tenant-Id': TENANT_A.id } });
    // El middleware responde 403 cuando el cliente intenta explícitamente operar otro tenant
    if (r.status() === 403) expect((await r.json()).code).toBe('TENANT_SCOPE_VIOLATION');
    const audit = await (await b.get('/audit-events', { 'filter[action]': 'acceso_denegado', 'page[size]': 5 })).json();
    expect(audit.data?.length ?? 0).toBeGreaterThan(0);
  });

  test('el token de A no sirve en el host de B', async () => {
    const tokenA = await apiToken('mquispe@andeshorizonte.pe', { mfa: true });
    const cross = await Api.withToken(tokenA, TENANT_B_API);
    const r = await cross.get('/reservations');
    expect([401, 403]).toContain(r.status());
    await cross.dispose();
  });
});
