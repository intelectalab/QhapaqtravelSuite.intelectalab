"use client";

import { Download, LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { Button } from "./Button";

interface DownloadButtonProps {
  href: string;
  label?: string;
  pendingLabel?: string;
  variant?: "primary" | "secondary" | "ghost" | "dark";
  size?: "md" | "sm";
  iconOnly?: boolean;
  iconOnlyOnMobile?: boolean;
  className?: string;
  testId?: string;
}

function fileNameFrom(disposition: string | null): string | null {
  if (!disposition) return null;
  const encoded = /filename\*=UTF-8''([^;]+)/i.exec(disposition);
  if (encoded) return decodeURIComponent(encoded[1]);
  const plain = /filename="?([^";]+)"?/i.exec(disposition);
  return plain ? plain[1] : null;
}

export function DownloadButton({ href, label = "Descargar PDF", pendingLabel = "Preparando…", variant = "secondary", size = "md", iconOnly = false, iconOnlyOnMobile = false, className, testId }: DownloadButtonProps) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!error) return;
    const timer = window.setTimeout(() => setError(null), 7000);
    return () => window.clearTimeout(timer);
  }, [error]);

  async function download() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch(href, { cache: "no-store" });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { message?: string } | null;
        setError(payload?.message ?? "No pudimos descargar el documento.");
        return;
      }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = fileNameFrom(response.headers.get("content-disposition")) ?? "documento.pdf";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch {
      setError("No pudimos conectar con el servidor. Inténtalo de nuevo.");
    } finally {
      setPending(false);
    }
  }

  return (
    <span className={cn("relative inline-flex", className)}>
      <Button
        variant={variant}
        size={size}
        iconOnly={iconOnly}
        iconOnlyOnMobile={iconOnlyOnMobile}
        label={label}
        data-testid={testId}
        aria-busy={pending}
        disabled={pending}
        onClick={download}
        icon={pending ? <LoaderCircle size={size === "sm" ? 14 : 16} className="animate-spin" /> : <Download size={size === "sm" ? 14 : 16} />}
      >
        {pending ? pendingLabel : label}
      </Button>
      {error && (
        <span role="alert" className="absolute right-0 top-full z-10 mt-1.5 w-max max-w-[280px] rounded-[10px] border border-[color-mix(in_srgb,var(--bad)_30%,transparent)] bg-surface px-3 py-2 text-left text-[12px] leading-snug text-bad shadow-card">
          {error}
        </span>
      )}
    </span>
  );
}
