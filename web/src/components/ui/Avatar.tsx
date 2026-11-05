import { cn } from "@/lib/cn";
import { initials } from "@/lib/format";
import { avatarTone, toneStyle, type Tone } from "@/lib/tone";

type Size = "xs" | "sm" | "md" | "lg";

const SIZES: Record<Size, string> = {
  xs: "h-6 w-6 text-[10px] rounded-full",
  sm: "h-8 w-8 text-[11px] rounded-[9px]",
  md: "h-9 w-9 text-[12.5px] rounded-[11px]",
  lg: "h-16 w-16 text-[22px] rounded-[18px]",
};

export function Avatar({ name, size = "md", tone, solid = false, className }: { name: string; size?: Size; tone?: Tone; solid?: boolean; className?: string }) {
  const resolvedTone = tone ?? avatarTone(name);
  return (
    <span
      style={toneStyle(resolvedTone)}
      aria-hidden
      className={cn(
        "inline-grid flex-none place-items-center font-semibold",
        solid ? "bg-[var(--tint)] text-white" : "tint-soft",
        SIZES[size],
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}
