import type { ReactNode } from "react";
import { BackLink } from "./BackLink";
import { ScreenJump } from "./ScreenJump";
import { HeaderMotif, SectionBadge, SectionCrumb } from "./SectionTrail";

interface PageHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  back?: { href: string; label: string };
  info?: ReactNode;
  jump?: boolean;
  leading?: ReactNode;
}

export function PageHeader({ title, subtitle, actions, back, info, jump = true, leading }: PageHeaderProps) {
  return (
    <header className="relative isolate -mx-4 mb-5 overflow-hidden border-b border-line bg-surface px-4 pb-6 pt-5 sm:-mx-6 sm:px-6 xl:-mx-8 xl:px-8">
      <HeaderMotif />
      {back && (
        <div className="mb-3">
          <BackLink href={back.href}>{back.label}</BackLink>
        </div>
      )}
      <div className="flex items-center justify-between gap-3 sm:gap-6">
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          <span className="max-sm:hidden">{leading ?? <SectionBadge />}</span>
          <div className="min-w-0">
            {!back && <SectionCrumb />}
            <div className="mt-0.5 flex min-w-0 items-center gap-1.5">
              <h1 className="truncate text-[24px] font-bold leading-tight tracking-[-0.035em] sm:text-[30px]">{title}</h1>
              {info}
              {jump && <ScreenJump />}
            </div>
            {subtitle && <div className="mt-1 text-[13.5px] text-fg-3 max-sm:line-clamp-2">{subtitle}</div>}
          </div>
        </div>
        {actions && <div className="flex flex-none items-center gap-2 sm:gap-2.5">{actions}</div>}
      </div>
      <span aria-hidden className="weave-line absolute inset-x-0 -bottom-px h-1 opacity-90" />
    </header>
  );
}
