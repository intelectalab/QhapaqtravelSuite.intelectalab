"use client";

/**
 * Hoja inferior de acciones para móvil (prototipo v2.4 `MobileHeader.sheet`, clases .ph-sheet): título «Más acciones»,
 * botones de 46 px a todo el ancho, cierre con Escape, clic fuera o al elegir una acción; respeta el área segura.
 * En producción puede reemplazarse por `Sheet` (side="bottom") de shadcn/Radix con el mismo contenido y testids.
 */
import { useEffect, useRef } from "react";

export type SheetAction = {
  label: string;
  onSelect: () => void;
  testId?: string;
  danger?: boolean;
  disabled?: boolean;
  /** Tooltip/razón cuando está deshabilitada (p. ej. «Requiere permiso reservations.cancel»). */
  hint?: string;
};

type Props = { open: boolean; title?: string; actions: readonly SheetAction[]; onClose: () => void };

export function ActionSheet({ open, title = "Más acciones", actions, onClose }: Props) {
  const firstRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    firstRef.current?.focus(); // foco visible dentro de la hoja (accesibilidad)
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-[119] bg-[rgba(5,18,24,.45)]" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        data-testid="action-sheet"
        className="fixed inset-x-0 bottom-0 z-[120] grid max-h-[80vh] gap-1.5 overflow-y-auto rounded-t-card bg-surface px-3 pt-2 shadow-modal"
        style={{ paddingBottom: "calc(14px + env(safe-area-inset-bottom))" }}
      >
        <div className="mx-auto mb-1.5 mt-1 h-1 w-10 rounded-sm bg-line" aria-hidden="true" />
        <div className="px-1 pb-1 text-[0.72rem] font-semibold uppercase tracking-wider text-fg-3">{title}</div>
        {actions.map((a, i) => (
          <button
            key={a.label}
            ref={i === 0 ? firstRef : undefined}
            type="button"
            data-testid={a.testId}
            disabled={a.disabled}
            title={a.disabled ? a.hint : undefined}
            onClick={() => {
              onClose();
              a.onSelect();
            }}
            className={[
              "flex h-[46px] w-full items-center rounded-control border border-line px-3 text-left text-[0.92rem]",
              a.danger ? "text-bad" : "text-fg",
              "disabled:cursor-not-allowed disabled:opacity-50",
            ].join(" ")}
          >
            {a.label}
          </button>
        ))}
      </div>
    </>
  );
}
