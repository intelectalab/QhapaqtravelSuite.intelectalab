import { Box, CalendarRange, Check, ClipboardList, Clock, Coins, MapPin, ScrollText, ShieldCheck, Tag, Truck, UserRound, Users, X } from "lucide-react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { FieldList } from "@/components/ui/Details";
import { HeroBand, HeroChip, HeroPanel, TintCardTitle, TintTile, ToneScope } from "@/components/ui/Tinted";
import { cn } from "@/lib/cn";
import { durationLabel, PRODUCT_STATUS } from "@/lib/catalog";
import { formatDate, formatMoney } from "@/lib/format";
import { getProduct, getProductFormOptions } from "@/lib/server/catalog";
import { ProductDeleteAction, ProductEditAction, ProductLifecycleActions } from "@/features/catalog/ProductForms";
import { ProductHighlights } from "@/features/catalog/ProductHighlights";

export async function generateMetadata({ params }: PageProps<"/catalogo/productos/[code]">): Promise<Metadata> {
  const { code } = await params;
  return { title: (await getProduct(code)).name };
}

export default async function ProductoPage({ params, searchParams }: PageProps<"/catalogo/productos/[code]">) {
  const { code } = await params;
  const { editar } = await searchParams;
  const [product, options] = await Promise.all([getProduct(code), getProductFormOptions()]);
  const status = PRODUCT_STATUS[product.status];
  const sale = product.rates.filter((rate) => rate.active && rate.type === "Venta" && ["Adulto", "Pasajero"].includes(rate.segment)).sort((a, b) => Number(a.price) - Number(b.price))[0];
  const showCost = product.rates.some((rate) => rate.cost !== null);

  return (
    <ToneScope tone={status.tone}>
      <PageHeader
        back={{ href: "/catalogo/productos", label: "Productos" }}
        jump={false}
        leading={
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-[var(--tint)] text-white shadow-[0_10px_24px_-12px_var(--tint)]">
            <Box size={24} />
          </span>
        }
        title={product.name}
        info={
          <span className="ml-2 flex-none">
            <Badge tone={status.tone}>{status.label}</Badge>
          </span>
        }
        subtitle={`${product.code} · ${product.sku}`}
        actions={
          options ? (
            <>
              {options.can_update && product.status !== "ARCHIVED" && <ProductEditAction product={product} options={options} defaultOpen={editar === "1"} />}
              <ProductLifecycleActions product={product} options={options} />
              {options.can_activate && !["ACTIVE", "SUSPENDED"].includes(product.status) && <ProductDeleteAction product={product} />}
            </>
          ) : undefined
        }
      />

      <HeroBand>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
          <div>
            <p className="text-[13px] font-medium text-white/70">{sale ? `Desde, por ${sale.segment === "Adulto" ? "adulto" : "pasajero"}` : "Precio"}</p>
            <p className="mt-1 text-[38px] font-bold leading-none tracking-[-0.03em]">{sale ? formatMoney(sale.price, sale.currency) : "Sin tarifa"}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <HeroChip icon={<Clock size={14} />}>
                {durationLabel(product.duration)} · {product.modality.toLowerCase()}
              </HeroChip>
              <HeroChip icon={<Users size={14} />}>
                {product.pax.min === product.pax.max ? `${product.pax.min} pasajeros` : `${product.pax.min} a ${product.pax.max} pasajeros`}
              </HeroChip>
              <HeroChip icon={<MapPin size={14} />}>{product.destination_path}</HeroChip>
            </div>
          </div>
          <HeroPanel solid>
            <ProductHighlights product={product} />
          </HeroPanel>
        </div>
      </HeroBand>

      <section className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <TintTile icon={Tag} tone="violet" label="Categoría" value={<span className="text-[16px]">{product.category}</span>} note={product.subcategory ?? undefined} />
        <TintTile icon={Truck} tone="t1" label="Proveedor principal" value={<span className="text-[16px]">{product.provider?.name ?? "Sin asignar"}</span>} note={product.provider?.type} />
        <TintTile icon={CalendarRange} tone="sun" label="Reserva con anticipación" value={<span className="text-[16px]">{product.advance_days.min === 0 ? "El mismo día" : `${product.advance_days.min} días`}</span>} note={`Hasta ${product.advance_days.max} días antes`} />
        <TintTile icon={UserRound} tone="t4" label="Edades" value={<span className="text-[16px]">{product.age.min === 0 && product.age.max >= 99 ? "Todas" : `${product.age.min} a ${product.age.max} años`}</span>} />
      </section>

      <div className="mb-5 grid items-start gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <Card>
          <TintCardTitle icon={ClipboardList} title="Itinerario" aside={product.itinerary.length > 1 ? `${product.itinerary.length} días` : undefined} />
          {product.itinerary.length === 0 ? (
            <p className="text-[13.5px] text-fg-3">Este producto no tiene itinerario cargado.</p>
          ) : (
            <ol className="flex flex-col gap-4">
              {product.itinerary.map((day) => (
                <li key={day.day}>
                  <p className="mb-2 flex items-center gap-2 text-[13.5px] font-semibold">
                    <span className="grid h-6 min-w-6 place-items-center rounded-full bg-[var(--tint)] px-1.5 text-[11.5px] font-bold text-white">{day.day}</span>
                    {day.title}
                  </p>
                  <ul className="ml-3 flex flex-col border-l-2 border-[color-mix(in_srgb,var(--tint)_30%,transparent)] pl-4">
                    {day.items.map((item, index) => (
                      <li key={`${day.day}-${index}`} className="relative py-1.5 text-[13px]">
                        <span className="absolute -left-[21px] top-3 h-2 w-2 rounded-full bg-[var(--tint)]" />
                        {item.time && <span className="mr-2 font-mono text-[12px] font-semibold text-fg-2">{item.time}</span>}
                        {item.activity}
                        {item.location && <span className="block text-[12px] text-fg-3">{item.location}</span>}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
          )}
        </Card>

        <div className="flex flex-col gap-5">
          <Card>
            <TintCardTitle icon={Check} title="Qué incluye" />
            <ul className="flex flex-col gap-1.5">
              {product.includes.map((text) => (
                <li key={text} className="flex items-start gap-2 text-[13px]">
                  <Check size={15} strokeWidth={2.6} className="mt-0.5 flex-none text-ok" />
                  {text}
                </li>
              ))}
            </ul>
            {product.excludes.length > 0 && (
              <>
                <p className="mb-1.5 mt-4 text-[13px] font-semibold text-fg-2">No incluye</p>
                <ul className="flex flex-col gap-1.5">
                  {product.excludes.map((text) => (
                    <li key={text} className="flex items-start gap-2 text-[13px] text-fg-2">
                      <X size={15} strokeWidth={2.4} className="mt-0.5 flex-none text-fg-3" />
                      {text}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Card>
          {product.requirements.length > 0 && (
            <Card>
              <TintCardTitle icon={ShieldCheck} title="Requisitos" />
              <ul className="flex flex-col gap-1.5 text-[13px] text-fg-2">
                {product.requirements.map((text) => (
                  <li key={text}>{text}</li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-2">
        <Card>
          <TintCardTitle icon={Coins} title="Tarifas" aside={`${product.rates.filter((rate) => rate.active).length} vigentes`} />
          <ul className="flex flex-col">
            {product.rates.map((rate) => (
              <li key={rate.ref} className={cn("grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 border-t border-line-2 py-2.5 first:border-t-0", !rate.active && "opacity-55")}>
                <span className="min-w-0">
                  <b className="block text-[13.5px] font-semibold">
                    {rate.type} · {rate.segment}
                  </b>
                  <span className="text-xs text-fg-3">
                    {rate.channel} · {rate.basis.toLowerCase()} · {formatDate(rate.valid_from)} al {formatDate(rate.valid_to)}
                    {!rate.active && " · vencida"}
                  </span>
                </span>
                <span className="text-right">
                  <b className="block font-mono text-[13.5px]">{formatMoney(rate.price, rate.currency)}</b>
                  {showCost && rate.cost !== null && <span className="text-xs text-fg-3">Costo {formatMoney(rate.cost, rate.currency)} · {rate.margin_pct} %</span>}
                </span>
              </li>
            ))}
          </ul>
        </Card>
        {product.policies && (
          <Card>
            <TintCardTitle icon={ScrollText} title="Políticas" />
            <FieldList
              fields={[
                { label: "Cancelación", value: <span className="whitespace-normal">{product.policies.cancellation}</span> },
                { label: "Cambios", value: <span className="whitespace-normal">{product.policies.modification}</span> },
                { label: "No presentarse", value: <span className="whitespace-normal">{product.policies.no_show}</span> },
                { label: "Reembolsos", value: <span className="whitespace-normal">{product.policies.refund}</span> },
              ]}
            />
          </Card>
        )}
      </div>
    </ToneScope>
  );
}
