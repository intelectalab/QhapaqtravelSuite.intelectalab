"use client";

import { ArrowRight, Megaphone, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { InfoTip } from "@/components/ui/InfoTip";
import { siteHref } from "@/lib/site";
import type { SiteBannerData } from "@/lib/site-design";
import { useSite } from "./SiteContext";

export function SiteBanner({ banner, base }: { banner: SiteBannerData; base: string }) {
  const { t } = useSite();
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;
  const href = banner.link_href ? (banner.link_href.startsWith("/") ? siteHref(base, banner.link_href) : banner.link_href) : null;

  return (
    <div className="relative bg-menu text-white" data-testid="site-banner">
      <div className="mx-auto flex min-h-10 max-w-[1240px] items-center gap-3 px-4 py-2 text-[12.5px] sm:px-8">
        <Megaphone size={15} className="flex-none text-t2" />
        <span className="min-w-0 flex-1 truncate">
          <b className="font-semibold">{banner.title}</b>
          {banner.body && <span className="hidden text-white/65 md:inline"> · {banner.body}</span>}
        </span>
        {banner.body && (
          <InfoTip label={t.common.bannerDetail} className="md:hidden">
            {banner.body}
          </InfoTip>
        )}
        {href && banner.link_label && (
          <Link href={href} className="group inline-flex flex-none items-center gap-1 rounded-full bg-white/10 px-3 py-1 font-semibold transition hover:bg-white/20" {...(href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
            {banner.link_label}
            <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" />
          </Link>
        )}
        <button type="button" onClick={() => setHidden(true)} aria-label={t.common.bannerHide} className="grid h-7 w-7 flex-none place-items-center rounded-lg text-white/60 transition hover:bg-white/10 hover:text-white">
          <X size={15} />
        </button>
      </div>
    </div>
  );
}
