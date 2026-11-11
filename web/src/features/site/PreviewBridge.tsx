"use client";

import { Eye, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";
import { PREVIEW_MESSAGE, siteThemeStyle, type SiteThemeVars } from "@/lib/site-design";

interface PreviewMessage {
  source: typeof PREVIEW_MESSAGE;
  action: "refresh" | "theme" | "navigate";
  theme?: SiteThemeVars;
  path?: string;
}

function isPreviewMessage(data: unknown): data is PreviewMessage {
  return typeof data === "object" && data !== null && (data as { source?: unknown }).source === PREVIEW_MESSAGE;
}

const subscribeNever = () => () => undefined;

export function PreviewBridge({ agencia }: { agencia: string }) {
  const router = useRouter();
  const embedded = useSyncExternalStore(subscribeNever, () => window.self !== window.top, () => true);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || !isPreviewMessage(event.data)) return;
      const message = event.data;
      if (message.action === "refresh") router.refresh();
      if (message.action === "navigate" && message.path?.startsWith("/")) router.push(message.path);
      if (message.action === "theme" && message.theme) {
        const root = document.getElementById("site-root");
        if (!root) return;
        for (const [key, value] of Object.entries(siteThemeStyle(message.theme))) {
          if (key === "fontFamily") root.style.fontFamily = String(value);
          else root.style.setProperty(key, String(value));
        }
      }
    };
    window.addEventListener("message", onMessage);
    window.parent?.postMessage({ source: PREVIEW_MESSAGE, action: "ready", path: window.location.pathname }, window.location.origin);
    return () => window.removeEventListener("message", onMessage);
  }, [router]);

  useEffect(() => {
    if (window.self === window.top) return;
    const links = (event: MouseEvent) => {
      const anchor = (event.target as HTMLElement).closest("a");
      if (anchor && anchor.target === "_blank") return;
      if (anchor && anchor.origin !== window.location.origin) event.preventDefault();
    };
    document.addEventListener("click", links, true);
    return () => document.removeEventListener("click", links, true);
  }, []);

  if (embedded) return null;

  return (
    <div className="sticky top-0 z-50 flex items-center justify-center gap-3 bg-warn px-4 py-2 text-[12.5px] font-semibold text-white" data-testid="site-preview-ribbon">
      <Eye size={15} />
      Vista previa del borrador: los visitantes todavía ven la versión publicada.
      <a href={`/sitio/${agencia}/vista-previa?salir=1`} className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-0.5 transition hover:bg-white/30">
        <LogOut size={13} />
        Ver como visitante
      </a>
    </div>
  );
}
