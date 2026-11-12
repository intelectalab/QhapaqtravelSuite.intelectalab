export const colors = {
  bg: "#F3F5F9",
  surface: "#FFFFFF",
  surface2: "#F7F9FC",
  surface3: "#EEF2F8",
  fg: "#15202E",
  fg2: "#4A5568",
  fg3: "#8792A2",
  line: "#E4E8EF",
  side: "#0A3A73",
  accent: "#0A3A73",
  accent2: "#11509A",
  accentSoft: "#EAF3FC",
  link: "#1F6FB8",
  sun: "#F4B400",
  sunSoft: "#FFF6D6",
  sunFg: "#2B1F00",
  ok: "#22A55A",
  okSoft: "#E4F6EB",
  warn: "#D98A0B",
  warnSoft: "#FFF4DB",
  bad: "#E5484D",
  badSoft: "#FDECEC",
  info: "#2F80D1",
  infoSoft: "#EAF3FC",
  white: "#FFFFFF",
} as const;

export type Tone = "ok" | "warn" | "bad" | "info" | "mute" | "sun";

export const tones: Record<Tone, { fg: string; bg: string }> = {
  ok: { fg: colors.ok, bg: colors.okSoft },
  warn: { fg: colors.warn, bg: colors.warnSoft },
  bad: { fg: colors.bad, bg: colors.badSoft },
  info: { fg: colors.info, bg: colors.infoSoft },
  mute: { fg: colors.fg2, bg: colors.surface3 },
  sun: { fg: colors.sunFg, bg: colors.sunSoft },
};

export const radius = { card: 16, control: 12, pill: 999 } as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 } as const;

export const font = { title: 22, h2: 17, body: 15, small: 13, tiny: 11.5 } as const;
