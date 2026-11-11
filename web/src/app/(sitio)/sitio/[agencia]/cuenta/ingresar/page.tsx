import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "@/features/site/Account";
import { accountToken, siteBase } from "@/lib/server/site";
import { siteHref } from "@/lib/site";
import { AuthFrame } from "../AuthFrame";

export const metadata: Metadata = { title: "Ingresar a mi cuenta", robots: { index: false, follow: false } };

export default async function LoginPage({ params, searchParams }: PageProps<"/sitio/[agencia]/cuenta/ingresar">) {
  const { agencia } = await params;
  const query = await searchParams;
  const base = await siteBase(agencia);
  if ((await accountToken(agencia)) && query.vencida !== "1") redirect(siteHref(base, "/cuenta"));
  const notice = query.vencida === "1" ? "Tu sesión venció. Vuelve a ingresar." : query.salida === "1" ? "Cerraste sesión." : undefined;

  return (
    <AuthFrame eyebrow="Mi cuenta" title="Ingresa a tu cuenta" description="Revisa tus reservas, descarga tus vouchers y paga tu saldo." footer={{ text: "¿Aún no tienes cuenta?", label: "Créala en un minuto", href: siteHref(base, "/cuenta/registro") }}>
      <LoginForm next={typeof query.next === "string" ? query.next : undefined} notice={notice} />
      <p className="mt-5 text-[13px] text-fg-3">
        ¿Compraste sin cuenta?{" "}
        <Link href={siteHref(base, "/cuenta/mi-reserva")} className="font-semibold text-accent hover:underline">
          Gestiona tu reserva con tu correo y código
        </Link>
      </p>
      <p className="mt-2 text-[13px] text-fg-3">
        ¿Viajas en un grupo?{" "}
        <Link href={siteHref(base, "/mi-viaje")} className="font-semibold text-accent hover:underline">
          Entra a tu viaje con un enlace al correo
        </Link>
      </p>
    </AuthFrame>
  );
}
