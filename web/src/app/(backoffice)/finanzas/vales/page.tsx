import { CircleCheck, Gift, HandCoins, Wallet } from "lucide-react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/PageHeader";
import { InfoTip } from "@/components/ui/InfoTip";
import { TintTile } from "@/components/ui/Tinted";
import { GiftCardsTable, IssueCardAction } from "@/features/growth-ops/GiftCards";
import type { CursorPage, GiftCardKpis, GiftCardRow, PaymentLinkKpis, PaymentLinkRow, PaymentTarget } from "@/lib/growth-ops";
import { formatMoney } from "@/lib/format";
import { growthRead } from "@/lib/server/growth-ops";

export const metadata: Metadata = { title: "Vales de regalo" };

const both = (pen: string, usd: string) => [Number(pen) > 0 ? formatMoney(pen, "PEN", { compact: true }) : null, Number(usd) > 0 ? formatMoney(usd, "USD", { compact: true }) : null].filter(Boolean).join(" · ") || formatMoney(0);

export default async function GiftCardsPage() {
  const [{ data, blocked }, links] = await Promise.all([
    growthRead<CursorPage<GiftCardRow, GiftCardKpis>>("/finance/gift-cards?page[size]=100", "No pudimos cargar los vales.", true),
    growthRead<CursorPage<PaymentLinkRow, PaymentLinkKpis>>("/finance/payment-links?include=targets&page[size]=1", "No pudimos cargar las cuotas.", true),
  ]);

  if (!data) return <PageHeader title="Vales de regalo" subtitle={blocked ?? "Tu rol no tiene acceso a esta sección."} />;

  const { kpis } = data.meta;
  const targets = (links.data?.meta.targets ?? []) as PaymentTarget[];

  return (
    <>
      <PageHeader
        title="Vales de regalo"
        subtitle="Vales con saldo que se venden en el sitio o se emiten desde aquí, y se canjean contra cualquier cuota."
        info={<InfoTip>El código de canje solo se muestra al emitir el vale; guardamos su huella, no el código. Cada canje queda como pago con vale y como movimiento del vale.</InfoTip>}
        actions={<IssueCardAction />}
      />
      <section className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <TintTile icon={Gift} tone="ok" label="Vales activos" value={kpis.activa.count} note={both(kpis.activa.balance_pen, kpis.activa.balance_usd)} info={<p>Vales que se pueden canjear hoy y el saldo que suman por moneda.</p>} />
        <TintTile icon={HandCoins} tone="info" label="Canjeado" value={both(kpis.redeemed.pen, kpis.redeemed.usd)} info={<p>Suma de todos los canjes registrados contra cuotas o reservas.</p>} />
        <TintTile icon={CircleCheck} tone="mute" label="Agotados" value={kpis.agotada.count} note="Saldo usado por completo" info={<p>Vales cuyo saldo llegó a cero con los canjes.</p>} />
        <TintTile icon={Wallet} tone="warn" label="Vencidos o anulados" value={kpis.vencida.count + kpis.anulada.count} note="Ya no se pueden canjear" info={<p>Vales que pasaron su fecha de vencimiento o que la agencia anuló.</p>} />
      </section>
      <GiftCardsTable rows={data.data} targets={targets} />
    </>
  );
}
