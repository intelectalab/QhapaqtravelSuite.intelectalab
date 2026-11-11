import { Heart } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/ui/EmptyState";
import { WishButton } from "@/features/site/Account";
import { ProductCard } from "@/features/site/Cards";
import { requireAccount, siteBase } from "@/lib/server/site";
import { siteHref, type ProductCard as Product } from "@/lib/site";

export default async function AccountWishlistPage({ params }: PageProps<"/sitio/[agencia]/cuenta/deseos">) {
  const { agencia } = await params;
  const [{ items }, base] = await Promise.all([requireAccount<{ items: Product[] }>(agencia, "/me/wishlist"), siteBase(agencia)]);

  return (
    <>
      <div>
        <h2 className="text-[20px] font-bold tracking-tight text-fg">Lista de deseos</h2>
        <p className="text-[13px] text-fg-3">Los tours que guardaste. Los precios se actualizan con la próxima fecha disponible.</p>
      </div>
      {items.length === 0 ? (
        <div className="rounded-card border border-line bg-surface p-6 shadow-card">
          <EmptyState icon={<Heart size={22} />} title="Tu lista está vacía" description="Toca «Guardar» en cualquier tour para tenerlo a mano." action={<Link href={siteHref(base, "/tours")} className="inline-flex h-11 items-center rounded-control bg-brand px-5 text-[14px] font-semibold text-brand-fg">Ver tours</Link>} />
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((product, index) => (
            <div key={product.slug} className="grid gap-2">
              <ProductCard product={product} base={base} index={index} />
              <WishButton slug={product.slug} signedIn initial className="w-full" />
            </div>
          ))}
        </div>
      )}
    </>
  );
}
