import type { Metadata } from "next";
import { TripLinkForm } from "@/features/site/Account";
import { siteBase } from "@/lib/server/site";
import { siteHref } from "@/lib/site";
import { AuthFrame } from "../cuenta/AuthFrame";

export const metadata: Metadata = { title: "Mi viaje", robots: { index: false, follow: false } };

export default async function TripAccessPage({ params, searchParams }: PageProps<"/sitio/[agencia]/mi-viaje">) {
  const { agencia } = await params;
  const { vencido } = await searchParams;
  const base = await siteBase(agencia);

  return (
    <AuthFrame eyebrow="Portal del pasajero" title="Entra a tu viaje" description="Itinerario día a día, vouchers, avisos y contactos de emergencia. Sin contraseña: te enviamos un enlace al correo." footer={{ text: "¿Hiciste la compra y quieres ver pagos y comprobantes?", label: "Ingresa a tu cuenta", href: siteHref(base, "/cuenta/ingresar") }}>
      {vencido === "1" && <p className="mb-4 rounded-xl border border-[color-mix(in_srgb,var(--warn)_35%,transparent)] bg-[color-mix(in_srgb,var(--warn)_8%,var(--surface))] px-4 py-3 text-[13.5px] text-fg">El enlace no es válido o ya se usó. Pide uno nuevo.</p>}
      <TripLinkForm />
    </AuthFrame>
  );
}
