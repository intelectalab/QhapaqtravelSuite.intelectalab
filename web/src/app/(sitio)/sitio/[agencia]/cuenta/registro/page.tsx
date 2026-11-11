import type { Metadata } from "next";
import { RegisterForm } from "@/features/site/Account";
import { siteBase } from "@/lib/server/site";
import { siteHref } from "@/lib/site";
import { AuthFrame } from "../AuthFrame";

export const metadata: Metadata = { title: "Crear mi cuenta", robots: { index: false, follow: false } };

export default async function RegisterPage({ params }: PageProps<"/sitio/[agencia]/cuenta/registro">) {
  const { agencia } = await params;
  const base = await siteBase(agencia);

  return (
    <AuthFrame eyebrow="Mi cuenta" title="Crea tu cuenta" description="Guarda tus tours favoritos y ten tus viajes, vouchers y pagos a la mano." footer={{ text: "¿Ya tienes cuenta?", label: "Ingresa aquí", href: siteHref(base, "/cuenta/ingresar") }}>
      <RegisterForm />
    </AuthFrame>
  );
}
