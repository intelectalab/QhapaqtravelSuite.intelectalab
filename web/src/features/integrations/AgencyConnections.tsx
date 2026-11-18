"use client";

import { ArrowRight, CreditCard, Mail, MessageCircle, PlugZap, ReceiptText, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { InfoTip } from "@/components/ui/InfoTip";
import { TintCardTitle } from "@/components/ui/Tinted";
import { RISE } from "@/features/admin/AdminParts";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/format";
import { INTEGRATION_STATUS, type AgencyIntegration, type AgencyIntegrationKey, type AgencyMailSummary } from "@/lib/integrations";
import { toneStyle, type Tone } from "@/lib/tone";
import { AgencyMailPanel, DisconnectAgencyMail } from "./AgencyMailPanel";

const LOOK: Record<AgencyIntegrationKey, { icon: LucideIcon; tone: Tone }> = {
  email: { icon: Mail, tone: "t3" },
  whatsapp: { icon: MessageCircle, tone: "ok" },
  ose: { icon: ReceiptText, tone: "t1" },
  payments: { icon: CreditCard, tone: "violet" },
};

function ConnectAction({ item, mail, manage, openMail }: { item: AgencyIntegration; mail: AgencyMailSummary | null; manage: boolean; openMail: boolean }) {
  if (!manage) return null;
  const primary = item.status !== "conectado";
  if (item.key === "email" && mail) {
    return (
      <AgencyMailPanel
        mail={mail}
        defaultOpen={openMail}
        trigger={(open) => (
          <Button variant={primary ? "primary" : "secondary"} size="sm" icon={<ArrowRight size={15} />} onClick={open} data-testid={`connect-${item.key}`}>
            {item.cta}
          </Button>
        )}
      />
    );
  }
  return (
    <Button href={item.href} variant={primary ? "primary" : "secondary"} size="sm" icon={<ArrowRight size={15} />} data-testid={`connect-${item.key}`}>
      {item.cta}
    </Button>
  );
}

export function ConnectionRow({ item, mail, manage, openMail = false, compact = false }: { item: AgencyIntegration; mail: AgencyMailSummary | null; manage: boolean; openMail?: boolean; compact?: boolean }) {
  const look = LOOK[item.key];
  const status = INTEGRATION_STATUS[item.status];
  const Icon = look.icon;

  return (
    <div data-testid={`connection-${item.key}`} data-status={item.status} className={cn("lift flex flex-wrap items-center gap-3.5 rounded-2xl border border-line bg-surface px-4 py-3.5", item.status === "conectado" && "bg-surface-2/40")}>
      <span style={toneStyle(look.tone)} className="tint-soft grid h-10 w-10 shrink-0 place-items-center rounded-xl text-[var(--tint)]">
        <Icon size={18} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2 text-[14px] font-semibold text-fg">
          {item.label}
          <Badge tone={status.tone} status={item.status}>
            {status.label}
          </Badge>
        </p>
        <p className="mt-0.5 text-[12.5px] text-fg-3">{item.status === "conectado" && item.key === "email" && mail?.address ? `Sale desde ${mail.address}${mail.verified_at ? ` · probado el ${formatDateTime(mail.verified_at, false)}` : ""}` : compact || item.status === "conectado" ? (item.detail ?? item.description) : item.description}</p>
        {!compact && item.status !== "conectado" && item.detail && <p className="mt-1 text-[12.5px] font-medium text-fg-2">{item.detail}</p>}
      </div>
      <div className="flex items-center gap-1.5">
        {manage && item.key === "email" && item.status === "conectado" && mail?.address && <DisconnectAgencyMail address={mail.address} />}
        <ConnectAction item={item} mail={mail} manage={manage} openMail={openMail} />
      </div>
    </div>
  );
}

export function AgencyConnections({ items, mail, manage, openMail }: { items: AgencyIntegration[]; mail: AgencyMailSummary | null; manage: boolean; openMail: boolean }) {
  const connected = items.filter((item) => item.status === "conectado").length;

  return (
    <div className={RISE}>
      <Card className="mb-5">
        <TintCardTitle
          icon={PlugZap}
          tone="t4"
          title="Conexiones de tu agencia"
          aside={
            <span className="flex items-center gap-1.5 text-[12.5px] text-fg-3">
              {connected} de {items.length} conectadas
              <InfoTip>Cuentas que pone tu agencia: tu correo, tu número de WhatsApp, tu OSE y tu pasarela de pago. Mientras falte una, la función que la usa te avisa y no envía nada.</InfoTip>
            </span>
          }
        />
        <div className="grid gap-2.5" data-testid="agency-connections">
          {items.map((item) => (
            <ConnectionRow key={item.key} item={item} mail={mail} manage={manage} openMail={openMail && item.key === "email"} />
          ))}
        </div>
      </Card>
    </div>
  );
}
