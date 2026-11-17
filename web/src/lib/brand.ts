export const LOGO_MARKS = ["tocapu", "kit"] as const;

export type LogoMark = (typeof LOGO_MARKS)[number];

export const DEFAULT_LOGO: LogoMark = "tocapu";

export const isLogoMark = (value: unknown): value is LogoMark => typeof value === "string" && (LOGO_MARKS as readonly string[]).includes(value);

export const logoIcon = (mark: LogoMark) => `/marca/${mark}.svg`;

export interface LogoOption {
  value: LogoMark;
  label: string;
  hint: string;
}

export interface LogoOverview {
  current: LogoMark;
  options: LogoOption[];
}
