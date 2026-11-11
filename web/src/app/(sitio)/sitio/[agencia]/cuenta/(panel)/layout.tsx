import type { Metadata } from "next";
import { AccountNav, VerifyNotice } from "@/features/site/Account";
import { PageHero } from "@/features/site/Hero";
import { requireAccount } from "@/lib/server/site";
import type { AccountMe, AccountReceivables } from "@/lib/site";

export const metadata: Metadata = { title: "Mi cuenta", robots: { index: false, follow: false } };

export default async function AccountLayout({ children, params }: LayoutProps<"/sitio/[agencia]/cuenta">) {
  const { agencia } = await params;
  const [me, receivables] = await Promise.all([requireAccount<AccountMe>(agencia, "/me"), requireAccount<AccountReceivables>(agencia, "/me/receivables?status=open")]);
  const due = receivables.items.filter((item) => item.can_pay).length;

  return (
    <>
      <PageHero eyebrow="Mi cuenta" title={`Hola, ${me.name.split(" ")[0]}`} description={me.passenger ? "Ves el viaje en el que participas como pasajero." : "Tus reservas, vouchers, pagos y datos en un solo lugar."} />
      <div className="mx-auto grid max-w-[1240px] gap-6 px-5 pt-8 sm:px-8 lg:grid-cols-[240px_1fr]">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <AccountNav pending={due} />
        </aside>
        <div className="grid min-w-0 content-start gap-5">
          {!me.verified && <VerifyNotice email={me.login_email} />}
          {children}
        </div>
      </div>
    </>
  );
}
