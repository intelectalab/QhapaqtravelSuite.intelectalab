import { ArrowRight, CalendarCheck, LayoutDashboard, LogIn } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { FUNNEL_STEPS, contactHref } from "@/lib/software";
import { toneStyle } from "@/lib/tone";
import { Reveal } from "./Reveal";
import { Eyebrow } from "./Section";

export interface HeroStat {
  value: ReactNode;
  label: string;
}

export function HomeHero({ signedIn, stats, preview }: { signedIn: boolean; stats: HeroStat[]; preview: ReactNode }) {
  return (
    <section className="relative isolate overflow-hidden">
      <span aria-hidden className="ambient-glow absolute inset-0 -z-10" />
      <span aria-hidden className="weave-fade absolute inset-y-0 right-0 -z-10 hidden w-2/3 lg:block">
        <span className="weave-tint absolute inset-0 opacity-[0.06] [mask-size:36px_36px]" />
      </span>
      <div className="mx-auto grid max-w-[1200px] items-center gap-14 px-5 pb-20 pt-12 sm:px-8 sm:pt-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:pb-28 lg:pt-20">
        <div className="animate-[rise-in_640ms_cubic-bezier(0.22,1,0.36,1)_backwards]">
          <Eyebrow>Software para agencias de viaje del Perú</Eyebrow>
          <h1 className="site-display mt-6 text-[40px] font-bold leading-[1.02] tracking-[-0.05em] text-fg sm:text-[60px]">
            Del primer mensaje
            <br />
            al viaje <span className="relative whitespace-nowrap text-t3">cobrado<span aria-hidden className="weave-line absolute -bottom-1 left-0 h-[5px] w-full origin-left rounded-full motion-safe:animate-[fill-x_900ms_cubic-bezier(0.22,1,0.36,1)_600ms_backwards]" /></span>.
          </h1>
          <p className="mt-6 max-w-xl text-[16.5px] leading-relaxed text-fg-2 sm:text-[18px]">Leads, cotizaciones, reservas, operación y cobranza en un solo sistema. Tu equipo deja las hojas de cálculo y cada viaje avanza con la información al día.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button href={contactHref("demo")} variant="primary" icon={<ArrowRight size={16} />} className="site-sheen relative h-12 overflow-hidden px-6 text-[14.5px]">
              Solicitar demo
            </Button>
            <Button href="/software/planes" variant="secondary" className="h-12 px-6 text-[14.5px]">
              Ver planes y precios
            </Button>
            <Button href={signedIn ? "/dashboard" : "/login"} variant="ghost" icon={signedIn ? <LayoutDashboard size={16} /> : <LogIn size={16} />} className="h-12 px-4 text-[14.5px]">
              {signedIn ? "Ir a mi panel" : "Ingresar"}
            </Button>
          </div>
          {stats.length > 0 && (
            <dl className="mt-10 grid max-w-xl grid-cols-3 gap-3">
              {stats.map((stat, index) => (
                <div key={stat.label} style={{ animationDelay: `${260 + index * 90}ms` }} className="group cursor-default border-l-2 border-line pl-3.5 transition-colors duration-300 hover:border-t3 animate-[rise-in_520ms_cubic-bezier(0.22,1,0.36,1)_backwards]">
                  <dt className="sr-only">{stat.label}</dt>
                  <dd className="font-mono text-[26px] font-bold leading-none tracking-tight text-fg transition-transform duration-300 group-hover:-translate-y-0.5 sm:text-[30px]">{stat.value}</dd>
                  <dd className="mt-1.5 text-[12.5px] leading-snug text-fg-3">{stat.label}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
        <div className="animate-[rise-in_760ms_cubic-bezier(0.22,1,0.36,1)_backwards] [animation-delay:160ms]">{preview}</div>
      </div>
    </section>
  );
}

export function Journey() {
  return (
    <ol className="relative grid gap-4 sm:grid-cols-2 lg:grid-cols-6 lg:gap-3">
      <span aria-hidden className="weave-line site-weave-run absolute left-[8%] right-[8%] top-[27px] hidden h-[3px] rounded-full bg-[length:176px_100%] opacity-70 lg:block" />
      {FUNNEL_STEPS.map((step, index) => (
        <Reveal as="li" key={step.key} delay={index * 90} className="relative">
          <div style={toneStyle(step.tone)} className="lift group flex h-full flex-col rounded-[18px] border border-line bg-surface p-4 hover:border-[color-mix(in_srgb,var(--tint)_45%,transparent)]">
            <span className="relative grid h-[52px] w-[52px] place-items-center rounded-[16px] bg-[var(--tint)] text-white shadow-[0_12px_24px_-12px_var(--tint)] ring-4 ring-bg transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-105">
              <span aria-hidden className="weave-pattern absolute inset-0 rounded-[16px] bg-[length:16px_16px] opacity-[0.14]" />
              <step.icon size={22} className="relative" />
            </span>
            <p className="mt-4 text-[11.5px] font-semibold tracking-[0.08em] text-[var(--tint)]">
              {String(index + 1).padStart(2, "0")} · {step.stage}
            </p>
            <h3 className="mt-1 text-[15.5px] font-bold tracking-tight text-fg">{step.label}</h3>
            <p className="mt-2 flex-1 text-[13px] leading-relaxed text-fg-2">{step.text}</p>
          </div>
        </Reveal>
      ))}
    </ol>
  );
}

export function CallToAction({ days, title, description }: { days: number; title?: string; description?: string }) {
  return (
    <section className="px-5 pb-20 sm:px-8 sm:pb-28">
      <Reveal className="mx-auto max-w-[1200px]">
        <div className="relative isolate overflow-hidden rounded-[28px] bg-menu px-6 py-14 text-white sm:px-14 sm:py-16">
          <span aria-hidden className="weave-band site-weave-run absolute inset-x-0 top-0 h-2 bg-[length:112px_100%]" />
          <span aria-hidden className="weave-tint absolute inset-0 -z-10 bg-white opacity-[0.05] [mask-size:36px_36px]" />
          <span aria-hidden className="absolute -right-24 -top-24 -z-10 h-96 w-96 rounded-full bg-t3 opacity-40 blur-[120px]" />
          <span aria-hidden className="absolute -bottom-32 left-10 -z-10 h-80 w-80 rounded-full bg-t1 opacity-50 blur-[120px]" />
          <div className="flex flex-wrap items-end justify-between gap-8">
            <div className="max-w-2xl">
              <Eyebrow inverted>Empieza esta semana</Eyebrow>
              <h2 className="site-display mt-4 text-[30px] font-bold leading-[1.08] tracking-[-0.035em] sm:text-[42px]">{title ?? `Prueba KipuControl ${days} días con tu propio equipo.`}</h2>
              <p className="mt-4 text-[15.5px] leading-relaxed text-white/65 sm:text-[17px]">{description ?? "Te mostramos el sistema con un recorrido de tu operación real y dejamos tu espacio listo para empezar."}</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button href={contactHref("trial")} variant="primary" icon={<CalendarCheck size={16} />} className="site-sheen relative h-12 overflow-hidden px-6 text-[14.5px]">
                Empezar prueba
              </Button>
              <Button href={contactHref("demo")} className={cn("h-12 border-white/20 bg-white/10 px-6 text-[14.5px] text-white hover:bg-white/20")}>
                Solicitar demo
              </Button>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
