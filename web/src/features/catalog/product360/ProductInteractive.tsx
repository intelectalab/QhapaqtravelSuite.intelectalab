"use client";

import { ArrowRight, CircleCheck, CircleX } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { publishProductChannel } from "@/app/(backoffice)/catalogo/productos/wizard-actions";
import { Badge } from "@/components/ui/Badge";
import { SwitchField } from "@/components/ui/SwitchField";
import { cn } from "@/lib/cn";
import { CHANNEL_INFO, CHECK_STEP, PRODUCT_STEPS, type ChecklistItem, type ProductEditorState, type ProductFormOptions } from "@/lib/catalog";
import { ProductWizardAction } from "../wizard/ProductWizard";

export function ChecklistLinks({ items, options, editor }: { items: ChecklistItem[]; options: ProductFormOptions; editor: ProductEditorState | null }) {
  const editable = Boolean(editor) && options.can_update && editor?.status !== "ARCHIVED";
  const list = (open?: (step?: number) => void) => (
    <ul className="flex flex-col gap-1" data-testid="product-checklist">
      {items.map((item) => {
        const step = item.ok ? undefined : CHECK_STEP[item.key];
        const body = (
          <>
            {item.ok ? <CircleCheck size={17} className="mt-0.5 flex-none text-ok" /> : <CircleX size={17} className="mt-0.5 flex-none text-bad" />}
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-medium">{item.label}</span>
              {item.detail && <span className="block text-[12px] text-fg-3">{item.detail}</span>}
            </span>
            {open && step !== undefined && (
              <span className="inline-flex flex-none items-center gap-1 self-center text-[12px] font-semibold text-accent opacity-0 transition group-hover:opacity-100">
                {PRODUCT_STEPS[step]}
                <ArrowRight size={13} />
              </span>
            )}
          </>
        );
        return (
          <li key={item.key}>
            {open && step !== undefined ? (
              <button type="button" data-testid={`check:${item.key}`} onClick={() => open(step)} className="group flex w-full items-start gap-2.5 rounded-xl px-2.5 py-2 text-left transition hover:bg-bad/[0.06]">
                {body}
              </button>
            ) : (
              <div className={cn("flex items-start gap-2.5 rounded-xl px-2.5 py-2", item.ok && "opacity-70")}>{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );

  if (!editable || !editor) return list();
  return <ProductWizardAction options={options} initial={editor} trigger={(open) => list(open)} />;
}

export function ChannelSwitches({ code, active, chosen, canPublish }: { code: string; active: boolean; chosen: string[]; canPublish: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-3">
      {Object.entries(CHANNEL_INFO).map(([channel, info]) => {
        const on = channel === "erp" || chosen.includes(channel);
        return (
          <div key={channel} className="lift flex items-center justify-between gap-3 rounded-[14px] border border-line px-3.5 py-3">
            <SwitchField
              name={`publish.${channel}`}
              label={info.label}
              hint={info.hint}
              checked={on}
              disabled={!active || !canPublish || channel === "erp" || busy !== null}
              onCheckedChange={async (next) => {
                setBusy(channel);
                setError(null);
                const result = await publishProductChannel(code, channel, next);
                setBusy(null);
                if (!result.ok) return setError(result.error.message);
                router.refresh();
              }}
            />
            <Badge tone={on ? (active ? "ok" : "info") : "mute"}>{on ? (active ? "Publicado" : "Solicitado") : "Apagado"}</Badge>
          </div>
        );
      })}
      {error && <p role="alert" className="text-[13px] text-bad">{error}</p>}
      {!active && <p className="text-[12.5px] text-fg-3">Mientras el producto no esté activo, los canales elegidos quedan solicitados; se cambian desde «Editar», paso Publicar.</p>}
    </div>
  );
}
