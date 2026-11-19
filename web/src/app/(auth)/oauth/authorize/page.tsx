import type { Metadata } from "next";
import { OAuthConsent, OAuthConsentError } from "@/features/auth/OAuthConsent";
import { OAUTH_FIELDS, type OAuthConsentData } from "@/lib/oauth";
import { apiFetch } from "@/lib/server/api";
import { decideOAuth } from "./actions";

export const metadata: Metadata = { title: "Autorizar aplicación" };

export default async function OAuthAuthorizePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const fields = Object.fromEntries(OAUTH_FIELDS.flatMap((field) => (typeof params[field] === "string" ? [[field, params[field] as string]] : []))) as Record<string, string>;
  const result = await apiFetch<OAuthConsentData>(`/oauth/authorize?${new URLSearchParams(fields).toString()}`);

  if (!result.ok || !result.data) {
    const detail = result.error?.errors ? Object.values(result.error.errors)[0]?.[0] : undefined;
    return <OAuthConsentError message={detail ?? result.error?.message ?? "No pudimos validar el pedido de la aplicación."} />;
  }

  return <OAuthConsent consent={result.data} fields={fields} action={decideOAuth} />;
}
