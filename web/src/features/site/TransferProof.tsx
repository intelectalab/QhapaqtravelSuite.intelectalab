"use client";

import { FileCheck2, FileUp, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useState } from "react";
import type { ProofState } from "@/app/(sitio)/sitio/[agencia]/transfer-actions";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/format";

const INITIAL: ProofState = { done: false, message: null };

const MAX_KB = 10 * 1024;

export function TransferProofUpload({ action, uploadedAt, compact = false }: { action: (state: ProofState, form: FormData) => Promise<ProofState>; uploadedAt?: string | null; compact?: boolean }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [round, setRound] = useState(0);
  const [state, submit, pending] = useActionState(async (previous: ProofState, form: FormData) => {
    const next = await action(previous, form);
    if (next.done) {
      setFile(null);
      setRound((value) => value + 1);
      router.refresh();
    }
    return next;
  }, INITIAL);
  const tooBig = file !== null && file.size > MAX_KB * 1024;

  return (
    <form key={round} action={submit} className="grid gap-3">
      {uploadedAt && (
        <p data-testid="proof-received" className="flex items-center gap-2 rounded-xl bg-[color-mix(in_srgb,var(--ok)_10%,var(--surface))] px-3.5 py-2.5 text-[13px] text-fg">
          <FileCheck2 size={16} className="flex-none text-ok" />
          Constancia recibida el {formatDateTime(uploadedAt)}. La validamos en horario de atención.
        </p>
      )}
      <div className={cn("flex flex-wrap items-center gap-3", compact && "gap-2")}>
        <label className={cn("group flex min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-xl border border-dashed bg-surface px-3.5 py-3 transition hover:-translate-y-0.5 hover:border-accent", tooBig ? "border-bad" : "border-line")}>
          <span className="grid h-9 w-9 flex-none place-items-center rounded-[10px] bg-[color-mix(in_srgb,var(--accent)_12%,var(--surface))] text-accent transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110">
            <FileUp size={17} />
          </span>
          <span className="min-w-0 text-[13px]">
            <b className="block truncate font-semibold text-fg">{file ? file.name : uploadedAt ? "Subir otra constancia" : "Elegir foto o PDF de la constancia"}</b>
            <span className={cn("block text-[12px]", tooBig ? "text-bad" : "text-fg-3")}>{file ? `${Math.ceil(file.size / 1024)} KB${tooBig ? " · supera 10 MB" : ""}` : "JPG, PNG, WEBP o PDF de hasta 10 MB"}</span>
          </span>
          <input type="file" name="file" accept="image/jpeg,image/png,image/webp,application/pdf" required className="sr-only" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
        </label>
        <button type="submit" disabled={pending || file === null || tooBig} className="inline-flex h-11 items-center justify-center gap-2 rounded-control bg-brand px-5 text-[14px] font-semibold text-brand-fg shadow-[0_10px_24px_-12px_var(--brand)] transition hover:-translate-y-0.5 hover:brightness-110 disabled:opacity-60">
          {pending ? <Loader2 size={16} className="animate-spin" /> : <FileUp size={16} />}
          Subir constancia
        </button>
      </div>
      {state.message && <p className="text-[13px] text-bad">{state.message}</p>}
    </form>
  );
}
