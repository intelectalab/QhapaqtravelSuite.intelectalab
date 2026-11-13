import { CalendarX2 } from "lucide-react";
import type { Metadata } from "next";
import { CancelForm } from "@/features/rutas-libres/Forms";
import { rlBase } from "@/lib/server/rutas-libres";

export const metadata: Metadata = { title: "Cancelar reserva", robots: { index: false, follow: false } };

export default async function CancelPage({ params }: PageProps<"/vitrina/cancelar/[token]">) {
  const { token } = await params;
  const base = await rlBase();
  return (
    <section className="rl-wrap pt-16">
      <div className="rl-panel mx-auto max-w-[620px] p-8 sm:p-10">
        <span className="grid h-12 w-12 place-items-center rounded-full bg-[var(--rl-coral-soft)] text-[var(--rl-coral)]"><CalendarX2 size={24} /></span>
        <h1 className="rl-h2 mt-5">¿Cancelar su reserva?</h1>
        <p className="rl-muted mt-3 text-[15px]">Si ya no puede asistir, cancelar libera su cupo para otro viajero. No hay penalidad y puede volver a reservar cuando quiera.</p>
        <div className="mt-7"><CancelForm token={token} base={base} /></div>
      </div>
    </section>
  );
}
