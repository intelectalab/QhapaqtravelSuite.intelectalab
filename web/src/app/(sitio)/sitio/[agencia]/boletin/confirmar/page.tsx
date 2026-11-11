import { CheckCircle2, CircleAlert } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { readSite, siteBase } from "@/lib/server/site";
import { siteHref } from "@/lib/site";
import { AuthFrame } from "../../cuenta/AuthFrame";

export const metadata: Metadata = { title: "Confirmar suscripción", robots: { index: false, follow: false } };

export default async function NewsletterConfirmPage({ params, searchParams }: PageProps<"/sitio/[agencia]/boletin/confirmar">) {
  const { agencia } = await params;
  const { token } = await searchParams;
  const base = await siteBase(agencia);
  const result = typeof token === "string" && token !== "" ? await readSite<{ email: string }>(agencia, `/newsletter/confirm/${encodeURIComponent(token)}`) : null;
  const ok = result?.ok === true;

  return (
    <AuthFrame eyebrow="Boletín" title={ok ? "Suscripción confirmada" : "No pudimos confirmar tu suscripción"} description={ok ? "Te enviaremos ofertas y novedades de viaje." : "El enlace no es válido o la suscripción ya se dio de baja."}>
      <div className="flex items-start gap-3">
        {ok ? <CheckCircle2 size={26} className="flex-none text-ok" /> : <CircleAlert size={26} className="flex-none text-bad" />}
        <div className="text-[14px] leading-relaxed text-fg-2">
          <p>{ok ? `Confirmamos ${result?.data?.email}.` : (result?.error?.message ?? "Abre el enlace completo que te enviamos por correo.")}</p>
          <Link href={siteHref(base, "/tours")} className="mt-4 inline-flex h-11 items-center rounded-control bg-brand px-5 text-[14px] font-semibold text-brand-fg transition hover:brightness-110">
            Ver tours
          </Link>
        </div>
      </div>
    </AuthFrame>
  );
}
