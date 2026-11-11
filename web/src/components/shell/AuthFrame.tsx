import type { ReactNode } from "react";
import { BrandMark } from "./BrandMark";

interface AuthFrameProps {
  headline: ReactNode;
  description: string;
  footnote?: string;
  children: ReactNode;
}

export function AuthFrame({ headline, description, footnote, children }: AuthFrameProps) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <aside className="relative hidden overflow-hidden bg-menu p-12 text-white lg:flex lg:flex-col">
        <div className="weave-band absolute inset-x-0 top-0 h-2" />
        <div className="weave-tint absolute inset-0 bg-white opacity-[0.05] [mask-size:36px_36px]" />
        <div className="absolute -right-24 bottom-0 h-[420px] w-[420px] rounded-full bg-t1 opacity-40 blur-[120px]" />
        <div className="relative flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-white">
            <BrandMark size={26} />
          </span>
          <span className="leading-tight">
            <b className="block text-lg font-bold tracking-tight">KipuControl</b>
          </span>
        </div>
        <div className="relative mt-auto max-w-md">
          <h1 className="text-[40px] font-bold leading-[1.08] tracking-[-0.04em]">{headline}</h1>
          <p className="mt-5 text-[15px] leading-relaxed text-white/65">{description}</p>
        </div>
        {footnote && <p className="relative mt-12 text-[12.5px] text-white/40">{footnote}</p>}
      </aside>
      <main className="flex items-center justify-center px-5 py-12 sm:px-10">
        <div className="w-full max-w-[400px]">
          <div className="mb-10 flex items-center gap-2.5 lg:hidden">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-menu">
              <BrandMark size={22} />
            </span>
            <b className="text-lg font-bold tracking-tight">KipuControl</b>
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
