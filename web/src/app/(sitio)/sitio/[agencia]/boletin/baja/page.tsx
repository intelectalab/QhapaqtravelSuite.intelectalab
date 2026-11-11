import type { Metadata } from "next";
import { UnsubscribeForm } from "@/features/site/Account";
import { AuthFrame } from "../../cuenta/AuthFrame";

export const metadata: Metadata = { title: "Darse de baja del boletín", robots: { index: false, follow: false } };

export default async function NewsletterUnsubscribePage({ searchParams }: PageProps<"/sitio/[agencia]/boletin/baja">) {
  const { token } = await searchParams;

  return (
    <AuthFrame eyebrow="Boletín" title="Darte de baja" description="Dejarás de recibir ofertas y novedades por correo. Los correos de tus reservas siguen llegando.">
      <UnsubscribeForm token={typeof token === "string" ? token : ""} />
    </AuthFrame>
  );
}
