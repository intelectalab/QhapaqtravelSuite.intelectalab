"use client";

import { FileDown } from "lucide-react";
import { useState, useTransition } from "react";
import { exportAudit } from "@/app/(backoffice)/admin/auditoria/actions";
import { ChoiceGroup } from "@/components/ui/ChoiceGroup";
import { DownloadButton } from "@/components/ui/DownloadButton";
import { FieldError } from "@/components/ui/FieldError";
import { SidePanel } from "@/components/ui/SidePanel";
import { Button } from "@/components/ui/Button";
import { formatNumber } from "@/lib/format";

const FORMATS = [
  { value: "CSV", label: "CSV" },
  { value: "XLSX", label: "Excel" },
  { value: "PDF", label: "PDF" },
];

export function AuditExportAction({ days, label }: { days: number; label: string }) {
  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState("CSV");
  const [result, setResult] = useState<{ id: string; code: string; rows: number; truncated: boolean } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const run = () =>
    start(async () => {
      const response = await exportAudit(days, format);
      setMessage(response.ok ? null : response.message);
      setResult(response.ok ? response : null);
    });

  return (
    <>
      <Button variant="secondary" size="sm" icon={<FileDown size={15} />} onClick={() => { setResult(null); setMessage(null); setOpen(true); }}>
        Exportar
      </Button>
      <SidePanel open={open} onOpenChange={setOpen} title="Exportar bitácora" description={`Eventos de ${label.toLowerCase()}. La exportación también queda registrada en la auditoría y disponible 7 días en Reportes.`}>
        <div className="flex flex-col gap-4">
          <ChoiceGroup label="Formato" name="format" options={FORMATS} defaultValue={format} onChange={setFormat} hint="El PDF incluye hasta 2 000 eventos; para más, usa CSV o Excel." />
          <FieldError message={message} />
          {result ? (
            <div className="rounded-[14px] bg-surface-2 p-3.5 text-[13px]">
              <p className="font-semibold">{result.code} lista · {formatNumber(result.rows)} eventos</p>
              {result.truncated && <p className="mt-1 text-[12.5px] text-fg-3">El PDF quedó con los 2 000 eventos más recientes.</p>}
              <div className="mt-3">
                <DownloadButton href={`/reportes/exportaciones/${result.id}/descargar`} label={`Descargar ${format}`} size="sm" />
              </div>
            </div>
          ) : (
            <Button onClick={run} disabled={pending} icon={<FileDown size={15} />}>
              {pending ? "Generando…" : "Generar archivo"}
            </Button>
          )}
        </div>
      </SidePanel>
    </>
  );
}
