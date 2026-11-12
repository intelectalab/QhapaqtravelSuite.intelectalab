import { Baby, BadgePercent, BedDouble, Boxes, Box, CalendarRange, ChartPie, Clock, Coins, FileText, GitBranch, History, Link2, ListChecks, LayoutDashboard, MapPin, MapPinned, PackagePlus, Radio, Route, ScrollText, ShieldCheck, ShoppingBag, SlidersHorizontal, Truck, Users, Wallet, Warehouse, type LucideIcon } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shell/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { SectionLayout, SectionNav } from "@/components/ui/SectionNav";
import { HeroBand, HeroChip, HeroPanel, ToneScope } from "@/components/ui/Tinted";
import { durationLabel, PRODUCT_STATUS } from "@/lib/catalog";
import { formatMoney } from "@/lib/format";
import { resolveSections } from "@/lib/sections";
import type { PromotionCatalog } from "@/lib/channels";
import { getProduct, getProductBookingConfig, getProductEditor, getProductFormOptions, getProductOverview, getProductTranslations } from "@/lib/server/catalog";
import { getResource } from "@/lib/server/resource";
import { ProductDeleteAction, ProductLifecycleActions } from "@/features/catalog/ProductForms";
import { ProductHighlights } from "@/features/catalog/ProductHighlights";
import { ProductLifecycle, ProductStatusNotice } from "@/features/catalog/product360/ProductHeader";
import { PRODUCT_SECTION_GROUPS, productTabs } from "@/features/catalog/product360/ProductTabs";
import { DownloadButton } from "@/components/ui/DownloadButton";
import { DuplicateProductAction } from "@/features/catalog/product360/ProductVersionTools";
import { ProductWizardAction } from "@/features/catalog/wizard/ProductWizard";

const SECTION_ICONS: Record<string, LucideIcon> = {
  general: LayoutDashboard,
  contenido: FileText,
  politicas: ScrollText,
  inclusiones: ListChecks,
  personalizacion: SlidersHorizontal,
  componentes: Boxes,
  itinerario: Route,
  proveedores: Truck,
  disponibilidad: Warehouse,
  salidas: CalendarRange,
  tarifas: Coins,
  temporadas: Clock,
  rentabilidad: ChartPie,
  promociones: BadgePercent,
  b2b: Users,
  canales: Radio,
  relacionados: Link2,
  uso: ShoppingBag,
  versiones: GitBranch,
  historial: History,
  pasajeros: Baby,
  adicionales: PackagePlus,
  alojamiento: BedDouble,
  pago: Wallet,
  recojo: MapPinned,
  reglas: ShieldCheck,
};

export async function generateMetadata({ params }: PageProps<"/catalogo/productos/[code]">): Promise<Metadata> {
  const { code } = await params;
  return { title: (await getProduct(code)).name };
}

export default async function ProductoPage({ params, searchParams }: PageProps<"/catalogo/productos/[code]">) {
  const { code } = await params;
  const { editar, seccion } = await searchParams;
  const [product, options, translations, editor, overview, booking] = await Promise.all([getProduct(code), getProductFormOptions(), getProductTranslations(code), getProductEditor(code), getProductOverview(code), getProductBookingConfig(code)]);
  if (!options || !editor || !overview) notFound();
  const promotions = seccion === "promociones" && options.can_update ? await getResource<PromotionCatalog>("/channels/ecommerce/promotions", "No pudimos cargar las promociones.") : null;

  const status = PRODUCT_STATUS[product.status];
  const editable = options.can_update && product.status !== "ARCHIVED";
  const sale = product.rates.filter((rate) => rate.active && rate.type === "Venta" && ["Adulto", "Pasajero"].includes(rate.segment)).sort((a, b) => Number(a.price) - Number(b.price))[0];
  const tabs = productTabs({ product, editor, overview, options, translations, promotions, booking });
  const base = `/catalogo/productos/${encodeURIComponent(product.code)}`;
  const { active: activeId, groups } = resolveSections(
    base,
    PRODUCT_SECTION_GROUPS.flatMap((group) =>
      group.ids.map((id) => {
        const tab = tabs.find((item) => item.id === id);
        const Icon = SECTION_ICONS[id];
        return { group: group.title, id, label: tab?.label ?? id, count: tab?.count, icon: Icon ? <Icon size={15} /> : undefined, show: tab !== undefined };
      }),
    ),
    seccion,
  );
  const active = tabs.find((tab) => tab.id === activeId) ?? tabs[0];

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
        subtitle={`${product.code} · SKU ${product.sku} · ${product.type} · ${product.category}${product.subcategory ? ` › ${product.subcategory}` : ""}`}
        actions={
          <>
            {editable && <ProductWizardAction options={options} initial={editor} defaultOpen={editar === "1"} />}
            <ProductLifecycleActions product={product} options={options} />
            <DownloadButton href={`/catalogo/productos/${encodeURIComponent(product.code)}/ficha`} label="Ficha comercial" pendingLabel="Generando…" />
            {options.can_create && <DuplicateProductAction code={product.code} name={product.name} />}
            {options.can_activate && !["ACTIVE", "SUSPENDED"].includes(product.status) && <ProductDeleteAction product={product} />}
          </>
        }
      />

      <ProductStatusNotice product={product} overview={overview} />

      <HeroBand>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
          <div>
            <p className="text-[13px] font-medium text-white/70">{sale ? `Desde, por ${sale.segment === "Adulto" ? "adulto" : "pasajero"}` : "Precio"}</p>
            <p className="mt-1 text-[38px] font-bold leading-none tracking-[-0.03em]">{sale ? formatMoney(sale.price, sale.currency) : "Sin tarifa"}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <HeroChip icon={<Clock size={14} />}>
                {durationLabel(product.duration)} · {product.modality.toLowerCase()}
              </HeroChip>
              <HeroChip icon={<Users size={14} />}>{product.pax.min === product.pax.max ? `${product.pax.min} pasajeros` : `${product.pax.min} a ${product.pax.max} pasajeros`}</HeroChip>
              <HeroChip icon={<MapPin size={14} />}>{product.destination_path}</HeroChip>
            </div>
          </div>
          <HeroPanel solid>
            <ProductHighlights product={product} />
          </HeroPanel>
        </div>
      </HeroBand>

      <ProductLifecycle product={product} overview={overview} seesCost={options.sees_cost} seesMargin={options.sees_margin} />

      <SectionLayout nav={<SectionNav label="Secciones del producto" groups={groups} active={active.id} testId="product-sections" />}>
        <div key={active.id} className="motion-safe:animate-[rise-in_280ms_ease-out_backwards]">
          {active.render()}
        </div>
      </SectionLayout>
    </ToneScope>
  );
}
