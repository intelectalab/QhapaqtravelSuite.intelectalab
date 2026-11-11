"use client";

import * as Tooltip from "@radix-ui/react-tooltip";
import { Layers, Route, Tag } from "lucide-react";
import Link from "next/link";
import { RowActions } from "@/components/table/RowActions";
import { Card, CardHeader } from "@/components/ui/Card";
import { BUBBLE } from "@/components/ui/InfoTip";
import { TintIcon } from "@/components/ui/Tinted";
import { cn } from "@/lib/cn";
import type { ProductCategory, TaxonomyOverview, TaxonomyProduct } from "@/lib/catalog-taxonomy";
import { CategoryCreateAction, CategoryDeleteAction, CategoryEditAction, SubcategoryCreateAction, SubcategoryDeleteAction, SubcategoryEditAction, TypeCreateAction, TypeDeleteAction, TypeEditAction } from "./TaxonomyForms";

function ProductsTip({ products }: { products: TaxonomyProduct[] }) {
  const label = products.length === 1 ? "1 producto" : `${products.length} productos`;
  if (!products.length) return <span className="flex-none text-[12.5px] text-fg-3">Sin productos</span>;
  return (
    <Tooltip.Provider delayDuration={150}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <span tabIndex={0} className="flex-none cursor-default font-mono text-[12.5px] font-semibold text-fg-2 underline decoration-dotted decoration-fg-3/50 underline-offset-4">
            {label}
          </span>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content sideOffset={6} collisionPadding={12} className={BUBBLE}>
            <ul className="grid gap-1.5">
              {products.slice(0, 12).map((product) => (
                <li key={product.code} className="flex justify-between gap-3">
                  <span className="truncate text-fg">{product.name}</span>
                  <span className="font-mono text-[11.5px] text-fg-3">{product.code}</span>
                </li>
              ))}
              {products.length > 12 && <li className="text-fg-3">y {products.length - 12} más</li>}
            </ul>
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}

function CategoryItem({ category, manage, index }: { category: ProductCategory; manage: boolean; index: number }) {
  return (
    <li className="lift rounded-xl border border-line-2 px-3.5 py-3 motion-safe:animate-[rise-in_420ms_cubic-bezier(0.22,1,0.36,1)_backwards] hover:border-line" style={{ animationDelay: `${index * 40}ms` }}>
      <div className="flex items-center gap-3">
        <TintIcon icon={Layers} size="sm" />
        <span className="min-w-0 flex-1">
          <b className="block truncate text-[14px] font-semibold">{category.name}</b>
          <small className="font-mono text-[11.5px] text-fg-3">{category.ref}</small>
        </span>
        <ProductsTip products={category.products} />
        {manage && (
          <RowActions>
            <SubcategoryCreateAction category={category} />
            <CategoryEditAction category={category} />
            <CategoryDeleteAction category={category} />
          </RowActions>
        )}
      </div>
      {category.subcategories.length > 0 ? (
        <ul className="ml-[42px] mt-2.5 flex flex-col border-l border-line-2 pl-3">
          {category.subcategories.map((sub) => (
            <li key={sub.id} className="group flex items-center gap-3 rounded-lg py-1 pl-2 pr-1 transition hover:bg-surface-2">
              <span className="min-w-0 flex-1 truncate text-[13px] text-fg-2 group-hover:text-fg">{sub.name}</span>
              <ProductsTip products={sub.products} />
              {manage && (
                <span className="flex items-center gap-1 opacity-60 transition group-hover:opacity-100 focus-within:opacity-100">
                  <SubcategoryEditAction category={category} sub={sub} />
                  <SubcategoryDeleteAction category={category} sub={sub} />
                </span>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="ml-[42px] mt-2 text-[12.5px] text-fg-3">Sin subcategorías.</p>
      )}
    </li>
  );
}

export function TaxonomyBoard({ overview }: { overview: TaxonomyOverview }) {
  const manage = overview.can.manage;
  return (
    <div className="grid items-start gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader title="Tipos de producto" subtitle="Definen qué pide el checklist para activar un producto." action={manage ? <TypeCreateAction /> : undefined} />
        <ul className="flex flex-col gap-2">
          {overview.types.map((type, index) => (
            <li key={type.id} className="lift flex items-center gap-3 rounded-xl border border-line-2 px-3.5 py-2.5 motion-safe:animate-[rise-in_420ms_cubic-bezier(0.22,1,0.36,1)_backwards] hover:border-line" style={{ animationDelay: `${index * 30}ms` }}>
              <TintIcon icon={type.requires_itinerary ? Route : Tag} size="sm" />
              <span className="min-w-0 flex-1">
                <b className="block truncate text-[13.5px] font-semibold">{type.name}</b>
                <small className={cn("block text-xs", type.requires_itinerary ? "text-accent" : "text-fg-3")}>
                  {type.requires_itinerary ? "Requiere itinerario" : "Itinerario opcional"}
                  {!type.requires_components && " · sin componentes obligatorios"}
                </small>
              </span>
              <ProductsTip products={type.products} />
              {manage && (
                <RowActions>
                  <TypeEditAction type={type} />
                  <TypeDeleteAction type={type} />
                </RowActions>
              )}
            </li>
          ))}
        </ul>
      </Card>
      <Card>
        <CardHeader title="Categorías y subcategorías" subtitle="Agrupan los productos por tema en el catálogo, el sitio y los reportes." action={manage ? <CategoryCreateAction /> : undefined} />
        <ul className="flex flex-col gap-2.5">
          {overview.categories.map((category, index) => (
            <CategoryItem key={category.id} category={category} manage={manage} index={index} />
          ))}
        </ul>
        <p className="mt-4 text-[12.5px] text-fg-3">
          Un tipo, una categoría o una subcategoría en uso no se elimina: cambia antes la clasificación del producto desde <Link href="/catalogo/productos" className="font-semibold text-accent hover:underline">Productos</Link>.
        </p>
      </Card>
    </div>
  );
}
