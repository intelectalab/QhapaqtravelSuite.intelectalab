"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/cn";

export interface RepeatableField {
  key: string;
  label: string;
  multiline?: boolean;
  maxLength?: number;
  placeholder?: string;
}

type Row = Record<string, string> & { _id: string };

interface RepeatableFieldsProps {
  label: string;
  name: string;
  fields: RepeatableField[];
  defaultValue?: Record<string, string>[];
  addLabel: string;
  itemLabel: string;
  max?: number;
  hint?: string;
}

let counter = 0;

const withId = (row: Record<string, string>): Row => ({ ...row, _id: `row-${++counter}` });

const strip = (rows: Row[]): Record<string, string>[] => rows.map((row) => Object.fromEntries(Object.entries(row).filter(([key]) => key !== "_id"))).filter((row) => Object.values(row).some((value) => value.trim() !== ""));

export function RepeatableFields({ label, name, fields, defaultValue = [], addLabel, itemLabel, max = 10, hint }: RepeatableFieldsProps) {
  const [rows, setRows] = useState<Row[]>(() => defaultValue.map(withId));
  const empty = () => Object.fromEntries(fields.map((field) => [field.key, ""]));
  const update = (id: string, key: string, value: string) => setRows((current) => current.map((row) => (row._id === id ? { ...row, [key]: value } : row)));
  const move = (index: number, delta: number) =>
    setRows((current) => {
      const next = [...current];
      const [row] = next.splice(index, 1);
      next.splice(index + delta, 0, row);
      return next;
    });

  return (
    <fieldset data-testid={`field:${name}`}>
      <legend className="mb-1.5 text-[13px] font-semibold text-fg">{label}</legend>
      {hint && <p className="-mt-1 mb-2 text-[12.5px] text-fg-3">{hint}</p>}
      <input type="hidden" name={name} value={JSON.stringify(strip(rows))} />
      <ol className="flex flex-col gap-2.5">
        {rows.map((row, index) => (
          <li key={row._id} className="rounded-[14px] border border-line bg-surface-2/40 p-3 motion-safe:animate-[rise-in_260ms_ease-out_backwards]">
            <div className="mb-2 flex items-center gap-1">
              <span className="flex-1 text-[12.5px] font-semibold text-fg-3">
                {itemLabel} {index + 1}
              </span>
              <button type="button" aria-label="Subir" title="Subir" disabled={index === 0} onClick={() => move(index, -1)} className="grid h-7 w-7 place-items-center rounded-lg text-fg-3 transition hover:bg-surface hover:text-fg disabled:opacity-30">
                <ArrowUp size={14} />
              </button>
              <button type="button" aria-label="Bajar" title="Bajar" disabled={index === rows.length - 1} onClick={() => move(index, 1)} className="grid h-7 w-7 place-items-center rounded-lg text-fg-3 transition hover:bg-surface hover:text-fg disabled:opacity-30">
                <ArrowDown size={14} />
              </button>
              <button type="button" aria-label={`Quitar ${itemLabel.toLowerCase()}`} title="Quitar" onClick={() => setRows((current) => current.filter((item) => item._id !== row._id))} className="grid h-7 w-7 place-items-center rounded-lg text-fg-3 transition hover:bg-bad/10 hover:text-bad">
                <Trash2 size={14} />
              </button>
            </div>
            <div className="flex flex-col gap-2">
              {fields.map((field) => {
                const common = {
                  "aria-label": `${field.label} ${index + 1}`,
                  value: row[field.key] ?? "",
                  maxLength: field.maxLength,
                  placeholder: field.placeholder ?? field.label,
                  className: "w-full rounded-control border border-line bg-surface px-3 text-[13.5px] outline-none transition focus:border-accent focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--accent)_14%,transparent)]",
                };
                return field.multiline ? (
                  <textarea key={field.key} rows={3} {...common} onChange={(event) => update(row._id, field.key, event.target.value)} className={cn(common.className, "scroll-thin resize-y py-2.5")} />
                ) : (
                  <input key={field.key} {...common} onChange={(event) => update(row._id, field.key, event.target.value)} className={cn(common.className, "h-10 font-semibold")} />
                );
              })}
            </div>
          </li>
        ))}
      </ol>
      <button type="button" disabled={rows.length >= max} onClick={() => setRows((current) => [...current, withId(empty())])} className="mt-2.5 inline-flex h-9 items-center gap-1.5 rounded-[10px] border border-dashed border-line px-3 text-[13px] font-semibold text-accent transition hover:border-accent/50 hover:bg-accent/5 disabled:opacity-40">
        <Plus size={15} />
        {addLabel}
      </button>
    </fieldset>
  );
}
