import { CalendarCheck, CloudOff, Headset, MessagesSquare } from "lucide-react";
import type { Metadata } from "next";
import { EmptyState } from "@/components/ui/EmptyState";
import { getDemoOptions, getPlansCatalog } from "@/features/software/data";
import { DemoForm } from "@/features/software/DemoForm";
import { Eyebrow } from "@/features/software/Section";
import { formatMoney } from "@/lib/format";
import { trialDays } from "@/lib/software";
import { toneStyle, type Tone } from "@/lib/tone";
import { requestDemo } from "./actions";

export const metadata: Metadata = {
  title: "Solicitar demo",
  description: "Solicita una demo de KipuControl o empieza tu prueba gratuita para tu agencia de viajes.",
};

export default async function ContactoPage({ searchParams }: PageProps<"/software/contacto">) {
  const [{ tipo, plan, ciclo }, options, catalog] = await Promise.all([searchParams, getDemoOptions(), getPlansCatalog()]);
  const days = catalog ? trialDays(catalog.plans) : 0;
  const entry = catalog?.plans[0];
  const planCode = typeof plan === "string" && options?.plans.some((item) => item.code === plan) ? plan : undefined;

  const steps: { icon: typeof Headset; tone: Tone; title: string; text: string }[] = [
    { icon: MessagesSquare, tone: "t3", title: "Te escribimos", text: "Un asesor revisa tu solicitud y te contacta en menos de un día hábil." },
    { icon: Headset, tone: "t1", title: "Conocemos tu operación", text: "Vemos cómo vendes, operas y cobras hoy para mostrarte lo que te ahorra tiempo." },
    { icon: CalendarCheck, tone: "t4", title: "Pruebas con tu equipo", text: days > 0 ? `Activamos tu espacio con ${days} días de prueba${entry ? `; después, desde ${formatMoney(entry.price_month, entry.currency)} al mes` : ""}.` : "Activamos tu espacio para que pruebes con tu equipo." },
  ];

  return (
    <section className="relative isolate overflow-hidden">
      <span aria-hidden className="ambient-glow absolute inset-0 -z-10" />
      <div className="mx-auto grid max-w-[1200px] gap-12 px-5 py-14 sm:px-8 sm:py-20 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        <div className="animate-[rise-in_620ms_cubic-bezier(0.22,1,0.36,1)_backwards] lg:sticky lg:top-28 lg:self-start">
          <Eyebrow>Contacto</Eyebrow>
          <h1 className="site-display mt-5 text-[36px] font-bold leading-[1.04] tracking-[-0.045em] text-fg sm:text-[50px]">Veamos KipuControl con tu propia operación.</h1>
          <p className="mt-5 text-[16px] leading-relaxed text-fg-2 sm:text-[17px]">Pide una demo guiada o empieza tu prueba. Sin tarjeta y sin compromiso.</p>
          <ol className="mt-10 grid gap-3">
            {steps.map((step, index) => (
              <li key={step.title} style={{ ...toneStyle(step.tone), animationDelay: `${180 + index * 90}ms` }} className="lift group flex gap-4 rounded-[18px] border border-line bg-surface p-4 animate-[rise-in_520ms_cubic-bezier(0.22,1,0.36,1)_backwards]">
                <span className="relative grid h-11 w-11 flex-none place-items-center rounded-[13px] bg-[var(--tint)] text-white shadow-[0_10px_20px_-12px_var(--tint)] transition-transform duration-300 group-hover:-rotate-6">
                  <step.icon size={19} />
                </span>
                <span>
                  <span className="block text-[12px] font-semibold text-[var(--tint)]">Paso {index + 1}</span>
                  <span className="block text-[15px] font-bold text-fg">{step.title}</span>
                  <span className="mt-1 block text-[13.5px] leading-relaxed text-fg-2">{step.text}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
        <div className="relative overflow-hidden rounded-[24px] border border-line bg-surface p-5 shadow-[0_40px_80px_-50px_rgb(14_17_32/0.5)] animate-[rise-in_720ms_cubic-bezier(0.22,1,0.36,1)_backwards] [animation-delay:120ms] sm:p-8">
          <span aria-hidden className="weave-band absolute inset-x-0 top-0 h-1.5" />
          {options ? (
            <DemoForm options={options} action={requestDemo} initialKind={tipo === "prueba" ? "trial" : "demo"} initialPlan={planCode} initialCycle={ciclo === "anual" ? "year" : "month"} />
          ) : (
            <EmptyState icon={<CloudOff size={22} />} title="El formulario no está disponible" description="Vuelve a intentarlo en unos segundos." />
          )}
        </div>
      </div>
    </section>
  );
}
