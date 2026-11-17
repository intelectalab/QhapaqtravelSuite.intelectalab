"use client";

import { CircleAlert, CircleCheck, TriangleAlert, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toneStyle, type Tone } from "@/lib/tone";

export type ToastVariant = "ok" | "bad" | "warn";

interface ToastItem {
  id: number;
  text: string;
  variant: ToastVariant;
}

const LIFETIME_MS = 5000;
const MAX_VISIBLE = 4;

let items: ToastItem[] = [];
let sequence = 0;
const listeners = new Set<(next: ToastItem[]) => void>();

function publish(next: ToastItem[]) {
  items = next;
  listeners.forEach((listener) => listener(items));
}

export function dismissToast(id: number) {
  publish(items.filter((item) => item.id !== id));
}

export function toast(text: string, variant: ToastVariant = "ok") {
  const id = ++sequence;
  publish([...items, { id, text, variant }].slice(-MAX_VISIBLE));
  window.setTimeout(() => dismissToast(id), LIFETIME_MS);
  return id;
}

const VARIANT: Record<ToastVariant, { tone: Tone; icon: typeof CircleCheck }> = {
  ok: { tone: "ok", icon: CircleCheck },
  bad: { tone: "bad", icon: CircleAlert },
  warn: { tone: "warn", icon: TriangleAlert },
};

export function Toaster() {
  const [visible, setVisible] = useState<ToastItem[]>(items);
  useEffect(() => {
    listeners.add(setVisible);
    return () => {
      listeners.delete(setVisible);
    };
  }, []);

  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-4 bottom-4 z-[60] flex flex-col items-end gap-2 sm:left-auto sm:right-6 sm:bottom-6">
      {visible.map((item) => {
        const { tone, icon: Icon } = VARIANT[item.variant];
        return (
          <div key={item.id} role={item.variant === "bad" ? "alert" : "status"} data-testid="toast" data-variant={item.variant} style={toneStyle(tone)} className="pointer-events-auto flex w-full max-w-[380px] items-start gap-3 rounded-[14px] border border-line bg-surface px-3.5 py-3 text-[13.5px] text-fg shadow-[0_18px_40px_-18px_rgb(14_17_32/0.45)] motion-safe:animate-[rise-in_260ms_cubic-bezier(0.32,0.72,0,1)]">
            <span className="tint-soft mt-px grid h-7 w-7 flex-none place-items-center rounded-[9px]">
              <Icon size={16} />
            </span>
            <p className="min-w-0 flex-1 self-center leading-snug">{item.text}</p>
            <button type="button" aria-label="Cerrar aviso" onClick={() => dismissToast(item.id)} className="grid h-7 w-7 flex-none place-items-center rounded-[8px] text-fg-3 transition-colors hover:bg-surface-2 hover:text-fg">
              <X size={15} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
