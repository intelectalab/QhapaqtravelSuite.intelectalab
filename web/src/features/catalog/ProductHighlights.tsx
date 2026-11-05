import { Check, CircleDashed, Quote } from "lucide-react";
import { SOFT_TINT } from "@/components/ui/Tinted";
import { cn } from "@/lib/cn";
import type { ProductDetail } from "@/lib/catalog";

const stagger = (index: number) => ({ animationDelay: `${120 + index * 70}ms` });

export function ProductHighlights({ product }: { product: ProductDetail }) {
  const checks = [
    { label: "Descripción", ok: Boolean(product.short_description) },
    { label: "Proveedor principal", ok: Boolean(product.provider) },
    { label: "Itinerario", ok: product.itinerary.length > 0 },
    { label: "Qué incluye", ok: product.includes.length > 0 },
    { label: "Tarifa vigente", ok: product.rates.some((rate) => rate.active) },
    { label: "Políticas", ok: Boolean(product.policies) },
  ];
  const missing = checks.filter((check) => !check.ok);
  const highlights = product.includes.slice(0, 4);
  const showIncludes = highlights.length > 0;

  return (
    <div className="group/panel grid h-full gap-4 sm:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
      <div className="flex flex-col">
        <Quote size={22} className="mb-1.5 text-[var(--tint)] opacity-60 transition-transform duration-500 ease-out group-hover/panel:-translate-y-0.5 group-hover/panel:-rotate-6 group-hover/panel:opacity-90" />
        {product.short_description ? (
          <p className="text-[14px] leading-relaxed text-fg-2">{product.short_description}</p>
        ) : (
          <p className="text-[14px] text-fg-3">Este producto todavía no tiene descripción.</p>
        )}
        <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-3">
          <span className="mr-0.5 text-[12px] text-fg-3">Se vende en</span>
          {product.channels.map((channel) => (
            <span key={channel} className={cn("rounded-full px-2.5 py-1 text-[12px] font-semibold text-[var(--tint)] transition-transform duration-200 hover:-translate-y-0.5", SOFT_TINT)}>
              {channel}
            </span>
          ))}
        </div>
      </div>

      <div className={cn("relative overflow-hidden rounded-[14px] p-3.5 transition-shadow duration-300 group-hover/panel:shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--tint)_30%,transparent)]", SOFT_TINT)}>
        <span aria-hidden className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-[var(--tint)] opacity-[0.07] transition-transform duration-700 ease-out group-hover/panel:scale-150" />
        <p className="relative mb-2 text-[12px] font-semibold text-[var(--tint)]">{showIncludes ? "Lo más importante que incluye" : missing.length > 0 ? "Para venderlo falta" : "Ficha completa"}</p>
        <ul className="relative flex flex-col gap-1.5 text-[13px]">
          {showIncludes
            ? highlights.map((text, index) => (
                <li key={text} style={stagger(index)} className="flex items-start gap-1.5 transition-transform duration-200 hover:translate-x-1 motion-safe:animate-[drop-in_320ms_ease-out_both]">
                  <Check size={14} strokeWidth={2.6} className="mt-0.5 flex-none text-ok" />
                  {text}
                </li>
              ))
            : missing.map((check, index) => (
                <li key={check.label} style={stagger(index)} className="flex items-center gap-1.5 text-fg-2 transition-transform duration-200 hover:translate-x-1 motion-safe:animate-[drop-in_320ms_ease-out_both]">
                  <CircleDashed size={14} className="flex-none text-fg-3 transition-transform duration-700 group-hover/panel:rotate-180" />
                  {check.label}
                </li>
              ))}
        </ul>
        {showIncludes && product.includes.length > highlights.length && <p className="relative mt-2 text-[12px] text-fg-3">y {product.includes.length - highlights.length} más en el detalle</p>}
      </div>
    </div>
  );
}
