import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function StepCard({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children: ReactNode }) {
  return (
    <div className="lift rounded-card border border-line bg-surface p-4">
      <p className="mb-2 flex items-center gap-2 text-[13.5px] font-semibold">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-accent/10 text-accent">
          <Icon size={15} />
        </span>
        {title}
      </p>
      <div className="text-[13px] leading-relaxed text-fg-2">{children}</div>
    </div>
  );
}
