import { CircleAlert } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { formatDate, formatMoney } from "@/lib/format";
import type { PlanChangePreview } from "@/lib/admin";

type Audience = "tenant" | "platform";

const COPY: Record<Audience, { keeps: string; blocked: string; gained: string; lost: string }> = {
  tenant: { keeps: "Hasta entonces sigues con tu plan actual. No hay reembolso por el periodo en curso.", blocked: "Primero ajusta tu cuenta", gained: "Reglas de reserva que se habilitan", lost: "Reglas que dejan de aplicarse" },
  platform: { keeps: "Hasta entonces la agencia sigue con su plan actual. No hay reembolso por el periodo en curso.", blocked: "La agencia primero debe ajustar su cuenta", gained: "Reglas de reserva que gana", lost: "Reglas que deja de aplicar" },
};

export function PlanChangeNote({ tone = "mute", children }: { tone?: "mute" | "bad"; children: React.ReactNode }) {
  return <p className={tone === "bad" ? "rounded-[12px] bg-[color-mix(in_srgb,var(--bad)_8%,transparent)] px-3.5 py-3 text-[13px] text-bad" : "rounded-[12px] bg-surface-2 px-3.5 py-3 text-[13px] text-fg-3"}>{children}</p>;
}

export function PlanChangeSummary({ preview, currency, audience = "tenant" }: { preview: PlanChangePreview; currency: string; audience?: Audience }) {
  const copy = COPY[audience];
  const net = preview.proration ? Number(preview.proration.net) : 0;

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-[14px] border border-line p-3.5 text-[13px]">
        <p className="font-semibold">
          {preview.immediate ? "Se aplica hoy" : `Se aplica en la renovación del ${formatDate(preview.effective_at)}`}
          <span className="font-normal text-fg-3">
            {" "}
            · {formatMoney(preview.price, currency)} {preview.cycle === "annual" ? "al año" : "al mes"} + IGV
          </span>
        </p>
        {preview.proration && (
          <dl className="mt-2.5 grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-[12.5px]">
            <dt className="text-fg-3">
              Plan {preview.plan.name}
              {preview.cycle === preview.from.cycle ? ` por ${preview.proration.days_left} de ${preview.proration.period_days} días` : " por el periodo nuevo"}
            </dt>
            <dd className="text-right">{formatMoney(preview.proration.charge, currency)}</dd>
            <dt className="text-fg-3">Crédito del plan {preview.from.name} no usado</dt>
            <dd className="text-right">− {formatMoney(preview.proration.credit, currency)}</dd>
            <dt className="font-semibold">{net >= 0 ? "Cobro hoy" : "Saldo a favor"}</dt>
            <dd className="text-right font-semibold">
              {formatMoney(Math.abs(net), currency)} {net >= 0 ? "+ IGV" : ""}
            </dd>
          </dl>
        )}
        {!preview.immediate && <p className="mt-2 text-[12.5px] text-fg-3">{copy.keeps}</p>}
      </div>
      {preview.blockers.length > 0 && (
        <div className="rounded-[14px] bg-[color-mix(in_srgb,var(--bad)_8%,transparent)] p-3.5 text-[12.5px] text-bad">
          <p className="mb-1.5 flex items-center gap-1.5 font-semibold">
            <CircleAlert size={15} />
            {copy.blocked}
          </p>
          <ul className="list-disc space-y-1 pl-5">
            {preview.blockers.map((blocker) => (
              <li key={blocker}>{blocker}</li>
            ))}
          </ul>
        </div>
      )}
      {preview.rules.gained.length > 0 && <RuleList title={copy.gained} rules={preview.rules.gained} tone="ok" />}
      {preview.rules.lost.length > 0 && <RuleList title={copy.lost} rules={preview.rules.lost} tone="warn" />}
    </div>
  );
}

function RuleList({ title, rules, tone }: { title: string; rules: string[]; tone: "ok" | "warn" }) {
  return (
    <div>
      <p className="mb-1.5 text-[12.5px] font-semibold text-fg-2">{title}</p>
      <div className="flex flex-wrap gap-1.5">
        {rules.map((rule) => (
          <Badge key={rule} tone={tone} dot={false}>
            {rule}
          </Badge>
        ))}
      </div>
    </div>
  );
}
