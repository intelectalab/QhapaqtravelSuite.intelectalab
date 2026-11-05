"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { groupFor, screenFor } from "@/config/navigation";
import { cn } from "@/lib/cn";
import { DEFAULT_MOTIF, motifTile } from "@/lib/motifs";
import { useWorkspace } from "./Workspace";

export function HeaderMotif() {
  const tile = motifTile(groupFor(usePathname(), useWorkspace().groups)?.motif ?? DEFAULT_MOTIF);
  const style = tile ? { WebkitMask: `${tile.image} 0 0 / ${tile.size} repeat`, mask: `${tile.image} 0 0 / ${tile.size} repeat` } : undefined;
  return (
    <div aria-hidden className="weave-fade pointer-events-none absolute inset-y-0 right-0 -z-10 w-[min(560px,45%)] max-sm:hidden">
      <div style={style} className={cn("h-full w-full bg-t1 [[data-theme=dark]_&]:opacity-[0.14]", tile ? "opacity-[0.1]" : "weave-tint opacity-[0.07]")} />
    </div>
  );
}

export function SectionBadge() {
  const screen = screenFor(usePathname(), useWorkspace().groups);
  if (!screen) return null;
  const Icon = screen.icon;
  return (
    <span className="relative grid h-14 w-14 flex-none place-items-center overflow-hidden rounded-2xl bg-t1 text-white shadow-[0_10px_24px_-12px_var(--t1)]">
      <span className="weave-pattern absolute inset-0 bg-[length:16px_16px] opacity-[0.14]" />
      <Icon size={26} strokeWidth={1.9} className="relative" />
    </span>
  );
}

export function SectionCrumb() {
  const pathname = usePathname();
  const { groups } = useWorkspace();
  const screen = screenFor(pathname, groups);
  const group = groupFor(pathname, groups);
  if (!screen || !group) return null;
  const isRecord = pathname !== screen.href;
  return (
    <nav aria-label="Ubicación" className="flex items-center gap-1.5 text-[12.5px] text-fg-3">
      <span>{group.label}</span>
      <span aria-hidden>/</span>
      {isRecord ? (
        <Link href={screen.href} className="hover:text-fg">
          {screen.label}
        </Link>
      ) : (
        <span className="font-medium text-fg-2">{screen.label}</span>
      )}
    </nav>
  );
}
