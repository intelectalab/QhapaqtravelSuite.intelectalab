import type { Metadata } from "next";
import { LookupForm } from "@/features/site/Account";
import { siteBase } from "@/lib/server/site";
import { siteHref } from "@/lib/site";
import { AuthFrame } from "../AuthFrame";

export const metadata: Metadata = { title: "Gestionar mi reserva", robots: { index: false, follow: false } };

export default async function LookupPage({ params }: PageProps<"/sitio/[agencia]/cuenta/mi-reserva">) {
  const { agencia } = await params;
  const base = await siteBase(agencia);

  return (
    <AuthFrame eyebrow="Gestionar mi reserva" title="Encuentra tu compra" description="Sin cuenta: escribe el correo con el que compraste y el código que te enviamos." footer={{ text: "¿Prefieres ver todas tus compras?", label: "Ingresa a tu cuenta", href: siteHref(base, "/cuenta/ingresar") }}>
      <LookupForm />
    </AuthFrame>
  );
}
