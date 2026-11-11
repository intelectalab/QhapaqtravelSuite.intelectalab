import Link from "next/link";
import { cn } from "@/lib/cn";

export interface ViewMode {
  href: string;
  label: string;
  active: boolean;
}

export function ViewSwitch({ label, modes, className }: { label: string; modes: ViewMode[]; className?: string }) {
  return (
    <nav aria-label={label} className={cn("inline-flex rounded-full border border-line bg-surface p-1 text-[13px]", className)}>
      {modes.map((mode) => (
        <Link
          key={mode.href}
          href={mode.href}
          aria-current={mode.active ? "page" : undefined}
          className={cn("rounded-full px-3.5 py-1.5 font-semibold transition-colors", mode.active ? "bg-accent text-white" : "text-fg-2 hover:text-fg")}
        >
          {mode.label}
        </Link>
      ))}
    </nav>
  );
}
