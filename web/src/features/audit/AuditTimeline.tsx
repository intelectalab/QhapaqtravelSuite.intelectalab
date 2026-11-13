"use client";

import { ShieldCheck } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { SidePanel } from "@/components/ui/SidePanel";
import { formatDateTime } from "@/lib/format";

export interface AuditEntry {
  code: string;
  action: string;
  before: string | null;
  after: string | null;
  actor: string | null;
  ip: string | null;
  at: string;
}

const humanize = (action: string) => {
  const text = action.replaceAll("_", " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
};

export function AuditTimeline({ entries, empty = "Aún no hay acciones registradas." }: { entries: AuditEntry[]; empty?: string }) {
  if (entries.length === 0) return <EmptyState icon={<ShieldCheck size={20} />} title="Sin registros" description={empty} />;
  return (
    <ol className="flex flex-col gap-3 border-l-2 border-line pl-4">
      {entries.map((entry, index) => (
        <li key={entry.code} style={{ animationDelay: `${index * 35}ms` }} className="relative animate-[rise-in_380ms_cubic-bezier(0.22,1,0.36,1)_backwards]">
          <span aria-hidden className="absolute -left-[23px] top-1 grid h-3.5 w-3.5 place-items-center rounded-full border-2 border-surface bg-accent" />
          <p className="text-[13px] font-semibold">{humanize(entry.action)}</p>
          {(entry.before || entry.after) && (
            <p className="mt-0.5 break-words text-[12.5px] text-fg-2">
              {entry.before && <span className="text-fg-3 line-through decoration-fg-3/40">{entry.before}</span>}
              {entry.before && entry.after && " → "}
              {entry.after}
            </p>
          )}
          <p className="mt-0.5 text-[11.5px] text-fg-3">
            {entry.actor ?? "Sistema"} · {formatDateTime(entry.at)}
            {entry.ip ? ` · IP ${entry.ip}` : ""}
          </p>
        </li>
      ))}
    </ol>
  );
}

export function AuditPanelButton({ title, description, entries, label = "Auditoría" }: { title: string; description?: string; entries: AuditEntry[]; label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" size="sm" variant="secondary" icon={<ShieldCheck size={15} />} onClick={() => setOpen(true)}>
        {label}
      </Button>
      <SidePanel open={open} onOpenChange={setOpen} title={title} description={description}>
        <AuditTimeline entries={entries} />
      </SidePanel>
    </>
  );
}
