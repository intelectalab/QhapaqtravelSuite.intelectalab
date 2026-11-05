"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";

interface SidePanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}

export function SidePanel({ open, onOpenChange, title, description, children, footer }: SidePanelProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-[rgb(14_17_32/0.35)] animate-in" />
        <Dialog.Content className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[440px] flex-col border-l border-line bg-surface shadow-[-24px_0_48px_-24px_rgb(14_17_32/0.35)] outline-none animate-in">
          <span aria-hidden className="weave-line h-1 flex-none" />
          <header className="flex flex-none items-start gap-3 border-b border-line px-6 pb-4 pt-5">
            <div className="min-w-0 flex-1">
              <Dialog.Title className="text-lg font-bold tracking-tight">{title}</Dialog.Title>
              {description ? <Dialog.Description className="mt-1 text-[13.5px] text-fg-3">{description}</Dialog.Description> : <Dialog.Description className="sr-only">{title}</Dialog.Description>}
            </div>
            <Dialog.Close aria-label="Cerrar" className="grid h-9 w-9 flex-none place-items-center rounded-lg text-fg-3 transition hover:bg-surface-2 hover:text-fg">
              <X size={18} />
            </Dialog.Close>
          </header>
          <div className="scroll-thin flex-1 overflow-y-auto px-6 py-5">{children}</div>
          {footer && <footer className="flex flex-none items-center justify-end gap-2.5 border-t border-line px-6 py-4">{footer}</footer>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
