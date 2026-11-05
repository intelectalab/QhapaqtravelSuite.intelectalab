import type { Metadata } from "next";
import { MfaForm } from "@/features/auth/AuthForms";
import { REALMS } from "@/lib/realms";
import { verifyMfa } from "../actions";

export const metadata: Metadata = { title: "Verificación en dos pasos" };

export default async function MfaPage({ searchParams }: PageProps<"/mfa">) {
  const { next } = await searchParams;
  return <MfaForm action={verifyMfa} switchHref={REALMS.agency.logout} next={typeof next === "string" ? next : undefined} />;
}
