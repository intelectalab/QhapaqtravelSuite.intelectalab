"use server";

import { apiFetch } from "./api";

export async function loadCaptchaSiteKey(): Promise<string | null> {
  const result = await apiFetch<{ provider: string | null; site_key: string | null }>("/public/captcha", { auth: false });
  return result.ok && result.data?.site_key ? result.data.site_key : null;
}
