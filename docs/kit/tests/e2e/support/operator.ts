import { expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { Api, apiToken } from './api';
import { API } from './routes';
import { userFor } from './users';

/**
 * Simulador del cliente móvil (app RN del operador) contra la API real (esp. 05 §6.x `/mobile/operator/*`).
 * Playwright prueba Next.js; la app Expo se prueba aparte (Maestro/Detox, ver README). Estos helpers
 * permiten que E2E-04/07/10 validen el contrato de API que usa la app y su reflejo en el back-office.
 * SUPUESTO: forma de `payload` por tipo de acción; ajustar al contrato OpenAPI cuando exista.
 */
export type OpAction = {
  client_action_id: string;
  type: 'confirm' | 'start' | 'checkin' | 'checkin_all' | 'evidence' | 'finish' | 'incident';
  assignment_id: string;
  occurred_at: string;
  offline: boolean;
  payload?: Record<string, unknown>;
};

export const action = (type: OpAction['type'], assignment_id: string, payload: Record<string, unknown> = {}, offline = false, at = new Date()): OpAction => ({
  client_action_id: randomUUID(), // la app usa UUID v7; el servidor solo exige unicidad
  type, assignment_id, occurred_at: at.toISOString(), offline, payload,
});

export async function operatorApi(alias: 'guide' | 'driver' = 'guide') {
  const u = userFor(alias);
  return Api.withToken(await apiToken(u.email, { mfa: u.mfa }));
}

/** Primera asignación del recurso que cumpla el predicado (bootstrap = ventana [-2 d, +14 d]). */
export async function pickAssignment(api: Api, pred: (a: any) => boolean) {
  const r = await api.get(API.opBootstrap);
  expect(r.ok(), 'bootstrap del operador').toBeTruthy();
  const body = await r.json();
  return (body.assignments ?? body.data?.assignments ?? []).find(pred) ?? null;
}

export async function send(api: Api, a: OpAction) {
  const r = await api.post(API.opAction, a);
  expect(r.status(), await r.text()).toBeLessThan(300);
  return r.json() as Promise<{ result: 'applied' | 'conflict' | 'rejected'; conflict_rule?: string; message?: string; assignment: any }>;
}

export async function sync(api: Api, actions: OpAction[]) {
  const r = await api.post(API.opSync, { actions });
  expect(r.status(), await r.text()).toBeLessThan(300);
  return (await r.json()) as { results: Array<{ client_action_id: string; result: string; conflict_rule?: string; message?: string }> };
}
