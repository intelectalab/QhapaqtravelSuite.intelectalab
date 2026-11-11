"use client";

import { CalendarClock, Check, CreditCard, FileWarning, Play, Settings2, ShieldAlert, Wallet } from "lucide-react";
import Link from "next/link";
import { updateDunningPolicy } from "@/app/plataforma/(consola)/facturacion/actions";
import { runPlatformJob } from "@/app/plataforma/(consola)/integraciones/actions";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { ChoiceGroup } from "@/components/ui/ChoiceGroup";
import { EmptyState } from "@/components/ui/EmptyState";
import { TextField } from "@/components/ui/TextField";
import { TintCardTitle, TintTile, ToneScope } from "@/components/ui/Tinted";
import { cn } from "@/lib/cn";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { INVOICE_STATUS, type DunningItem, type DunningOverview, type DunningPolicy } from "@/lib/platformBilling";
import { ConsoleAction } from "./ConsoleAction";
import { ExtendDunningAction, ManualPaymentAction, PaymentLinkAction, RetryChargeAction, SuspendForDebtAction } from "./InvoiceActions";

const SLOTS = 5;

export function DunningKpis({ items }: { items: DunningItem[] }) {
  const active = items.filter((item) => item.status === "failed");
  const lost = items.filter((item) => item.status === "uncollectible");
  const next = active.map((item) => item.next_retry_at).filter((value): value is string => Boolean(value)).sort()[0];

  return (
    <section aria-label="Resumen de cobranza" className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
      <TintTile icon={CreditCard} tone="bad" label="En reintento" value={active.length} note={formatMoney(active.reduce((sum, item) => sum + item.total, 0))} />
      <TintTile icon={FileWarning} tone="warn" label="Incobrables" value={lost.length} note={formatMoney(lost.reduce((sum, item) => sum + item.total, 0))} />
      <TintTile icon={Wallet} tone="violet" label="Agencias con deuda" value={new Set(items.map((item) => item.tenant.code)).size} />
      <TintTile icon={CalendarClock} tone="t1" label="Próximo reintento" value={next ? formatDateTime(next, false) : "Sin agenda"} />
    </section>
  );
}

export function DunningPolicyCard({ policy }: { policy: DunningPolicy }) {
  return (
    <Card>
      <TintCardTitle icon={Settings2} title="Política de cobranza" tone="t4" />
      <ol className="mb-4 flex flex-wrap items-center gap-2">
        <li className="rounded-full bg-surface-2 px-3 py-1.5 text-[12.5px] font-semibold">D0 · cobro rechazado</li>
        {policy.retry_days.map((days, index) => (
          <li key={days} className="lift rounded-full bg-[color-mix(in_srgb,var(--tint)_12%,transparent)] px-3 py-1.5 text-[12.5px] font-semibold text-[var(--tint)] animate-[rise-in_420ms_cubic-bezier(0.22,1,0.36,1)_backwards]" style={{ animationDelay: `${index * 80}ms` }}>
            D+{days} · reintento {index + 1}
          </li>
        ))}
        <li className={cn("rounded-full px-3 py-1.5 text-[12.5px] font-semibold", policy.suspend_after_last ? "bg-bad/10 text-bad" : "bg-surface-2 text-fg-2")}>{policy.suspend_after_last ? "Suspende al agotar" : "Solo avisa al agotar"}</li>
      </ol>
      <p className="mb-4 text-[13px] text-fg-2">Cada reintento corre a las 10:00. La prórroga se suma al último reintento y un reintento manual no mueve el calendario.</p>
      <div className="flex flex-wrap gap-2">
        <ConsoleAction
          id="dunning-policy"
          label="Editar política"
          icon={<Settings2 size={15} />}
          size="sm"
          title="Política de cobranza"
          description="Días después del cobro rechazado en que se reintenta. Rige para las próximas facturas que fallen."
          submitLabel="Guardar política"
          action={updateDunningPolicy}
        >
          <div className="grid grid-cols-3 gap-3">
            {Array.from({ length: SLOTS }, (_, index) => (
              <TextField key={index} label={`Reintento ${index + 1}`} name="retry_days" type="number" min={1} max={30} defaultValue={policy.retry_days[index] ?? ""} placeholder="Día" required={index === 0} />
            ))}
          </div>
          <ChoiceGroup
            label="Al agotar los reintentos"
            name="suspend_after_last"
            options={[
              { value: "1", label: "Suspender la agencia" },
              { value: "0", label: "Solo marcar incobrable" },
            ]}
            defaultValue={policy.suspend_after_last ? "1" : "0"}
          />
        </ConsoleAction>
        <ConsoleAction
          id="dunning-run"
          label="Ejecutar ahora"
          icon={<Play size={15} />}
          size="sm"
          variant="ghost"
          title="Ejecutar la cobranza ahora"
          description="Reintenta las facturas cuyo reintento ya venció. Las demás conservan su fecha."
          submitLabel="Ejecutar"
          action={runPlatformJob}
          fields={{ code: "PLT-02" }}
        />
      </div>
    </Card>
  );
}

export function DunningList({ overview }: { overview: DunningOverview }) {
  if (overview.items.length === 0) {
    return (
      <Card>
        <EmptyState icon={<Check size={22} />} title="Sin cobros pendientes" description="Todas las agencias están al día con sus facturas." />
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {overview.items.map((item, index) => (
        <DunningCard key={item.id} item={item} index={index} />
      ))}
    </div>
  );
}

function DunningCard({ item, index }: { item: DunningItem; index: number }) {
  const status = INVOICE_STATUS[item.status];
  const tone = item.status === "failed" ? "bad" : "warn";

  return (
    <ToneScope tone={tone}>
      <article className="lift animate-[rise-in_420ms_cubic-bezier(0.22,1,0.36,1)_backwards] rounded-card border border-[color-mix(in_srgb,var(--tint)_22%,transparent)] bg-surface p-5 shadow-card" style={{ animationDelay: `${index * 80}ms` }}>
        <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Link href={`/plataforma/agencias/${item.tenant.code}`} className="text-[15px] font-semibold hover:underline">
                {item.tenant.name}
              </Link>
              <StatusBadge status={item.tenant.status} />
            </div>
            <p className="mt-0.5 text-[13px] text-fg-3">
              <Link href={`/plataforma/facturacion/facturas/${item.id}`} className="font-mono hover:underline">
                {item.number}
              </Link>{" "}
              · Plan {item.plan.name} · {item.payment_method ?? "Sin tarjeta"}
              {item.payment_method_status === "expired" ? " (vencida)" : ""}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[22px] font-bold leading-none tracking-tight">{formatMoney(item.total, item.currency)}</p>
            <Badge tone={status.tone} className="mt-1.5">
              {status.label}
            </Badge>
          </div>
        </header>

        <ol className="mb-4 grid gap-2" style={{ gridTemplateColumns: `repeat(${item.steps.length}, minmax(0, 1fr))` }}>
          {item.steps.map((step, stepIndex) => (
            <li key={step.label} className="group relative flex flex-col gap-1.5">
              <span className={cn("h-1.5 rounded-full transition-[filter] duration-300 group-hover:brightness-110", step.state === "done" ? "bg-[var(--tint)]" : step.state === "next" ? "bg-[color-mix(in_srgb,var(--tint)_45%,transparent)] motion-safe:animate-pulse" : "bg-surface-2")} style={{ animationDelay: `${stepIndex * 90}ms` }} />
              <span className={cn("text-[12px] font-semibold", step.state === "pending" ? "text-fg-3" : "text-fg")}>{step.label}</span>
              <span className="text-[11.5px] text-fg-3">{formatDate(step.date)}</span>
            </li>
          ))}
        </ol>

        <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px] text-fg-2">
          <span className="inline-flex items-center gap-1.5">
            <ShieldAlert size={15} className="text-[var(--tint)]" />
            {item.decline_message ?? "Cobro rechazado"}
          </span>
          <span>
            Reintentos {item.retries_done} de {item.retries_total}
          </span>
          {item.next_retry_at && <span>Próximo: {formatDateTime(item.next_retry_at, false)}</span>}
          {item.extended_days > 0 && <span>Prórroga de {item.extended_days} días</span>}
        </div>

        <div className="flex flex-wrap gap-2">
          <RetryChargeAction invoice={item} size="sm" />
          <ManualPaymentAction invoice={item} size="sm" />
          <PaymentLinkAction invoice={item} size="sm" />
          {item.status === "failed" && item.extended_days < 7 && <ExtendDunningAction invoice={item} size="sm" />}
          {item.tenant.status !== "suspendido" && <SuspendForDebtAction invoice={item} size="sm" />}
        </div>
      </article>
    </ToneScope>
  );
}
