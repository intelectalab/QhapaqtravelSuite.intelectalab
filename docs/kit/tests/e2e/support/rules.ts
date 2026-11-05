import { expect } from '@playwright/test';
import { Api } from './api';
import { API } from './routes';

/**
 * Enciende/apaga una regla del centro de reglas (esp. 17 §6: PATCH /admin/booking-rules/{code} con If-Match)
 * y devuelve una función para restaurar el estado original. Usar siempre en try/finally o afterEach.
 */
export async function setRule(code: string, enabled: boolean): Promise<() => Promise<void>> {
  const admin = await Api.as('tenantAdmin');
  const list = await (await admin.get('/admin/booking-rules')).json();
  const rule = (list.data as any[]).find((r) => r.code === code);
  expect(rule, `regla ${code}`).toBeTruthy();
  const original = rule.enabled as boolean;
  const r = await admin.patch(API.bookingRule(code), { enabled }, { 'If-Match': String(rule.lock_version) });
  expect(r.status(), await r.text()).toBeLessThan(300);
  const lv = (await r.json()).data.lock_version;
  return async () => {
    if (original !== enabled) await admin.patch(API.bookingRule(code), { enabled: original }, { 'If-Match': String(lv) });
    await admin.dispose();
  };
}
