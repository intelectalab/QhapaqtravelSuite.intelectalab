import { CalendarRange, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import { PageHero } from "@/features/site/Hero";
import { ReviewByTokenForm } from "@/features/site/ReviewByToken";
import { readSite } from "@/lib/server/site";
import { formatDate } from "@/lib/format";
import type { ReviewInvite } from "@/lib/site";

export const metadata: Metadata = { title: "Califica tu viaje", robots: { index: false, follow: false } };

const PROBLEMS: Record<number, { title: string; text: string }> = {
  409: { title: "Ya recibimos tu opinión", text: "Este enlace es de un solo uso y ya lo utilizaste. Gracias por contarnos cómo te fue." },
  410: { title: "El enlace venció", text: "Los enlaces para opinar duran 30 días. Escríbenos y te enviamos uno nuevo." },
  403: { title: "Las reseñas no están disponibles", text: "La agencia no tiene activas las reseñas en este momento." },
};

export default async function ReviewByTokenPage({ params, searchParams }: PageProps<"/sitio/[agencia]/resena/[code]">) {
  const [{ agencia, code }, search] = await Promise.all([params, searchParams]);
  const token = typeof search.t === "string" ? search.t : "";
  const result = token ? await readSite<ReviewInvite>(agencia, `/reviews/by-token/${encodeURIComponent(code)}?t=${encodeURIComponent(token)}`) : null;
  const invite = result?.ok ? result.data : null;
  const problem = invite ? null : (PROBLEMS[result?.status ?? 0] ?? { title: "El enlace no es válido", text: "Revisa que hayas abierto el enlace completo del correo." });

  return (
    <>
      <PageHero eyebrow="Tu opinión" title={invite ? `${invite.traveler ? `${invite.traveler}, ¿cómo` : "¿Cómo"} estuvo tu viaje?` : "Califica tu viaje"} description={invite ? `Cuéntanos tu experiencia con ${invite.agency}. Toma dos minutos y ayuda a otros viajeros.` : "Comparte tu experiencia con la agencia."} />
      <div className="mx-auto grid max-w-[1240px] gap-8 px-5 pb-16 pt-10 sm:px-8 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0 animate-[rise-in_420ms_cubic-bezier(0.22,1,0.36,1)_backwards]">
          {invite ? (
            <ReviewByTokenForm invite={invite} token={token} />
          ) : (
            <div className="rounded-card border border-line bg-surface p-6 shadow-card">
              <h2 className="text-[18px] font-semibold text-fg">{problem?.title}</h2>
              <p className="mt-2 text-[14px] text-fg-2">{problem?.text}</p>
            </div>
          )}
        </div>
        {invite && (
          <aside className="grid gap-3 lg:self-start">
            <div className="lift flex gap-3 rounded-card border border-line bg-surface p-4 shadow-card">
              <span className="grid h-10 w-10 flex-none place-items-center rounded-2xl bg-[color-mix(in_srgb,var(--t1)_11%,transparent)] text-t1">
                <CalendarRange size={18} />
              </span>
              <span className="min-w-0">
                <b className="block text-[14px] font-semibold text-fg">{invite.trip.title}</b>
                <span className="text-[12.5px] text-fg-2">
                  {invite.trip.code}
                  {invite.trip.from ? ` · ${formatDate(invite.trip.from)}${invite.trip.to && invite.trip.to !== invite.trip.from ? ` al ${formatDate(invite.trip.to)}` : ""}` : ""}
                </span>
              </span>
            </div>
            <div className="lift flex gap-3 rounded-card border border-line bg-surface p-4 shadow-card">
              <span className="grid h-10 w-10 flex-none place-items-center rounded-2xl bg-[color-mix(in_srgb,var(--ok)_12%,transparent)] text-ok">
                <ShieldCheck size={18} />
              </span>
              <span>
                <b className="block text-[14px] font-semibold text-fg">Viaje verificado</b>
                <span className="text-[12.5px] leading-relaxed text-fg-2">Tu opinión proviene de una reserva real. Tú decides si se publica.</span>
              </span>
            </div>
          </aside>
        )}
      </div>
    </>
  );
}
