/**
 * Chip de estado (COMPONENTES.md «UI.badge / statusLabel»; SELECTORES.md `status-badge` + `data-status`).
 *
 *   <StatusBadge status={reservation.status} label={reservation.status_label} />
 *
 * - Color: `toneFor(status)` del preset (kit-ia/design/tailwind.preset.ts → statusTone, mismo valor que los CHECK).
 * - Texto: `status_label` de la API o, si no viene, la etiqueta de kit-ia/design/tokens.json → status.labels.
 * - Punto de color + texto (no depender solo del color: accesibilidad AA).
 * - `data-status` lleva el valor de DOMINIO (no el texto traducido): Playwright lo lee.
 */
import tokens from "@/design/tokens.json";
import { toneFor, type Tone } from "@/design/tailwind.preset";

const LABELS: Record<string, string> = tokens.status.labels;

const TONE_CLASSES: Record<Tone, string> = {
  ok: "bg-ok-soft text-ok",
  warn: "bg-warn-soft text-warn",
  bad: "bg-bad-soft text-bad",
  info: "bg-info-soft text-info",
  accent: "bg-accent-soft text-accent",
  violet: "bg-violet-soft text-violet",
  sun: "bg-sun-soft text-sun-fg",
  mute: "bg-mute-soft text-fg-2",
};

const DOT_CLASSES: Record<Tone, string> = {
  ok: "bg-ok",
  warn: "bg-warn",
  bad: "bg-bad",
  info: "bg-info",
  accent: "bg-accent",
  violet: "bg-violet",
  sun: "bg-sun",
  mute: "bg-fg-3",
};

type Props = {
  status: string;
  label?: string | null;
  size?: "sm" | "md";
  testId?: string;
  className?: string;
};

export function StatusBadge({ status, label, size = "md", testId = "status-badge", className = "" }: Props) {
  const tone = toneFor(status);
  const text = label ?? LABELS[status] ?? humanize(status);
  return (
    <span
      data-testid={testId}
      data-status={status}
      className={[
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-pill font-semibold",
        size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs",
        TONE_CLASSES[tone],
        className,
      ].join(" ")}
    >
      <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${DOT_CLASSES[tone]}`} />
      {text}
    </span>
  );
}

/** Último respaldo (estado sin etiqueta en tokens.json): «pendiente_pago» → «Pendiente pago». */
function humanize(status: string): string {
  const s = status.replace(/_/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}
