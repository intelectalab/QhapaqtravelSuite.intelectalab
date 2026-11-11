"use client";

import { Archive, CircleCheck, CircleDashed, CirclePause, CirclePlay, CircleStop, Send, Trash2, Undo2 } from "lucide-react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { changeProductStatus, deleteProduct, type ProductActionState } from "@/app/(backoffice)/catalogo/productos/actions";
import { RowIcon } from "@/components/table/RowActions";
import { PanelAction } from "@/components/ui/PanelAction";
import { TextArea } from "@/components/ui/TextArea";
import { LIFECYCLE, type ProductDetail, type ProductFormOptions } from "@/lib/catalog";

const initial: ProductActionState = { message: null, done: false };

const ICONS: Record<string, ReactNode> = {
  "submit-review": <Send size={16} />,
  approve: <CircleCheck size={16} />,
  "return-to-draft": <Undo2 size={16} />,
  activate: <CirclePlay size={16} />,
  suspend: <CirclePause size={16} />,
  deactivate: <CircleStop size={16} />,
  archive: <Archive size={16} />,
};

export function ProductLifecycleActions({ product, options }: { product: ProductDetail; options: ProductFormOptions }) {
  const router = useRouter();
  const available = LIFECYCLE.filter((step) => step.from.includes(product.status) && (step.activate ? options.can_activate : options.can_update));

  return (
    <>
      {available.map((step) => (
        <PanelAction<ProductActionState>
          key={step.action}
          label={step.label}
          icon={ICONS[step.action]}
          variant={step.primary ? "primary" : step.action === "archive" ? "ghost" : "secondary"}
          formId={`product-${step.action}`}
          title={step.label}
          description={step.description}
          submitLabel={step.label}
          action={changeProductStatus}
          initial={initial}
          onDone={() => router.refresh()}
        >
          {(state) => (
            <>
              <input type="hidden" name="code" value={product.code} />
              <input type="hidden" name="action" value={step.action} />
              <input type="hidden" name="lock_version" value={product.lock_version} />
              {state.failed && state.failed.length > 0 && (
                <div className="rounded-xl border border-warn/30 bg-warn/[0.08] p-3.5 text-[13px]">
                  <p className="mb-2 font-semibold text-warn">Antes de activarlo falta</p>
                  <ul className="flex flex-col gap-1.5 text-fg-2">
                    {state.failed.map((item) => (
                      <li key={item.key} className="flex items-start gap-2">
                        <CircleDashed size={14} className="mt-0.5 flex-none text-warn" />
                        <span>
                          {item.label}
                          {item.detail && <span className="block text-[12px] text-fg-3">{item.detail}</span>}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {step.reason && <TextArea label="Motivo" name="reason" rows={3} required minLength={3} maxLength={500} placeholder="Queda registrado en el historial del producto." />}
            </>
          )}
        </PanelAction>
      ))}
    </>
  );
}

export function ProductDeleteAction({ product, iconOnly = false }: { product: Pick<ProductDetail, "code" | "name" | "lock_version">; iconOnly?: boolean }) {
  const router = useRouter();
  return (
    <PanelAction<ProductActionState>
      label="Eliminar"
      icon={<Trash2 size={16} />}
      variant="ghost"
      formId={`product-delete-${product.code}`}
      trigger={iconOnly ? (open) => <RowIcon tone="delete" label="Eliminar" onClick={open} /> : undefined}
      title="Eliminar producto"
      description={`${product.name} desaparecerá del catálogo. Solo se puede si nunca se usó en cotizaciones, reservas ni paquetes; si ya se usó, archívalo.`}
      submitLabel="Eliminar producto"
      action={deleteProduct}
      initial={initial}
      onDone={() => (iconOnly ? router.refresh() : router.push("/catalogo/productos"))}
    >
      {() => (
        <>
          <input type="hidden" name="code" value={product.code} />
          <input type="hidden" name="lock_version" value={product.lock_version} />
          <TextArea label="Motivo" name="reason" rows={3} required minLength={3} maxLength={500} placeholder="Por ejemplo: se creó por error." />
        </>
      )}
    </PanelAction>
  );
}
