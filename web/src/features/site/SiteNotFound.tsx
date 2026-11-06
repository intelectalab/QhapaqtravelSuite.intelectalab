"use client";

import { Compass } from "lucide-react";
import Link from "next/link";
import { useSite } from "./SiteContext";

export function SiteNotFound() {
  const { href } = useSite();
  return (
    <div className="mx-auto grid max-w-[640px] place-items-center px-5 py-24 text-center">
      <span className="grid h-14 w-14 place-items-center rounded-2xl bg-[color-mix(in_srgb,var(--brand)_10%,transparent)] text-brand">
        <Compass size={26} />
      </span>
      <h1 className="mt-5 text-[26px] font-bold tracking-tight text-fg">Esta página no está disponible</h1>
      <p className="mt-2 text-[14.5px] leading-relaxed text-fg-2">El producto o destino que buscas no está publicado para la venta en línea. Podemos cotizarlo a tu medida o puedes revisar el catálogo vigente.</p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Link href={href("/tours")} className="inline-flex h-11 items-center rounded-control border border-line px-5 text-[14px] font-semibold text-fg transition hover:bg-surface-2">
          Ver catálogo
        </Link>
        <Link href={href("/viajes-a-medida")} className="inline-flex h-11 items-center rounded-control bg-brand px-5 text-[14px] font-semibold text-brand-fg transition hover:-translate-y-0.5">
          Cotizar a medida
        </Link>
      </div>
    </div>
  );
}
