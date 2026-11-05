import { test as base, expect, request, type Browser, type Page } from '@playwright/test';
import { authFile } from './global-setup';
import { Api, API_URL } from '../support/api';
import { API } from '../support/routes';
import { T } from '../support/testids';
import type { RoleAlias } from '../support/users';
import { userFor } from '../support/users';

type Fixtures = {
  /** Abre una página ya autenticada como el rol indicado (storageState de global-setup). */
  pageAs: (alias: RoleAlias) => Promise<Page>;
  /** Cliente API autenticado como el rol indicado (Sanctum + MFA). */
  apiAs: (alias: RoleAlias) => Promise<Api>;
  /** Página del portal del pasajero (U15) autenticada con enlace mágico leído de Mailpit. */
  passengerPage: Page;
};

async function newRolePage(browser: Browser, alias: RoleAlias): Promise<Page> {
  const ctx = await browser.newContext({ storageState: authFile(alias) });
  return ctx.newPage();
}

/** Enlace mágico del portal del pasajero (esp. 08 §6: auth/link → auth/verify). */
async function passengerMagicLink(email: string, reservationCode: string): Promise<string> {
  const api = await request.newContext({ baseURL: `${API_URL}/` });
  const r = await api.post(API.passengerLink.slice(1), { data: { email, reservation_code: reservationCode } });
  expect(r.status(), 'solicitud de enlace mágico').toBeLessThan(300);
  const mailpit = await request.newContext({ baseURL: process.env.E2E_MAILPIT_URL ?? 'http://localhost:8025' });
  // Último correo al pasajero; se extrae el primer enlace https?://…/portal-pasajero/…?token=
  const list = await (await mailpit.get(`api/v1/search?query=to:${encodeURIComponent(email)}`)).json();
  const id = list.messages?.[0]?.ID;
  expect(id, 'correo con enlace mágico en Mailpit').toBeTruthy();
  const msg = await (await mailpit.get(`api/v1/message/${id}`)).json();
  const m = /(https?:\/\/[^\s"'<>]+token=[^\s"'<>]+)/.exec(msg.HTML ?? msg.Text ?? '');
  expect(m, 'enlace con token').toBeTruthy();
  await api.dispose(); await mailpit.dispose();
  return m![1];
}

export const test = base.extend<Fixtures>({
  pageAs: async ({ browser }, use) => {
    const opened: Page[] = [];
    await use(async (alias) => { const p = await newRolePage(browser, alias); opened.push(p); return p; });
    for (const p of opened) await p.context().close();
  },
  apiAs: async ({}, use) => {
    const clients: Api[] = [];
    await use(async (alias) => { const a = await Api.as(alias); clients.push(a); return a; });
    for (const c of clients) await c.dispose();
  },
  passengerPage: async ({ browser }, use) => {
    const u = userFor('passenger');
    const link = await passengerMagicLink(u.email, 'RES-2026-000347');
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(link);
    await expect(page.getByTestId(T.shell)).toBeVisible();
    await use(page);
    await ctx.close();
  },
});

export { expect };

/** Afirmación reutilizable: pantalla 403 (esp. 00 §2) con los permisos requeridos. */
export async function expectForbidden(page: Page, requiredPerm?: string) {
  await expect(page.getByTestId(T.forbidden)).toBeVisible();
  if (requiredPerm) await expect(page.getByTestId(T.forbiddenPerms)).toContainText(requiredPerm);
}

/** Afirmación reutilizable: sin scroll horizontal de página (criterio responsive 400 px del prototipo). */
export async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, 'scroll horizontal de página').toBeLessThanOrEqual(1);
}

/** Toast con variante (data-variant=ok|bad|warn). */
export async function expectToast(page: Page, text: string | RegExp, variant?: 'ok' | 'bad' | 'warn') {
  const t = page.getByTestId(T.toast).filter({ hasText: text }).first();
  await expect(t).toBeVisible();
  if (variant) await expect(t).toHaveAttribute('data-variant', variant);
}
