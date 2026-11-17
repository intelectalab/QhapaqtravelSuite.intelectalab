"use client";

import { useState, type ReactNode } from "react";
import { Button } from "./Button";
import { SidePanel } from "./SidePanel";

interface ViewPanelProps {
  label: string;
  icon?: ReactNode;
  variant?: "primary" | "secondary" | "ghost";
  testId?: string;
  title: string;
  description?: ReactNode;
  size?: "default" | "wide";
  children: ReactNode;
}

export function ViewPanel({ label, icon, variant = "secondary", testId, title, description, size = "wide", children }: ViewPanelProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant={variant} icon={icon} iconOnlyOnMobile onClick={() => setOpen(true)} data-testid={testId}>
        {label}
      </Button>
      <SidePanel open={open} onOpenChange={setOpen} title={title} description={description} size={size}>
        {children}
      </SidePanel>
    </>
  );
}
