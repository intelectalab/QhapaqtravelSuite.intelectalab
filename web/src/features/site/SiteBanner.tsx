"use client";

import { Megaphone, X } from "lucide-react";
import { useState } from "react";
import { InfoTip } from "@/components/ui/InfoTip";
import { useSite } from "./SiteContext";

export function SiteBanner({ title, body }: { title: string; body: string }) {
  const { t } = useSite();
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;

  return (
    <div className="relative bg-menu text-white">
      <div className="mx-auto flex min-h-10 max-w-[1240px] items-center gap-3 px-4 py-2 text-[12.5px] sm:px-8">
        <Megaphone size={15} className="flex-none text-t2" />
        <span className="min-w-0 flex-1 truncate">
          <b className="font-semibold">{title}</b>
          <span className="hidden text-white/65 md:inline"> · {body}</span>
        </span>
        <InfoTip label={t.common.bannerDetail} className="md:hidden">
          {body}
        </InfoTip>
        <button type="button" onClick={() => setHidden(true)} aria-label={t.common.bannerHide} className="grid h-7 w-7 flex-none place-items-center rounded-lg text-white/60 transition hover:bg-white/10 hover:text-white">
          <X size={15} />
        </button>
      </div>
    </div>
  );
}
