import { CircleAlert, Clock } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface SupplyAlert {
  key: string;
  tone: "bad" | "warn";
  text: ReactNode;
}

export function SupplyAlerts({ alerts }: { alerts: SupplyAlert[] }) {
  if (!alerts.length) return null;
  return (
    <div className="mb-5 flex flex-col gap-2">
      {alerts.map((alert) => (
        <div key={alert.key} role="status" className={cn("flex items-start gap-2.5 rounded-xl border px-4 py-3 text-[13.5px]", alert.tone === "bad" ? "border-bad/30 bg-bad/[0.07] text-bad" : "border-warn/35 bg-warn/[0.09] text-fg")}>
          {alert.tone === "bad" ? <CircleAlert size={17} className="mt-px flex-none" /> : <Clock size={17} className="mt-px flex-none text-warn" />}
          <span>{alert.text}</span>
        </div>
      ))}
    </div>
  );
}
