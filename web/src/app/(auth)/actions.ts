"use server";

import { headers } from "next/headers";
import { tenantSlugFrom } from "@/lib/server/api";
import { confirmMfa, confirmMfaSetup, signIn, startMfaSetup, type FormState, type MfaSetupState } from "@/lib/server/auth";

export async function login(_state: FormState, form: FormData): Promise<FormState> {
  return signIn(form, { tenant_slug: tenantSlugFrom((await headers()).get("host")) });
}

export async function verifyMfa(_state: FormState, form: FormData): Promise<FormState> {
  return confirmMfa("agency", form);
}

export async function beginMfaSetup(): Promise<MfaSetupState> {
  return startMfaSetup();
}

export async function finishMfaSetup(state: MfaSetupState, form: FormData): Promise<MfaSetupState> {
  return confirmMfaSetup(state, form);
}
