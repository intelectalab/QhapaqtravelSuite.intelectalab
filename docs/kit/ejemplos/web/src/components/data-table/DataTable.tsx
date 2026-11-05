"use client";

/**
 * Tabla de datos (TanStack Table) con la MISMA regla responsive del prototipo v2.4 (proto/assets/js/core.js →
 * `ResponsiveTables`, CSS `table.tbl.rt` en app.css):
 *
 *   En ≤ 900 px, si la tabla no cabe en su contenedor (o tiene ≥ 5 columnas en ≤ 640 px) se muestra como TARJETAS:
 *   - cada celda lleva la etiqueta de su columna (equivale a `data-label` + `td::before`);
 *   - la primera celda es el título de la tarjeta;
 *   - la columna de acciones (sin encabezado) va al pie de la tarjeta; en ≤ 640 px se abre en una hoja inferior;
 *   - celdas vacías se ocultan; entre 641 y 900 px, dos tarjetas por fila; en ≤ 640 px, una.
 *   - `stack={false}` excluye matrices/calendarios (equivale a la clase `.no-stack`).
 *   Al cambiar el ancho de la ventana se vuelve a medir (el prototipo quita `.rt` y reevalúa).
 *
 * Contrato con Playwright (SELECTORES.md): `table-row:{código}`, `table-empty`; montos alineados a la derecha.
 * La paginación es por cursor (botón «Cargar más» con useInfiniteQuery); orden y filtros van al servidor.
 */
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef, type Row } from "@tanstack/react-table";
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { ActionSheet, type SheetAction } from "@/components/ui/ActionSheet";
import { NARROW, PHONE, useMediaQuery } from "@/lib/ui/useMediaQuery";

declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData, TValue> {
    /** Etiqueta en modo tarjeta si el header no es texto. */
    label?: string;
    align?: "left" | "right";
  }
}

type Props<T> = {
  data: T[];
  columns: ColumnDef<T, unknown>[];
  /** Código legible del registro para `data-testid="table-row:{código}"` (nunca el uuid). */
  rowCode: (row: T) => string;
  /** Acciones de fila. Escritorio: botones en la última columna; móvil: pie de tarjeta u hoja inferior. */
  rowActions?: (row: T) => SheetAction[];
  onRowClick?: (row: T) => void;
  emptyText?: ReactNode;
  stack?: boolean;
  footer?: ReactNode; // «Cargar más», totales…
  caption?: string; // accesibilidad
};

export function DataTable<T>({ data, columns, rowCode, rowActions, onRowClick, emptyText, stack = true, footer, caption }: Props<T>) {
  const table = useReactTable({ data, columns, getCoreRowModel: getCoreRowModel() });
  const narrow = useMediaQuery(NARROW);
  const phone = useMediaQuery(PHONE);
  const boxRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  const [cards, setCards] = useState(false);
  const [sheetRow, setSheetRow] = useState<T | null>(null);

  // Regla de ResponsiveTables.apply(): medir en modo tabla; si no cabe → tarjetas. Reevaluar al cambiar el ancho.
  useLayoutEffect(() => {
    if (!stack || !narrow) {
      setCards(false);
      return;
    }
    const measure = () => {
      const box = boxRef.current;
      const t = tableRef.current;
      if (!box || !t) return;
      const overflow = t.scrollWidth > box.clientWidth + 4;
      const manyCols = phone && table.getVisibleLeafColumns().length + (rowActions ? 1 : 0) >= 5;
      setCards(overflow || manyCols);
    };
    setCards(false); // volver a tabla para medir (como `classList.remove('rt')`)
    const id = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(id);
  }, [narrow, phone, stack, data.length, table, rowActions]);

  if (data.length === 0) {
    return (
      <div data-testid="table-empty" className="rounded-card border border-line bg-surface p-8 text-center text-fg-2">
        {emptyText ?? "No hay registros con los filtros actuales."}
      </div>
    );
  }

  const label = (header: unknown, metaLabel?: string) => metaLabel ?? (typeof header === "string" ? header : "");

  if (cards) {
    return (
      <div ref={boxRef} className="rounded-card border border-line bg-surface">
        <ul className="grid grid-cols-1 min-[641px]:grid-cols-2">
          {table.getRowModel().rows.map((row: Row<T>) => {
            const [first, ...rest] = row.getVisibleCells();
            const actions = rowActions?.(row.original) ?? [];
            return (
              <li
                key={row.id}
                data-testid={`table-row:${rowCode(row.original)}`}
                className="grid gap-1 border-b border-line-2 px-3.5 py-2.5 min-[641px]:odd:border-r"
                onClick={onRowClick ? () => onRowClick(row.original) : undefined}
              >
                {first && <div className="pb-1 text-[0.9rem] font-semibold">{flexRender(first.column.columnDef.cell, first.getContext())}</div>}
                {rest.map((cell) => {
                  const value = cell.getValue();
                  if (value === null || value === undefined || value === "") return null; // rt-empty
                  return (
                    <div key={cell.id} className="flex items-start justify-between gap-3 text-sm">
                      <span className="max-w-[42%] pt-0.5 text-[0.7rem] font-semibold uppercase tracking-wide text-fg-3">
                        {label(cell.column.columnDef.header, cell.column.columnDef.meta?.label)}
                      </span>
                      <span className="min-w-0 break-words text-right">{flexRender(cell.column.columnDef.cell, cell.getContext())}</span>
                    </div>
                  );
                })}
                {actions.length > 0 && (
                  <div className="flex flex-wrap justify-end gap-1.5 pt-1.5" onClick={(e) => e.stopPropagation()}>
                    {phone && actions.length > 1 ? (
                      <>
                        <ActionButton action={actions[0]!} />
                        <button type="button" className="h-btn rounded-control border border-line px-3" aria-label="Más acciones" onClick={() => setSheetRow(row.original)}>
                          Más
                        </button>
                      </>
                    ) : (
                      actions.map((a) => <ActionButton key={a.label} action={a} />)
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        {footer}
        <ActionSheet open={sheetRow !== null} actions={sheetRow ? (rowActions?.(sheetRow) ?? []).slice(1) : []} onClose={() => setSheetRow(null)} />
      </div>
    );
  }

  return (
    <div ref={boxRef} className="overflow-x-auto rounded-card border border-line bg-surface">
      <table ref={tableRef} className="w-full border-collapse text-sm">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead className="bg-surface-2 text-left text-xs uppercase tracking-wide text-fg-3">
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id}>
              {hg.headers.map((h) => (
                <th key={h.id} scope="col" className={`px-3 py-2 font-semibold ${h.column.columnDef.meta?.align === "right" ? "text-right" : ""}`}>
                  {h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
                </th>
              ))}
              {rowActions && <th scope="col" className="px-3 py-2" aria-label="Acciones" />}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr
              key={row.id}
              data-testid={`table-row:${rowCode(row.original)}`}
              className={`border-t border-line-2 hover:bg-surface-2 ${onRowClick ? "cursor-pointer" : ""}`}
              onClick={onRowClick ? () => onRowClick(row.original) : undefined}
            >
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className={`px-3 py-2 ${cell.column.columnDef.meta?.align === "right" ? "text-right tabular-nums" : ""}`}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
              {rowActions && (
                <td className="px-3 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                  <div className="flex justify-end gap-1.5">
                    {rowActions(row.original).map((a) => (
                      <ActionButton key={a.label} action={a} />
                    ))}
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {footer}
    </div>
  );
}

function ActionButton({ action }: { action: SheetAction }) {
  return (
    <button
      type="button"
      data-testid={action.testId}
      disabled={action.disabled}
      title={action.disabled ? action.hint : undefined}
      onClick={action.onSelect}
      className={`h-btn-sm rounded-control border border-line px-2.5 text-xs ${action.danger ? "text-bad" : ""} disabled:opacity-50`}
    >
      {action.label}
    </button>
  );
}
