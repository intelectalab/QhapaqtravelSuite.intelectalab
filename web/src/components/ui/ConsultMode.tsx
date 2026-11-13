"use client";

import { Eye, Lock } from "lucide-react";
import type { ReactNode } from "react";
import { useMe } from "@/components/shell/SessionProvider";
import { cn } from "@/lib/cn";
import { roleLabel } from "@/lib/me";

export function ConsultModeNotice({ permissions, what, need, className }: { permissions: string[]; what: string; need?: string; className?: string }) {
  const me = useMe();
  if (me.read_only || permissions.some((permission) => me.permissions.includes(permission))) return null;

  return (
    <p role="status" data-testid="consult-mode" className={cn("mb-5 flex flex-wrap items-start gap-x-2.5 gap-y-1 rounded-card border border-[color-mix(in_srgb,var(--info)_32%,transparent)] bg-[color-mix(in_srgb,var(--info)_8%,transparent)] px-4 py-3 text-[13.5px]", className)}>
      <Eye size={16} className="mt-0.5 flex-none text-info" />
      <span className="min-w-0 flex-1">
        <b className="font-semibold">Modo consulta ({roleLabel(me.role)}).</b> <span className="text-fg-2">Tu rol puede revisar esta información, pero no puede {what}.</span>
        <span className="mt-0.5 block text-[12px] text-fg-3">
          Permiso necesario: <code className="font-mono">{need ?? permissions.join(" o ")}</code>
        </span>
      </span>
    </p>
  );
}

export function LockedButton({ children, reason, size = "md", testId }: { children: ReactNode; reason: string; size?: "md" | "sm"; testId?: string }) {
  return (
    <span role="button" aria-disabled="true" tabIndex={0} title={reason} aria-label={`${typeof children === "string" ? children : ""} · ${reason}`} data-testid={testId} className={cn("inline-flex flex-none cursor-not-allowed items-center gap-1.5 rounded-control border border-dashed border-line bg-surface-2 font-semibold text-fg-3", size === "md" ? "h-10 px-4 text-[13.5px]" : "h-8 rounded-[10px] px-3 text-[13px]")}>
      <Lock size={size === "md" ? 15 : 14} />
      {children}
    </span>
  );
}
