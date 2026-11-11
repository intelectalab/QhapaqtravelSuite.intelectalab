"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState, type KeyboardEvent } from "react";
import { Select } from "@/components/ui/Select";
import { cn } from "@/lib/cn";
import { MAX_ROWS, ROW_OPTIONS } from "./query";

const CUSTOM = "custom";

function pageWindow(current: number, total: number, size: number): number[] {
  const start = Math.max(1, Math.min(current - Math.floor(size / 2), total - size + 1));
  return Array.from({ length: Math.min(size, total) }, (_, index) => start + index);
}

function RowsPicker({ rows, onRows }: { rows: number; onRows: (rows: number) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const values = ROW_OPTIONS.includes(rows) ? ROW_OPTIONS : [...ROW_OPTIONS, rows].sort((a, b) => a - b);

  const apply = () => {
    const next = Math.round(Number(draft));
    if (Number.isFinite(next) && next >= 1 && next <= MAX_ROWS) onRows(next);
    setEditing(false);
  };

  const onKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") apply();
    if (event.key === "Escape") setEditing(false);
  };

  if (editing) {
    return (
      <input
        autoFocus
        inputMode="numeric"
        value={draft}
        onChange={(event) => setDraft(event.target.value.replace(/\D/g, "").slice(0, 4))}
        onBlur={apply}
        onKeyDown={onKey}
        placeholder={`1 a ${MAX_ROWS}`}
        aria-label={`Cantidad de filas, de 1 a ${MAX_ROWS}`}
        className="h-8 w-[84px] rounded-[9px] border border-accent bg-surface px-2.5 text-[13px] font-semibold text-fg outline-none shadow-[0_0_0_3px_color-mix(in_srgb,var(--accent)_14%,transparent)] placeholder:font-normal placeholder:text-fg-3"
      />
    );
  }

  return (
    <span className="inline-flex h-8 items-center rounded-[9px] border border-line px-2.5">
      <Select
        variant="chip"
        clearable={false}
        searchable={false}
        value={String(rows)}
        onChange={(value) => {
          if (value === CUSTOM) {
            setDraft(String(rows));
            setEditing(true);
            return;
          }
          onRows(Number(value));
        }}
        options={[...values.map((option) => ({ value: String(option), label: String(option) })), { value: CUSTOM, label: "Personalizado…" }]}
        ariaLabel="Filas por página"
      />
    </span>
  );
}

interface PagerProps {
  page: number;
  pages: number;
  total: number;
  rows: number;
  onPage: (page: number) => void;
  onRows: (rows: number) => void;
  entityLabel: string;
  placement?: "top" | "bottom";
}

export function Pager({ page, pages, total, rows, onPage, onRows, entityLabel, placement = "bottom" }: PagerProps) {
  const from = total === 0 ? 0 : (page - 1) * rows + 1;
  const to = Math.min(total, page * rows);
  const top = placement === "top";
  const arrow = "grid h-8 w-8 place-items-center rounded-[9px] border border-line text-fg-2 transition hover:border-fg-3/40 hover:text-fg disabled:pointer-events-none disabled:opacity-40";

  const nav = (
    <nav className={cn("flex items-center gap-1", !top && "ml-auto")} aria-label={top ? "Paginación superior" : "Paginación"}>
      <button type="button" className={arrow} disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Página anterior">
        <ChevronLeft size={15} />
      </button>
      {top && <span className="px-1.5 font-semibold text-fg-2 lg:hidden">{page} / {pages}</span>}
      <span className={cn("items-center gap-1", top ? "hidden lg:flex" : "flex")}>
        {pageWindow(page, pages, top ? 3 : 5).map((number) => (
          <button
            key={number}
            type="button"
            onClick={() => onPage(number)}
            aria-current={number === page ? "page" : undefined}
            className={cn("h-8 min-w-8 rounded-[9px] px-2 font-semibold transition", number === page ? "bg-fg text-surface" : "text-fg-2 hover:bg-surface-2")}
          >
            {number}
          </button>
        ))}
      </span>
      <button type="button" className={arrow} disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="Página siguiente">
        <ChevronRight size={15} />
      </button>
    </nav>
  );

  if (top) {
    return (
      <div className="flex flex-none items-center gap-2.5 text-[13px] text-fg-3" data-testid="pager-top">
        <span className="hidden items-center gap-2 xl:inline-flex">
          Filas
          <RowsPicker rows={rows} onRows={onRows} />
        </span>
        <span className="hidden whitespace-nowrap xl:inline">
          {from}–{to} de {total}
        </span>
        {nav}
      </div>
    );
  }

  return (
    <footer className="flex items-center gap-3 border-t border-line px-3.5 py-2.5 text-[13px] text-fg-3">
      <span className="hidden items-center gap-2 sm:inline-flex">
        Filas
        <RowsPicker rows={rows} onRows={onRows} />
      </span>
      <span>
        {from}–{to} de {total} {entityLabel}
      </span>
      {nav}
    </footer>
  );
}
