import { CheckCircle2, CircleAlert } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { sendSite, siteBase } from "@/lib/server/site";
import { siteHref } from "@/lib/site";
import { AuthFrame } from "../AuthFrame";

export const metadata: Metadata = { title: "Verificar mi correo", robots: { index: false, follow: false } };

export default async function VerifyPage({ params, searchParams }: PageProps<"/sitio/[agencia]/cuenta/verificar">) {
  const { agencia } = await params;
  const query = await searchParams;
  const base = await siteBase(agencia);
  const email = typeof query.email === "string" ? query.email : "";
  const token = typeof query.token === "string" ? query.token : "";
  const result = email && token ? await sendSite<{ email: string }>(agencia, "/auth/email/verify", { email, token }) : null;
  const ok = result?.ok === true;

  return (
    <AuthFrame eyebrow="Mi cuenta" title={ok ? "Correo verificado" : "No pudimos verificar tu correo"} description={ok ? "Gracias. Tu cuenta quedó lista." : "El enlace no es válido o está incompleto."}>
      <div className="flex items-start gap-3">
        {ok ? <CheckCircle2 size={26} className="flex-none text-ok" /> : <CircleAlert size={26} className="flex-none text-bad" />}
        <div className="text-[14px] leading-relaxed text-fg-2">
          <p>{ok ? `Confirmamos ${result?.data?.email ?? email}.` : (result?.error?.message ?? "Abre el enlace completo que te enviamos por correo.")}</p>
          <Link href={siteHref(base, "/cuenta")} className="mt-4 inline-flex h-11 items-center rounded-control bg-brand px-5 text-[14px] font-semibold text-brand-fg transition hover:brightness-110">
            Ir a mi cuenta
          </Link>
        </div>
      </div>
    </AuthFrame>
  );
}
