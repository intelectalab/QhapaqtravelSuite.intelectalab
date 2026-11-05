import { chromium, type FullConfig, type Page } from '@playwright/test';
import { execSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { authenticator } from 'otplib';
import { T } from '../support/testids';
import { R } from '../support/routes';
import { PASSWORD, ROLE_USERS, TOTP_SECRET, userFor, type RoleAlias } from '../support/users';

const here = path.dirname(fileURLToPath(import.meta.url));
export const AUTH_DIR = path.resolve(here, '../.auth');
export const authFile = (alias: RoleAlias | 'tenantB') => path.join(AUTH_DIR, `${alias}.json`);

/** Roles con sesión web precalculada (storageState). Pasajero y guía se autentican aparte. */
const WEB_ROLES: RoleAlias[] = ['tenantAdmin', 'manager', 'sales', 'sales2', 'operations', 'finance', 'accounting', 'b2b', 'customer', 'superAdmin', 'provider'];

export async function uiLogin(page: Page, email: string, mfa: boolean) {
  await page.goto(R.login);
  await page.getByTestId(T.loginEmail).fill(email);
  await page.getByTestId(T.loginPassword).fill(PASSWORD);
  await page.getByTestId(T.loginSubmit).click();
  if (mfa) {
    await page.getByTestId(T.mfaCode).fill(authenticator.generate(TOTP_SECRET));
    await page.getByTestId(T.mfaSubmit).click();
  }
  await page.getByTestId(T.shell).waitFor();
}

export default async function globalSetup(config: FullConfig) {
  // 1) Base en estado semilla (seeds/*.json) y fecha congelada E2E_FROZEN_TODAY.
  const cmd = process.env.E2E_DB_RESET_CMD;
  if (cmd) execSync(cmd, { stdio: 'inherit' });

  // 2) storageState por rol (login real por UI: valida también la pantalla de login y MFA).
  mkdirSync(AUTH_DIR, { recursive: true });
  const baseURL = config.projects[0].use.baseURL!;
  const browser = await chromium.launch();
  for (const alias of WEB_ROLES) {
    const u = userFor(alias);
    const ctx = await browser.newContext({ baseURL });
    const page = await ctx.newPage();
    await uiLogin(page, u.email, u.mfa);
    await ctx.storageState({ path: authFile(alias) });
    await ctx.close();
  }
  await browser.close();
  void ROLE_USERS;
}
