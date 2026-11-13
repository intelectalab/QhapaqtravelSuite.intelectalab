import { Check, LogOut, Palette } from "lucide-react";
import type { TemplatePreview } from "@/lib/templatePreview";

export function TemplatePreviewBar({ agencia, preview, canManage }: { agencia: string; preview: TemplatePreview; canManage: boolean }) {
  const exit = `/sitio/${agencia}/vista-plantilla`;

  return (
    <div role="region" aria-label="Vista previa de plantilla" data-testid="template-preview-bar" className="fixed bottom-4 left-1/2 z-[60] flex max-w-[calc(100vw-32px)] -translate-x-1/2 flex-wrap items-center gap-3 rounded-[14px] border border-line bg-surface px-3.5 py-2.5 text-[13px] text-fg shadow-[0_12px_30px_rgb(0_0_0/0.25)]">
      <span className="flex items-center gap-2">
        <Palette size={16} className="text-[var(--violet)]" />
        <b className="font-semibold">Vista previa:</b> {preview.name}
        {preview.version && <span className="font-mono text-[12px] text-fg-3">v{preview.version}</span>}
      </span>
      <span className="flex items-center gap-1.5">
        {canManage && (
          <a href={`${exit}?aplicar=${encodeURIComponent(preview.code)}`} className="inline-flex h-8 items-center gap-1.5 rounded-[10px] bg-brand px-3 font-semibold text-brand-fg transition hover:brightness-110">
            <Check size={15} />
            Aplicar esta plantilla
          </a>
        )}
        <a href={canManage ? `${exit}?panel=1` : exit} className="inline-flex h-8 items-center gap-1.5 rounded-[10px] border border-line px-3 font-semibold transition hover:bg-surface-2">
          <LogOut size={15} />
          Salir de la vista previa
        </a>
      </span>
    </div>
  );
}
