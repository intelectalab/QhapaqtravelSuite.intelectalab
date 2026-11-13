import { Ban, CircleCheck, Clock3, XCircle } from "lucide-react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/PageHeader";
import { InfoTip } from "@/components/ui/InfoTip";
import { TintTile } from "@/components/ui/Tinted";
import { CreateLinkAction, PaymentLinksTable } from "@/features/growth-ops/PaymentLinks";
import type { CursorPage, MoneyKpi, Option, PaymentLinkKpis, PaymentLinkRow, PaymentTarget } from "@/lib/growth-ops";
import { formatMoney } from "@/lib/format";
import { growthRead } from "@/lib/server/growth-ops";

export const metadata: Metadata = { title: "Links de pago" };

const money = (kpi: MoneyKpi) => [Number(kpi.pen) > 0 ? formatMoney(kpi.pen, "PEN", { compact: true }) : null, Number(kpi.usd) > 0 ? formatMoney(kpi.usd, "USD", { compact: true }) : null].filter(Boolean).join(" · ") || "Sin montos";

export default async function PaymentLinksPage() {
  const { data, blocked } = await growthRead<CursorPage<PaymentLinkRow, PaymentLinkKpis>>("/finance/payment-links?include=targets&page[size]=100", "No pudimos cargar los links de pago.", true);

  if (!data) return <PageHeader title="Links de pago" subtitle={blocked ?? "Tu rol no tiene acceso a esta sección."} />;

  const { kpis } = data.meta;
  const targets = (data.meta.targets ?? []) as PaymentTarget[];
  const methods = (data.meta.methods ?? []) as Option[];

  return (
    <>
      <PageHeader
        title="Links de pago"
        subtitle={data.meta.own_portfolio ? "Cobros con Yape, Plin, tarjeta en cuotas y más, para las reservas de tu cartera." : "Cobros con Yape, Plin, tarjeta en cuotas y más; el pago se aplica solo a la cuota."}
        info={<InfoTip>Cada link cobra una cuota por cobrar. Cuando la pasarela confirma el pago, se registra en Pagos y aplicaciones y la cuota baja su saldo. Un segundo aviso del mismo cobro no duplica el pago.</InfoTip>}
        actions={<CreateLinkAction targets={targets} methods={methods} />}
      />
      <section className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <TintTile icon={Clock3} tone="info" label="Activos" value={kpis.activo.count} note={money(kpis.activo)} info={<p>Links vigentes que el cliente todavía puede pagar, con la suma de sus montos por moneda.</p>} />
        <TintTile icon={CircleCheck} tone="ok" label="Pagados" value={kpis.pagado.count} note={money(kpis.pagado)} info={<p>Links cobrados: cada uno generó un pago aplicado a su cuota.</p>} />
        <TintTile icon={XCircle} tone="warn" label="Vencidos" value={kpis.vencido.count} note="Pasaron su fecha sin pago" info={<p>Links que llegaron a su vencimiento sin cobrarse. Crea uno nuevo si el cliente aún debe la cuota.</p>} />
        <TintTile icon={Ban} tone="mute" label="Anulados" value={kpis.anulado.count} note="Anulados por la agencia" info={<p>Links que la agencia anuló antes de que el cliente pagara.</p>} />
      </section>
      <PaymentLinksTable rows={data.data} />
    </>
  );
}
