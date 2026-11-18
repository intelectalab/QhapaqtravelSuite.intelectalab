import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/PageHeader";
import { InfoTip } from "@/components/ui/InfoTip";
import { RuleOffNotice } from "@/features/billing/RuleOffNotice";
import { GiftCardsTable, IssueCardAction } from "@/features/growth-ops/GiftCards";
import type { CursorPage, GiftCardKpis, GiftCardRow, PaymentLinkKpis, PaymentLinkRow, PaymentTarget } from "@/lib/growth-ops";
import { growthRead } from "@/lib/server/growth-ops";

export const metadata: Metadata = { title: "Vales de regalo" };

export default async function GiftCardsPage() {
  const [{ data, blocked }, links] = await Promise.all([
    growthRead<CursorPage<GiftCardRow, GiftCardKpis>>("/finance/gift-cards?page[size]=100", "No pudimos cargar los vales.", true),
    growthRead<CursorPage<PaymentLinkRow, PaymentLinkKpis>>("/finance/payment-links?include=targets&page[size]=1", "No pudimos cargar las cuotas.", true),
  ]);

  if (!data) return <PageHeader title="Vales de regalo" subtitle={blocked ?? "Tu rol no tiene acceso a esta sección."} />;

  const targets = (links.data?.meta.targets ?? []) as PaymentTarget[];

  return (
    <>
      <PageHeader
        title="Vales de regalo"
        subtitle="Vales con saldo que se venden en el sitio o se emiten desde aquí, y se canjean contra cualquier cuota."
        info={<InfoTip>El código de canje solo se muestra al emitir el vale; guardamos su huella, no el código. Cada canje queda como pago con vale y como movimiento del vale.</InfoTip>}
        actions={data.meta.rule_enabled !== false ? <IssueCardAction /> : undefined}
      />
      {data.meta.rule_enabled === false && <RuleOffNotice feature="Vales de regalo" kept="Los vales vigentes se consultan y canjean hasta su vencimiento." />}
      <GiftCardsTable rows={data.data} targets={targets} kpis={data.meta.kpis} />
    </>
  );
}
