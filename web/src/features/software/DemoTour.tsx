"use client";

import { ArrowRight, CalendarCheck, ChevronLeft, ChevronRight, FileText, MessageCircle, Pause, Play, PlayCircle, Receipt, Route, X, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { contactHref } from "@/lib/software";
import { type Tone, toneStyle } from "@/lib/tone";

const OPEN_EVENT = "kipu:demo";
const STEP_MS = 30_000;

interface TourStep {
  icon: LucideIcon;
  tone: Tone;
  label: string;
  title: string;
  text: string;
  rows: { label: string; value: string; state?: "ok" | "warn" }[];
  highlight: { label: string; value: string };
}

const STEPS: TourStep[] = [
  {
    icon: MessageCircle,
    tone: "t1",
    label: "Captar",
    title: "Cada consulta entra como lead y nadie la pierde",
    text: "WhatsApp, el formulario de tu web y el correo llegan a una sola bandeja. KipuControl asigna al asesor de turno y agenda el primer contacto.",
    rows: [
      { label: "Rosa H. · Cusco 5D/4N · 4 pax", value: "Nuevo", state: "warn" },
      { label: "Luis C. · Salkantay · 2 pax", value: "Calificado", state: "ok" },
      { label: "Ana P. · Lima gastronómica", value: "Cotizado", state: "ok" },
    ],
    highlight: { label: "Tiempo de primera respuesta", value: "12 min" },
  },
  {
    icon: FileText,
    tone: "t3",
    label: "Cotizar",
    title: "La propuesta sale en minutos, con el margen a la vista",
    text: "El cotizador toma tus tarifas vigentes, aplica el IGV que corresponde y avisa si un descuento baja el margen mínimo de tu agencia.",
    rows: [
      { label: "Tren Vistadome ida y vuelta", value: "USD 177,50" },
      { label: "Guía oficial bilingüe", value: "USD 47,25" },
      { label: "Hotel boutique, 4 noches", value: "USD 442,00" },
    ],
    highlight: { label: "Total por pasajero · margen 29,4 %", value: "USD 845" },
  },
  {
    icon: Route,
    tone: "t4",
    label: "Operar",
    title: "La reserva confirmada arma la operación del día",
    text: "Cupos, pasajeros, guía y vehículo quedan en la orden de servicio. El guía la ve en su teléfono, incluso sin señal.",
    rows: [
      { label: "Salida 06:10 · Hotel Casa Andina", value: "Guía asignado", state: "ok" },
      { label: "Tren 07:45 Ollantaytambo", value: "4 boletos", state: "ok" },
      { label: "Ingreso Machu Picchu circuito 2", value: "Por emitir", state: "warn" },
    ],
    highlight: { label: "Servicios de hoy", value: "18" },
  },
  {
    icon: Receipt,
    tone: "t2",
    label: "Cobrar",
    title: "Cobras en soles o dólares y el comprobante sale solo",
    text: "Enlace de pago con tarjeta, Yape o transferencia. Al confirmar el pago se emite la boleta o factura y se actualiza la cuenta por cobrar.",
    rows: [
      { label: "Anticipo 40 % · tarjeta", value: "Pagado", state: "ok" },
      { label: "Factura F001-4291", value: "Aceptada", state: "ok" },
      { label: "Saldo a 15 días del viaje", value: "Programado" },
    ],
    highlight: { label: "Cobrado este mes", value: "S/ 148 250" },
  },
];

export function openDemoTour() {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

export function DemoTourButton({ className, label = "Ver recorrido de 2 min", tone = "light" }: { className?: string; label?: string; tone?: "light" | "dark" }) {
  return (
    <button type="button" onClick={openDemoTour} className={cn("group inline-flex h-12 items-center gap-2 rounded-control px-4 text-[14.5px] font-semibold transition", tone === "dark" ? "text-white/85 hover:bg-white/10 hover:text-white" : "text-fg-2 hover:bg-surface-2 hover:text-fg", className)}>
      <PlayCircle size={18} className="transition-transform duration-300 group-hover:scale-110" />
      {label}
    </button>
  );
}

function StepMock({ step }: { step: TourStep }) {
  return (
    <div style={toneStyle(step.tone)} className="rounded-[18px] border border-line bg-surface p-4 shadow-[var(--shadow-card)]">
      <ul className="grid gap-1.5">
        {step.rows.map((row, index) => (
          <li key={row.label} style={{ animationDelay: `${120 + index * 110}ms` }} className="flex items-center justify-between gap-3 rounded-[10px] px-2.5 py-2 text-[13px] transition hover:bg-surface-2 animate-[rise-in_420ms_cubic-bezier(0.22,1,0.36,1)_backwards]">
            <span className="min-w-0 truncate text-fg-2">{row.label}</span>
            <span className={cn("flex-none font-semibold", row.state === "ok" ? "text-ok" : row.state === "warn" ? "text-warn" : "font-mono text-fg")}>{row.value}</span>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex items-end justify-between gap-3 rounded-[14px] bg-[color-mix(in_srgb,var(--tint)_12%,var(--surface))] px-4 py-3">
        <span className="text-[12px] text-fg-2">{step.highlight.label}</span>
        <b className="font-mono text-[22px] tracking-tight text-[var(--tint)]">{step.highlight.value}</b>
      </div>
    </div>
  );
}

interface TourPosition {
  index: number;
  elapsed: number;
  finished: boolean;
}

const START: TourPosition = { index: 0, elapsed: 0, finished: false };

function advance(position: TourPosition, step: number): TourPosition {
  if (position.finished) return position;
  const elapsed = position.elapsed + step;
  if (elapsed < STEP_MS) return { ...position, elapsed };
  return position.index < STEPS.length - 1 ? { index: position.index + 1, elapsed: 0, finished: false } : { ...position, elapsed: STEP_MS, finished: true };
}

export function DemoTour() {
  const [manual, setManual] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [position, setPosition] = useState<TourPosition>(START);
  const [held, setHeld] = useState(false);
  const lastFocus = useRef<HTMLElement | null>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const open = manual || (params.get("demo") === "1" && !dismissed);
  const { index, elapsed } = position;
  const paused = held || position.finished;

  const start = useCallback(() => {
    lastFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setPosition(START);
    setHeld(false);
    setManual(true);
  }, []);

  const close = useCallback(() => {
    setManual(false);
    setDismissed(true);
    lastFocus.current?.focus();
    if (params.get("demo") === "1") router.replace(pathname, { scroll: false });
  }, [params, pathname, router]);

  const go = useCallback((next: number) => {
    setPosition({ index: Math.max(0, Math.min(STEPS.length - 1, next)), elapsed: 0, finished: false });
  }, []);

  const setPaused = useCallback((update: (value: boolean) => boolean) => {
    if (position.finished) {
      setPosition(START);
      setHeld(false);
      return;
    }
    setHeld(update);
  }, [position.finished]);

  useEffect(() => {
    window.addEventListener(OPEN_EVENT, start);
    return () => window.removeEventListener(OPEN_EVENT, start);
  }, [start]);

  useEffect(() => {
    if (!open || paused) return;
    const tick = window.setInterval(() => setPosition((current) => advance(current, 250)), 250);
    return () => window.clearInterval(tick);
  }, [open, paused]);

  useEffect(() => {
    if (open) closeButton.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
      if (event.key === "ArrowRight") go(index + 1);
      if (event.key === "ArrowLeft") go(index - 1);
      if (event.key === " ") {
        event.preventDefault();
        setPaused((value) => !value);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, index, close, go, setPaused]);

  if (!open) return null;
  const step = STEPS[index] ?? STEPS[0]!;
  const last = index === STEPS.length - 1;
  const remaining = Math.ceil(((STEPS.length - index) * STEP_MS - elapsed) / 1000);

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-[rgb(14_17_32/0.6)] p-4 backdrop-blur-sm animate-[fade-in_240ms_ease-out_backwards]" onMouseDown={(event) => event.target === event.currentTarget && close()}>
      <div role="dialog" aria-modal aria-labelledby="demo-title" className="relative isolate w-[min(880px,100%)] overflow-hidden rounded-[28px] border border-line bg-bg shadow-[0_40px_100px_-40px_rgb(14_17_32/0.7)] animate-[rise-in_520ms_cubic-bezier(0.22,1,0.36,1)_backwards]">
        <span aria-hidden className="ambient-glow absolute inset-0 -z-10" />
        <div className="flex items-center gap-2 px-5 pt-5 sm:px-7">
          {STEPS.map((item, position) => (
            <button key={item.label} type="button" onClick={() => go(position)} aria-label={`Paso ${position + 1}: ${item.label}`} className="group h-6 flex-1">
              <span className="block h-1.5 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--fg-3)_22%,transparent)] transition group-hover:h-2">
                <span className="weave-line block h-full origin-left rounded-full" style={{ transform: `scaleX(${position < index ? 1 : position === index ? elapsed / STEP_MS : 0})` }} />
              </span>
            </button>
          ))}
          <button ref={closeButton} type="button" onClick={close} aria-label="Cerrar recorrido" className="ml-2 grid h-9 w-9 flex-none place-items-center rounded-full text-fg-3 transition hover:rotate-90 hover:bg-surface-2 hover:text-fg">
            <X size={18} />
          </button>
        </div>
        <div key={step.label} className="grid gap-8 px-5 pb-6 pt-4 sm:px-7 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:items-center">
          <div className="animate-[rise-in_460ms_cubic-bezier(0.22,1,0.36,1)_backwards]" style={toneStyle(step.tone)}>
            <span className="inline-flex items-center gap-2 rounded-full bg-[color-mix(in_srgb,var(--tint)_13%,transparent)] px-3 py-1 text-[12px] font-semibold text-[var(--tint)]">
              <step.icon size={14} />
              {String(index + 1).padStart(2, "0")} · {step.label}
            </span>
            <h2 id="demo-title" className="site-display mt-4 text-[26px] font-bold leading-[1.1] tracking-[-0.03em] text-fg sm:text-[32px]">
              {step.title}
            </h2>
            <p className="mt-3 text-[15px] leading-relaxed text-fg-2">{step.text}</p>
          </div>
          <StepMock step={step} />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-surface px-5 py-4 sm:px-7">
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => go(index - 1)} disabled={index === 0} aria-label="Paso anterior" className="grid h-10 w-10 place-items-center rounded-full text-fg-2 transition hover:bg-surface-2 hover:text-fg disabled:opacity-40">
              <ChevronLeft size={18} />
            </button>
            <button type="button" onClick={() => setPaused((value) => !value)} aria-label={paused ? "Continuar" : "Pausar"} className="grid h-10 w-10 place-items-center rounded-full text-fg-2 transition hover:bg-surface-2 hover:text-fg">
              {paused ? <Play size={17} /> : <Pause size={17} />}
            </button>
            <button type="button" onClick={() => go(index + 1)} disabled={last} aria-label="Paso siguiente" className="grid h-10 w-10 place-items-center rounded-full text-fg-2 transition hover:bg-surface-2 hover:text-fg disabled:opacity-40">
              <ChevronRight size={18} />
            </button>
            <span className="ml-2 font-mono text-[12px] text-fg-3">{Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, "0")}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={contactHref("demo")} onClick={close} className="inline-flex h-10 items-center gap-1.5 rounded-control px-3.5 text-[13.5px] font-semibold text-fg-2 transition hover:bg-surface-2 hover:text-fg">
              <CalendarCheck size={16} />
              Agendar demo con una persona
            </Link>
            <Button href="/software/suscribirse?ciclo=prueba" variant="primary" icon={<ArrowRight size={16} />}>
              Probar gratis
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
