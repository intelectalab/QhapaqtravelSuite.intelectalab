"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

interface RowsEditorProps<T> {
  rows: T[];
  onChange: (rows: T[]) => void;
  create: () => T;
  render: (row: T, update: (patch: Partial<T>) => void, index: number) => ReactNode;
  itemLabel: string;
  addLabel: string;
  empty?: string;
  max?: number;
  reorder?: boolean;
  testId?: string;
}

export function RowsEditor<T>({ rows, onChange, create, render, itemLabel, addLabel, empty, max = 60, reorder = true, testId }: RowsEditorProps<T>) {
  const update = (index: number, patch: Partial<T>) => onChange(rows.map((row, position) => (position === index ? { ...row, ...patch } : row)));
  const move = (index: number, delta: number) => {
    const next = [...rows];
    const [row] = next.splice(index, 1);
    next.splice(index + delta, 0, row);
    onChange(next);
  };

  return (
    <div data-testid={testId} className="flex flex-col gap-2.5">
      {rows.length === 0 && empty && <p className="rounded-[14px] border border-dashed border-line px-4 py-3.5 text-[13px] text-fg-3">{empty}</p>}
      {rows.map((row, index) => (
        <div key={index} className="lift rounded-[14px] border border-line bg-surface-2/40 p-3 motion-safe:animate-[rise-in_260ms_ease-out_backwards]">
          <div className="mb-2 flex items-center gap-1">
            <span className="flex-1 text-[12.5px] font-semibold text-fg-3">
              {itemLabel} {index + 1}
            </span>
            {reorder && (
              <>
                <button type="button" aria-label="Subir" title="Subir" disabled={index === 0} onClick={() => move(index, -1)} className="grid h-7 w-7 place-items-center rounded-lg text-fg-3 transition hover:bg-surface hover:text-fg disabled:opacity-30">
                  <ArrowUp size={14} />
                </button>
                <button type="button" aria-label="Bajar" title="Bajar" disabled={index === rows.length - 1} onClick={() => move(index, 1)} className="grid h-7 w-7 place-items-center rounded-lg text-fg-3 transition hover:bg-surface hover:text-fg disabled:opacity-30">
                  <ArrowDown size={14} />
                </button>
              </>
            )}
            <button type="button" aria-label={`Quitar ${itemLabel.toLowerCase()} ${index + 1}`} title="Quitar" onClick={() => onChange(rows.filter((_, position) => position !== index))} className="grid h-7 w-7 place-items-center rounded-lg text-fg-3 transition hover:bg-bad/10 hover:text-bad">
              <Trash2 size={14} />
            </button>
          </div>
          {render(row, (patch) => update(index, patch), index)}
        </div>
      ))}
      <button
        type="button"
        disabled={rows.length >= max}
        onClick={() => onChange([...rows, create()])}
        className={cn("inline-flex h-9 w-fit items-center gap-1.5 rounded-[10px] border border-dashed border-line px-3 text-[13px] font-semibold text-accent transition hover:border-accent/50 hover:bg-accent/5 disabled:opacity-40")}
      >
        <Plus size={15} />
        {addLabel}
      </button>
    </div>
  );
}
