import type { Metadata } from "next";
import { ForgotForm } from "@/features/site/Account";
import { siteBase } from "@/lib/server/site";
import { siteHref } from "@/lib/site";
import { AuthFrame } from "../AuthFrame";

export const metadata: Metadata = { title: "Recuperar mi contraseña", robots: { index: false, follow: false } };

export default async function ForgotPage({ params }: PageProps<"/sitio/[agencia]/cuenta/recuperar">) {
  const { agencia } = await params;
  const base = await siteBase(agencia);

  return (
    <AuthFrame eyebrow="Mi cuenta" title="Recupera tu contraseña" description="Te enviamos un enlace para crear una contraseña nueva." footer={{ text: "¿La recordaste?", label: "Volver a ingresar", href: siteHref(base, "/cuenta/ingresar") }}>
      <ForgotForm />
    </AuthFrame>
  );
}
