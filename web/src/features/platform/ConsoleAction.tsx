"use client";

import type { ReactNode } from "react";
import { RowIcon } from "@/components/table/RowActions";
import { Button } from "@/components/ui/Button";
import { PanelAction } from "@/components/ui/PanelAction";
import type { ConsoleResult } from "@/lib/server/platformConsole";

type RowTone = "view" | "edit" | "delete" | "neutral";

interface ConsoleActionProps {
  id: string;
  label: string;
  icon: ReactNode;
  title: string;
  description?: ReactNode;
  submitLabel: string;
  action: (state: ConsoleResult, form: FormData) => Promise<ConsoleResult>;
  fields?: Record<string, string>;
  rowTone?: RowTone;
  variant?: "primary" | "secondary" | "ghost";
  size?: "md" | "sm";
  children?: ReactNode;
}

const initial: ConsoleResult = { message: null, done: false };

export function ConsoleAction({ id, label, icon, title, description, submitLabel, action, fields = {}, rowTone, variant = "secondary", size = "md", children }: ConsoleActionProps) {
  return (
    <PanelAction<ConsoleResult>
      label={label}
      icon={icon}
      variant={variant}
      size={size}
      formId={id}
      title={title}
      description={description}
      submitLabel={submitLabel}
      action={action}
      initial={initial}
      trigger={
        rowTone
          ? (open) => <RowIcon tone={rowTone} label={label} icon={icon} onClick={open} />
          : (open) => (
              <Button variant={variant} size={size} iconOnlyOnMobile icon={icon} onClick={open}>
                {label}
              </Button>
            )
      }
    >
      {() => (
        <>
          {Object.entries(fields).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))}
          {children}
        </>
      )}
    </PanelAction>
  );
}
