"use client";

import { createContext, useContext, type ReactNode } from "react";
import { DEFAULT_LOGO, type LogoMark } from "@/lib/brand";

const LogoContext = createContext<LogoMark>(DEFAULT_LOGO);

export function LogoProvider({ mark, children }: { mark: LogoMark; children: ReactNode }) {
  return <LogoContext.Provider value={mark}>{children}</LogoContext.Provider>;
}

export function LogoGlyph({ mark, size = 22 }: { mark: LogoMark; size?: number }) {
  if (mark === "kit") {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
        <rect width="24" height="24" rx="6" fill="var(--kit-navy)" />
        <g fill="none" stroke="var(--kit-sun)" strokeWidth="2" strokeLinejoin="round">
          <rect x="5" y="5" width="5.5" height="5.5" />
          <rect x="13.5" y="5" width="5.5" height="5.5" />
          <rect x="5" y="13.5" width="5.5" height="5.5" />
          <rect x="13.5" y="13.5" width="5.5" height="5.5" />
        </g>
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <rect x="2" y="2" width="9" height="9" rx="1.5" fill="var(--t3)" />
      <rect x="13" y="2" width="9" height="9" rx="1.5" fill="var(--t2)" />
      <rect x="2" y="13" width="9" height="9" rx="1.5" fill="var(--t1)" />
      <path d="M13 13h9v9h-4.5v-4.5H13z" fill="var(--t4)" />
    </svg>
  );
}

export function BrandMark({ size = 22 }: { size?: number }) {
  return <LogoGlyph mark={useContext(LogoContext)} size={size} />;
}
