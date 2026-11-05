import type { Metadata } from "next";
import { MfaForm, MfaSetupForm } from "@/features/auth/AuthForms";
import { REALMS } from "@/lib/realms";
import { beginMfaSetup, finishMfaSetup, verifyMfa } from "../actions";

export const metadata: Metadata = { title: "Verificación en dos pasos" };

export default async function MfaPage({ searchParams }: PageProps<"/mfa">) {
  const { next, configurar } = await searchParams;
  const target = typeof next === "string" ? next : undefined;

  if (configurar === "1") {
    return <MfaSetupForm begin={beginMfaSetup} finish={finishMfaSetup} next={target} switchHref={REALMS.agency.logout} />;
  }

  return <MfaForm action={verifyMfa} switchHref={REALMS.agency.logout} next={target} />;
}
