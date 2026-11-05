"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Select } from "@/components/ui/Select";
import { cn } from "@/lib/cn";
import { ROW_OPTIONS } from "./query";

function pageWindow(current: number, total: number): number[] {
  const start = Math.max(1, Math.min(current - 2, total - 4));
  return Array.from({ length: Math.min(5, total) }, (_, index) => start + index);
}

export function Pager({ page, pages, total, rows, onPage, onRows, entityLabel }: { page: number; pages: number; total: number; rows: number; onPage: (page: number) => void; onRows: (rows: number) => void; entityLabel: string }) {
  const from = total === 0 ? 0 : (page - 1) * rows + 1;
  const to = Math.min(total, page * rows);
  const arrow = "grid h-8 w-8 place-items-center rounded-[9px] border border-line text-fg-2 disabled:opacity-40";

  return (
    <footer className="flex items-center gap-3 border-t border-line px-3.5 py-2.5 text-[13px] text-fg-3">
      <span className="hidden items-center gap-2 sm:inline-flex">
        Filas
        <span className="inline-flex h-8 items-center rounded-[9px] border border-line px-2.5">
          <Select variant="chip" clearable={false} value={String(rows)} onChange={(value) => onRows(Number(value))} options={ROW_OPTIONS.map((option) => ({ value: String(option), label: String(option) }))} ariaLabel="Filas por página" />
        </span>
      </span>
      <span>
        {from}–{to} de {total} {entityLabel}
      </span>
      <nav className="ml-auto flex items-center gap-1" aria-label="Paginación">
        <button type="button" className={arrow} disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Página anterior">
          <ChevronLeft size={15} />
        </button>
        {pageWindow(page, pages).map((number) => (
          <button
            key={number}
            type="button"
            onClick={() => onPage(number)}
            aria-current={number === page ? "page" : undefined}
            className={cn("h-8 min-w-8 rounded-[9px] px-2 font-semibold", number === page ? "bg-fg text-surface" : "text-fg-2 hover:bg-surface-2")}
          >
            {number}
          </button>
        ))}
        <button type="button" className={arrow} disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="Página siguiente">
          <ChevronRight size={15} />
        </button>
      </nav>
    </footer>
  );
}
