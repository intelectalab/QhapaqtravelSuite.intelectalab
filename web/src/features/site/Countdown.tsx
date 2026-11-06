"use client";

import { Timer } from "lucide-react";
import { useEffect, useState } from "react";

function remaining(until: string): number {
  return Math.max(0, new Date(`${until}T23:59:59-05:00`).getTime() - Date.now());
}

export function Countdown({ until }: { until: string }) {
  const [left, setLeft] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => setLeft(remaining(until));
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [until]);

  if (left === null) return <span className="inline-flex h-6 items-center gap-1.5 text-[12px] font-semibold text-fg-3"><Timer size={13} />Calculando…</span>;

  const days = Math.floor(left / 86_400_000);
  const hours = Math.floor((left % 86_400_000) / 3_600_000);
  const minutes = Math.floor((left % 3_600_000) / 60_000);
  const seconds = Math.floor((left % 60_000) / 1000);
  const parts = [days > 0 ? `${days} d` : null, `${String(hours).padStart(2, "0")} h`, `${String(minutes).padStart(2, "0")} min`, days === 0 ? `${String(seconds).padStart(2, "0")} s` : null].filter(Boolean);

  return (
    <span className="inline-flex h-6 items-center gap-1.5 text-[12px] font-semibold tabular-nums text-brand" title="Tiempo restante de la promoción">
      <Timer size={13} />
      Termina en {parts.join(" ")}
    </span>
  );
}
