import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CartSummary } from "@/features/site/Cart";
import { CheckoutWizard } from "@/features/site/CheckoutWizard";
import { Breadcrumbs, PageHero } from "@/features/site/Hero";
import { capitalize, formatDate, formatMoney } from "@/lib/format";
import { getCheckoutTerms, getSiteCart, getSiteProfile, siteBase } from "@/lib/server/site";
import { siteHref } from "@/lib/site";

export const metadata: Metadata = { title: "Finalizar compra", robots: { index: false, follow: false } };

export default async function CheckoutPage({ params }: PageProps<"/sitio/[agencia]/checkout">) {
  const { agencia } = await params;
  const [cart, base, terms, profile] = await Promise.all([getSiteCart(agencia), siteBase(agencia), getCheckoutTerms(agencia), getSiteProfile(agencia)]);
  if (cart.items.length === 0 || cart.items.some((item) => item.quote === null) || terms === null) redirect(siteHref(base, "/carrito"));

  return (
    <>
      <PageHero eyebrow="Reserva" title="Finalizar compra" description="Completa los datos en pocos pasos. Te enviaremos la confirmación por correo.">
        <div className="mt-5">
          <Breadcrumbs items={[{ label: "Inicio", href: siteHref(base) }, { label: "Carrito", href: siteHref(base, "/carrito") }, { label: "Finalizar compra" }]} />
        </div>
      </PageHero>
      <div className="mx-auto grid max-w-[1240px] gap-6 px-5 pt-10 sm:px-8 lg:grid-cols-[1fr_360px]">
        <CheckoutWizard terms={terms} walletPhone={profile.agency.phone} />
        <aside className="grid gap-4 lg:sticky lg:top-24 lg:self-start">
          <ul className="grid gap-2">
            {cart.items.map((item) => (
              <li key={item.line} className="rounded-2xl border border-line bg-surface px-4 py-3 text-[13px]">
                <b className="block font-semibold text-fg">{item.product.name}</b>
                <span className="text-fg-3">{capitalize(formatDate(item.date, "long"))}</span>
                {item.quote && <span className="float-right font-semibold tabular-nums text-fg">{formatMoney(item.quote.total, item.quote.currency)}</span>}
              </li>
            ))}
          </ul>
          <CartSummary cart={cart} />
        </aside>
      </div>
    </>
  );
}
