"use client";

import { ArrowUpDown, Search, SlidersHorizontal, X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export function SearchBox({ value, onChange, placeholder = "Buscar" }: { value: string; onChange: (value: string) => void; placeholder?: string }) {
  const [text, setText] = useState(value);
  const input = useRef<HTMLInputElement>(null);
  const handler = useRef(onChange);

  useEffect(() => {
    handler.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (text === value) return;
    const timer = window.setTimeout(() => handler.current(text), 300);
    return () => window.clearTimeout(timer);
  }, [text, value]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (event.key !== "/" || event.ctrlKey || event.metaKey || event.altKey) return;
      if (target && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))) return;
      event.preventDefault();
      input.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <label className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-[10px] border border-line bg-surface px-3 text-fg-3 focus-within:border-accent/50 sm:max-w-[300px]">
      <Search size={16} className="flex-none text-accent" />
      <input ref={input} value={text} onChange={(event) => setText(event.target.value)} placeholder={placeholder} className="w-full min-w-0 bg-transparent text-[13px] text-fg outline-none placeholder:text-fg-3" />
      {text && (
        <button type="button" aria-label="Borrar búsqueda" onClick={() => { setText(""); onChange(""); }} className="text-fg-3 hover:text-fg">
          <X size={14} />
        </button>
      )}
    </label>
  );
}

export function ToggleButton({ active, onClick, icon, label, badge, collapseLabel }: { active: boolean; onClick: () => void; icon: ReactNode; label: string; badge?: number; collapseLabel?: boolean }) {
  return (
    <button
      type="button"
      aria-expanded={active}
      onClick={onClick}
      className={cn(
        "inline-flex h-9 flex-none items-center gap-2 whitespace-nowrap rounded-[10px] border px-3 text-[13px] font-medium transition",
        active ? "border-fg bg-fg text-surface" : "border-line bg-surface text-fg-2 hover:text-fg",
      )}
    >
      <span className={active ? "text-surface" : "text-accent"}>{icon}</span>
      <span className={cn(collapseLabel && "hidden sm:inline")}>{label}</span>
      {badge !== undefined && badge > 0 && (
        <span className={cn("rounded-md px-1.5 font-mono text-[11px] font-semibold", active ? "bg-surface text-fg" : "bg-accent text-white")}>{badge}</span>
      )}
    </button>
  );
}

export const FilterIcon = <SlidersHorizontal size={15} />;
export const SortIcon = <ArrowUpDown size={15} />;

export function DrawerBar({ label, children, actions, onClose }: { label: string; children: ReactNode; actions?: ReactNode; onClose: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-line bg-surface-2/60 px-3.5 py-2.5 animate-in">
      <span className="text-[12.5px] text-fg-3">{label}</span>
      <div className="flex flex-1 flex-wrap items-center gap-2">{children}</div>
      <div className="flex items-center gap-1.5">
        {actions}
        <button type="button" onClick={onClose} aria-label="Cerrar barra" className="grid h-7 w-7 place-items-center rounded-lg text-fg-3 hover:bg-surface hover:text-fg">
          <X size={14} />
        </button>
      </div>
    </div>
  );
}

export function Chip({ label, children, active }: { label: string; children: ReactNode; active?: boolean }) {
  return (
    <div className={cn("inline-flex h-8 items-center gap-1 rounded-[9px] border bg-surface pl-2.5 pr-2", active ? "border-accent/40" : "border-line")}>
      <span className="text-xs text-fg-3">{label}:</span>
      {children}
    </div>
  );
}
