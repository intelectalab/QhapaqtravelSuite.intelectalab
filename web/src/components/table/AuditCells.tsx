import { formatDateTime } from "@/lib/format";

export function AuditWhen({ at, correlation }: { at: string; correlation?: string | null }) {
  return (
    <>
      {formatDateTime(at)}
      {correlation && (
        <span className="block font-mono text-[11px] text-fg-3" title={`Correlación ${correlation}`}>
          #{correlation.slice(0, 8)}
        </span>
      )}
    </>
  );
}

export function AuditWho({ actor, ip }: { actor: string | null; ip?: string | null }) {
  return (
    <>
      {actor ?? "—"}
      {ip && <span className="block font-mono text-[11px] text-fg-3">IP {ip}</span>}
    </>
  );
}
