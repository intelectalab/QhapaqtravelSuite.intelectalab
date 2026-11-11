"use client";

import { Check, Copy, Link2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FieldList } from "@/components/ui/Details";
import { TintCardTitle } from "@/components/ui/Tinted";
import { formatDate, formatDateTime } from "@/lib/format";
import type { QuoteDetail } from "@/lib/quotes";
import { QuoteTokenAction } from "./QuoteActions";

export function QuoteShareCard({ quote }: { quote: QuoteDetail }) {
  const share = quote.share;
  const [copied, setCopied] = useState(false);
  if (!share) return null;
  const closed = ["convertida", "rechazada"].includes(quote.status);
  const copy = async () => {
    if (!share.url) return;
    await navigator.clipboard.writeText(share.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <Card>
      <TintCardTitle icon={Link2} title="Enlace seguro" aside={!closed && quote.status !== "borrador" ? <QuoteTokenAction code={quote.code} lockVersion={quote.lock_version} regenerate={share.active} /> : undefined} />
      {share.active && share.url ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 rounded-xl bg-surface-2 px-3 py-2">
            <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-fg-2" title={share.url}>
              {share.url}
            </span>
            <Button size="sm" variant="ghost" icon={copied ? <Check size={14} /> : <Copy size={14} />} onClick={copy} data-testid="quote-share-copy">
              {copied ? "Copiado" : "Copiar"}
            </Button>
          </div>
          <FieldList
            fields={[
              { label: "Vence", value: share.expires_at ? formatDate(share.expires_at) : "—" },
              { label: "Creado", value: share.created_at ? formatDateTime(share.created_at) : "—" },
              { label: "Última vista", value: share.last_view_at ? `${formatDateTime(share.last_view_at)}${share.last_view_source === "portal" ? " · por el enlace" : " · registrada a mano"}` : "Aún no la abre" },
            ]}
          />
        </div>
      ) : (
        <p className="text-[13.5px] text-fg-3">{quote.status === "borrador" ? "El enlace se crea al enviar la cotización." : "No hay un enlace activo. Genera uno para compartir la propuesta."}</p>
      )}
    </Card>
  );
}
