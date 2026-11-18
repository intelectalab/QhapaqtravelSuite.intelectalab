import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/PageHeader";
import { InfoTip } from "@/components/ui/InfoTip";
import { RuleOffNotice } from "@/features/billing/RuleOffNotice";
import { CreateLinkAction, PaymentLinksTable } from "@/features/growth-ops/PaymentLinks";
import type { CursorPage, Option, PaymentLinkKpis, PaymentLinkRow, PaymentTarget } from "@/lib/growth-ops";
import { growthRead } from "@/lib/server/growth-ops";

export const metadata: Metadata = { title: "Links de pago" };

export default async function PaymentLinksPage() {
  const { data, blocked } = await growthRead<CursorPage<PaymentLinkRow, PaymentLinkKpis>>("/finance/payment-links?include=targets&page[size]=100", "No pudimos cargar los links de pago.", true);

  if (!data) return <PageHeader title="Links de pago" subtitle={blocked ?? "Tu rol no tiene acceso a esta sección."} />;

  const targets = (data.meta.targets ?? []) as PaymentTarget[];
  const methods = (data.meta.methods ?? []) as Option[];
  const enabled = data.meta.rule_enabled !== false;

  return (
    <>
      <PageHeader
        title="Links de pago"
        subtitle={data.meta.own_portfolio ? "Cobros con Yape, Plin, tarjeta en cuotas y más, para las reservas de tu cartera." : "Cobros con Yape, Plin, tarjeta en cuotas y más; el pago se aplica solo a la cuota."}
        info={<InfoTip>Cada link cobra una cuota por cobrar. Cuando la pasarela confirma el pago, se registra en Pagos y aplicaciones y la cuota baja su saldo. Un segundo aviso del mismo cobro no duplica el pago.</InfoTip>}
        actions={enabled ? <CreateLinkAction targets={targets} methods={methods} /> : undefined}
      />
      {!enabled && <RuleOffNotice feature="Links de pago" kept="Los links ya enviados se pueden pagar hasta su vencimiento y puedes anularlos." />}
      <PaymentLinksTable rows={data.data} kpis={data.meta.kpis} canSend={enabled} />
    </>
  );
}
