import { History, ListChecks } from "lucide-react";
import { StatusBadge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { MiniTable } from "@/components/ui/MiniTable";
import { TintCardTitle } from "@/components/ui/Tinted";
import { formatDateTime } from "@/lib/format";
import { statusLabel } from "@/lib/tone";

export interface AuditRow {
  id: string;
  action: string;
  before: string | null;
  after: string | null;
  occurred_at: string;
  actor: string | null;
}

export interface StatusRow {
  status: string;
  note: string | null;
  created_at: string;
  user: string | null;
}

export function StatusHistoryCard({ rows }: { rows: StatusRow[] }) {
  return (
    <Card>
      <TintCardTitle icon={ListChecks} title="Estados" />
      {rows.length === 0 ? (
        <p className="text-[13.5px] text-fg-3">Sin cambios de estado registrados.</p>
      ) : (
        <ol className="flex flex-col gap-3 border-l-2 border-[color-mix(in_srgb,var(--tint)_25%,transparent)] pl-4">
          {rows.map((row, index) => (
            <li key={index} className="relative text-[13px]">
              <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-[var(--tint)]" />
              <StatusBadge status={row.status} />
              {row.note && <span className="mt-1 block text-fg-2">{row.note}</span>}
              <span className="block text-xs text-fg-3">
                {formatDateTime(row.created_at)}
                {row.user && ` · ${row.user}`}
              </span>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

export function AuditCard({ rows }: { rows: AuditRow[] }) {
  return (
    <Card>
      <TintCardTitle icon={History} title="Auditoría" aside={rows.length ? String(rows.length) : undefined} />
      {rows.length === 0 ? (
        <p className="text-[13.5px] text-fg-3">Sin eventos de auditoría.</p>
      ) : (
        <MiniTable head={["Fecha", "Usuario", "Acción", "Antes", "Después"]}>
          {rows.map((row) => (
            <tr key={row.id}>
              <td className="whitespace-nowrap text-xs">{formatDateTime(row.occurred_at)}</td>
              <td>{row.actor ?? "Sistema"}</td>
              <td className="font-semibold">{statusLabel(row.action.replaceAll("_", " "))}</td>
              <td className="max-w-[180px] whitespace-normal text-xs text-fg-3">{row.before ?? "—"}</td>
              <td className="max-w-[240px] whitespace-normal text-xs">{row.after ?? "—"}</td>
            </tr>
          ))}
        </MiniTable>
      )}
    </Card>
  );
}
