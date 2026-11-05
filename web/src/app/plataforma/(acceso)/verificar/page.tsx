import type { Metadata } from "next";
import { MfaForm } from "@/features/auth/AuthForms";
import { REALMS } from "@/lib/realms";
import { platformVerifyMfa } from "../../actions";

export const metadata: Metadata = { title: "Verificación en dos pasos" };

export default async function PlatformMfaPage({ searchParams }: PageProps<"/plataforma/verificar">) {
  const { next } = await searchParams;
  return <MfaForm action={platformVerifyMfa} switchHref={REALMS.platform.logout} next={typeof next === "string" ? next : undefined} />;
}
