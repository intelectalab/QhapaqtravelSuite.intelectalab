import { Eye, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type Tone = "view" | "edit" | "delete" | "neutral";

const TONES: Record<Tone, string> = {
  view: "bg-accent/10 text-accent",
  edit: "bg-[color-mix(in_srgb,var(--violet)_12%,transparent)] text-[var(--violet)]",
  delete: "bg-[color-mix(in_srgb,var(--bad)_10%,transparent)] text-bad",
  neutral: "bg-surface-2 text-fg-2",
};

const ICONS: Record<Tone, ReactNode> = {
  view: <Eye size={16} />,
  edit: <Pencil size={15} />,
  delete: <Trash2 size={15} />,
  neutral: null,
};

const BASE = "grid h-8 w-8 flex-none place-items-center rounded-[9px] transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]";

interface RowIconProps {
  tone: Tone;
  label: string;
  href?: string;
  onClick?: () => void;
  disabledHint?: string;
  icon?: ReactNode;
  testId?: string;
}

export function RowIcon({ tone, label, href, onClick, disabledHint, icon, testId }: RowIconProps) {
  const glyph = icon ?? ICONS[tone];
  if (disabledHint) {
    return (
      <span title={disabledHint} aria-label={disabledHint} data-testid={testId} className={cn(BASE, "cursor-not-allowed bg-surface-2 text-fg-3 opacity-60")}>
        {glyph}
      </span>
    );
  }
  const className = cn(BASE, TONES[tone], "hover:-translate-y-0.5 hover:scale-110");
  if (href) {
    return (
      <Link href={href} aria-label={label} title={label} data-testid={testId} className={className}>
        {glyph}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label} data-testid={testId} className={className}>
      {glyph}
    </button>
  );
}

export function RowActions({ children }: { children: ReactNode }) {
  return <div className="ml-auto flex items-center justify-end gap-1.5">{children}</div>;
}
