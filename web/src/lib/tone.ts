import tokens from "@/design/tokens.json";

export type Tone = "ok" | "warn" | "bad" | "info" | "accent" | "violet" | "sun" | "mute" | "t1" | "t2" | "t3" | "t4" | "brand";

const TONE_VAR: Record<Tone, string> = {
  ok: "var(--ok)",
  warn: "var(--warn)",
  bad: "var(--bad)",
  info: "var(--info)",
  accent: "var(--accent)",
  violet: "var(--violet)",
  sun: "color-mix(in srgb, var(--t2) 70%, var(--fg))",
  mute: "var(--fg-3)",
  t1: "var(--t1)",
  t2: "color-mix(in srgb, var(--t2) 70%, var(--fg))",
  t3: "var(--t3)",
  t4: "var(--t4)",
  brand: "var(--brand)",
};

export function toneColor(tone: Tone): string {
  return TONE_VAR[tone];
}

export function toneStyle(tone: Tone): React.CSSProperties {
  return { ["--tint" as string]: TONE_VAR[tone] };
}

const statusMap = tokens.status.map as Record<string, string>;
const statusLabels = tokens.status.labels as Record<string, string>;

export function statusTone(status: string): Tone {
  return (statusMap[status] as Tone | undefined) ?? "mute";
}

export function statusLabel(status: string): string {
  return statusLabels[status] ?? status;
}

const AVATAR_TONES: Tone[] = ["t1", "t4", "t3", "t2", "accent", "violet"];

export function avatarTone(seed: string): Tone {
  const sum = [...seed].reduce((total, char) => total + char.charCodeAt(0), 0);
  return AVATAR_TONES[sum % AVATAR_TONES.length];
}
