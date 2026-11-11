import { CircleAlert, CircleCheck, Clock3 } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type CheckTone = "ok" | "warn" | "bad";

const TONES: Record<CheckTone, { box: string; icon: string; Icon: typeof CircleCheck }> = {
  ok: { box: "bg-surface-2", icon: "text-ok", Icon: CircleCheck },
  warn: { box: "bg-[color-mix(in_srgb,var(--warn)_10%,transparent)]", icon: "text-warn", Icon: Clock3 },
  bad: { box: "bg-[color-mix(in_srgb,var(--bad)_9%,transparent)]", icon: "text-bad", Icon: CircleAlert },
};

interface CheckItemProps {
  tone: CheckTone;
  title: string;
  detail?: ReactNode;
  delay?: number;
  compact?: boolean;
  testId?: string;
  children?: ReactNode;
}

export function CheckItem({ tone, title, detail, delay = 0, compact = false, testId, children }: CheckItemProps) {
  const { box, icon, Icon } = TONES[tone];
  return (
    <div
      data-testid={testId}
      data-tone={tone}
      style={{ animationDelay: `${delay}ms` }}
      className={cn("flex animate-[rise-in_380ms_cubic-bezier(0.22,1,0.36,1)_backwards] items-start gap-2.5 rounded-xl transition-transform duration-300 hover:-translate-y-0.5", compact ? "px-3 py-2 text-[12.5px]" : "px-3.5 py-2.5 text-[13px]", box)}
    >
      <span className={cn("mt-0.5 flex-none", icon)}>
        <Icon size={compact ? 15 : 16} />
      </span>
      <span className="min-w-0 flex-1">
        <b className="block font-semibold">{title}</b>
        {detail && <span className="block text-fg-3">{detail}</span>}
        {children}
      </span>
    </div>
  );
}
