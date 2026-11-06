import { BatteryFull, Signal, Wifi } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function PhoneFrame({ clock, children, footer, className }: { clock: string; children: ReactNode; footer?: ReactNode; className?: string }) {
  return (
    <div className={cn("mx-auto w-full max-w-[380px] rounded-[44px] border border-line bg-fg p-2.5 shadow-[0_30px_60px_-30px_rgb(0_0_0/0.55)] transition-transform duration-500 hover:-translate-y-1", className)}>
      <div className="relative flex h-[740px] flex-col overflow-hidden rounded-[36px] bg-bg">
        <div className="flex items-center justify-between px-6 pb-1 pt-3 text-[11.5px] font-semibold text-fg">
          <span>{clock}</span>
          <span className="absolute left-1/2 top-2.5 h-6 w-24 -translate-x-1/2 rounded-full bg-fg" />
          <span className="flex items-center gap-1">
            <Signal size={12} />
            <Wifi size={12} />
            <BatteryFull size={14} />
          </span>
        </div>
        <div className="scroll-thin flex-1 overflow-y-auto px-4 pb-4 pt-2">{children}</div>
        {footer && <div className="border-t border-line bg-surface px-3 py-2">{footer}</div>}
      </div>
    </div>
  );
}

export function AppTabBar({ items, active }: { items: { id: string; label: string; icon: ReactNode }[]; active: string }) {
  return (
    <nav className="grid grid-cols-4 gap-1">
      {items.map((item) => (
        <span key={item.id} className={cn("flex flex-col items-center gap-0.5 rounded-xl py-1.5 text-[10.5px] font-semibold transition-colors", item.id === active ? "bg-accent/10 text-accent" : "text-fg-3")}>
          {item.icon}
          {item.label}
        </span>
      ))}
    </nav>
  );
}
