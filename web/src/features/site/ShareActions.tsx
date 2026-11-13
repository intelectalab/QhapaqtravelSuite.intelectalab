"use client";

import { Check, MessageCircle, Share2 } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { trackSiteEvent } from "@/lib/site-analytics";
import { useSite } from "./SiteContext";

function whatsappLink(base: string, text: string): string | null {
  try {
    const url = new URL(base);
    url.searchParams.set("text", text);
    return url.toString();
  } catch {
    return null;
  }
}

export function ShareActions({ slug, name, className }: { slug: string; name: string; className?: string }) {
  const { design, locale } = useSite();
  const [copied, setCopied] = useState(false);
  const en = locale === "en";
  const whatsapp = design?.footer.social.whatsapp ? whatsappLink(design.footer.social.whatsapp, en ? `Hello, I am interested in ${name}.` : `Hola, me interesa ${name}.`) : null;
  const share = async () => {
    trackSiteEvent("share", { item_id: slug });
    const url = window.location.href.split("#")[0];
    try {
      if (navigator.share) {
        await navigator.share({ title: name, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };
  const button = "inline-flex h-9 items-center justify-center gap-2 rounded-control border border-white/25 bg-white/10 px-3.5 text-[13px] font-semibold text-white backdrop-blur transition hover:-translate-y-0.5";
  return (
    <>
      <button type="button" onClick={share} className={cn(button, className)}>
        {copied ? <Check size={15} /> : <Share2 size={15} />}
        {copied ? (en ? "Link copied" : "Enlace copiado") : en ? "Share" : "Compartir"}
      </button>
      {whatsapp && (
        <a href={whatsapp} target="_blank" rel="noopener noreferrer" onClick={() => trackSiteEvent("contact_whatsapp", { item_id: slug, source: "product" })} className={cn(button, className)}>
          <MessageCircle size={15} />
          {en ? "Ask on WhatsApp" : "Consultar por WhatsApp"}
        </a>
      )}
    </>
  );
}
