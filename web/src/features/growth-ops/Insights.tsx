"use client";

import { CheckCheck, Eye, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { growthStep } from "@/app/(backoffice)/finanzas/crecimiento-actions";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import type { InsightRow } from "@/lib/growth-ops";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/format";
import type { Tone } from "@/lib/tone";

const SEVERITY: Record<InsightRow["severity"], Tone> = { alta: "bad", media: "warn", baja: "info" };

const SOURCE_LINKS: Record<string, (code: string) => string> = {
  fin_receivable: () => "/finanzas/links-de-pago",
  quote_quote: (code) => `/cotizaciones/${code}`,
};

function ResolveButtons({ insight }: { insight: InsightRow }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const send = (status: string) =>
    start(async () => {
      const form = new FormData();
      form.set("step", "insight_resolve");
      form.set("key", insight.id);
      form.set("status", status);
      const result = await growthStep({ message: null, done: false }, form);
      if (result.done) router.refresh();
    });
  return (
    <span className="flex flex-wrap gap-2">
      {insight.status === "nueva" && <Button size="sm" variant="ghost" icon={<Eye size={14} />} disabled={pending} onClick={() => send("vista")}>Marcar vista</Button>}
      <Button size="sm" variant="secondary" icon={<X size={14} />} disabled={pending} onClick={() => send("descartada")}>Descartar</Button>
      <Button size="sm" variant="primary" icon={<CheckCheck size={14} />} disabled={pending} onClick={() => send("resuelta")}>Resuelta</Button>
    </span>
  );
}

export function InsightList({ rows }: { rows: InsightRow[] }) {
  if (rows.length === 0) return <p className="rounded-xl bg-surface-2 px-4 py-10 text-center text-[13px] text-fg-3">No hay alertas con este filtro.</p>;
  return (
    <ul className="grid gap-3">
      {rows.map((insight, index) => {
        const link = insight.source.type && insight.source.code ? SOURCE_LINKS[insight.source.type]?.(insight.source.code) : undefined;
        const open = insight.status === "nueva" || insight.status === "vista";
        return (
          <li key={insight.id} style={{ animationDelay: `${index * 50}ms` }} className={cn("lift grid gap-2 rounded-xl border px-4 py-3.5 animate-[rise-in_420ms_cubic-bezier(0.22,1,0.36,1)_backwards]", open ? "border-line bg-surface" : "border-transparent bg-surface-2 opacity-75")}>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={SEVERITY[insight.severity]}>{insight.severity_label}</Badge>
              <Badge tone="mute" dot={false}>{insight.kind_label}</Badge>
              {insight.status === "nueva" && <Badge tone="info">Nueva</Badge>}
              <span className="ml-auto text-[11.5px] text-fg-3">{formatDateTime(insight.generated_at)}</span>
            </div>
            <h3 className="text-[14px] font-semibold">{link ? <Link href={link} className="hover:underline">{insight.title}</Link> : insight.title}</h3>
            <p className="text-[13px] leading-relaxed text-fg-2">{insight.detail}</p>
            {open ? <ResolveButtons insight={insight} /> : <span className="text-[12px] text-fg-3">{insight.status_label}{insight.resolved_at ? ` · ${formatDateTime(insight.resolved_at)}` : ""}</span>}
          </li>
        );
      })}
    </ul>
  );
}
