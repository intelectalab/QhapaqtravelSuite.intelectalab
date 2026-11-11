import { Ticket } from "lucide-react";
import Link from "next/link";
import { StatusBadge } from "@/components/ui/Badge";
import { DownloadButton } from "@/components/ui/DownloadButton";
import { EmptyState } from "@/components/ui/EmptyState";
import { capitalize, formatDate } from "@/lib/format";
import { requireAccount, siteBase } from "@/lib/server/site";
import { siteHref, type AccountVoucher } from "@/lib/site";

export default async function AccountVouchersPage({ params }: PageProps<"/sitio/[agencia]/cuenta/vouchers">) {
  const { agencia } = await params;
  const [{ items }, base] = await Promise.all([requireAccount<{ items: AccountVoucher[] }>(agencia, "/me/vouchers"), siteBase(agencia)]);

  return (
    <>
      <div>
        <h2 className="text-[20px] font-bold tracking-tight text-fg">Vouchers</h2>
        <p className="text-[13px] text-fg-3">Preséntalos al guía o al proveedor el día del servicio, impresos o en el celular.</p>
      </div>
      {items.length === 0 ? (
        <div className="rounded-card border border-line bg-surface p-6 shadow-card">
          <EmptyState icon={<Ticket size={22} />} title="Aún no hay vouchers" description="Operaciones los emite cuando confirma cada servicio con el proveedor. Te avisaremos por correo." />
        </div>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {items.map((voucher, index) => (
            <li key={voucher.code} className="lift flex items-center justify-between gap-3 rounded-card border border-line bg-surface p-4 shadow-card animate-[rise-in_420ms_cubic-bezier(0.22,1,0.36,1)_backwards]" style={{ animationDelay: `${index * 50}ms` }}>
              <span className="min-w-0">
                <span className="flex items-center gap-2">
                  <span className="text-[12px] font-semibold text-fg-3">{voucher.code}</span>
                  <StatusBadge status={voucher.status} />
                </span>
                <b className="mt-1 block truncate text-[14.5px] font-semibold text-fg">{voucher.label}</b>
                <span className="text-[12.5px] text-fg-2">
                  {capitalize(formatDate(voucher.date, "long"))} ·{" "}
                  <Link href={siteHref(base, `/cuenta/reservas/${voucher.reservation}`)} className="font-semibold text-accent hover:underline">
                    {voucher.reservation}
                  </Link>
                </span>
              </span>
              <DownloadButton href={siteHref(base, `/cuenta/vouchers/${voucher.code}`)} label="PDF" size="sm" />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
