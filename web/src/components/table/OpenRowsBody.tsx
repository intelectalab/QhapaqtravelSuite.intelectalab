"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { openRow, ROWS_OPEN } from "./rowOpen";

export function OpenRowsBody({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <tbody onClick={openRow} className={cn(ROWS_OPEN, className)}>
      {children}
    </tbody>
  );
}
