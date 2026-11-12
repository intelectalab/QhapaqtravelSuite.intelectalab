"use client";

import { BarChart3, CalendarClock, Check, CreditCard, Layers, Lock, MessageSquare, Pencil, Receipt, ShieldCheck, Webhook, X } from "lucide-react";
import { useActionState, useState, useTransition, type FormEvent } from "react";
import { openCardSession, saveCard, updateBilling } from "@/app/(backoffice)/admin/suscripcion/actions";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FieldList } from "@/components/ui/Details";
import { SelectField } from "@/components/ui/SelectField";
import { SidePanel } from "@/components/ui/SidePanel";
import { TextField } from "@/components/ui/TextField";
import { TintCardTitle, TintTile } from "@/components/ui/Tinted";
import { KpiGrid } from "@/features/admin/AdminParts";
import { ADMIN_INITIAL, type SubscriptionOverview } from "@/lib/admin";
import { formatDate, formatMoney, formatNumber, monthName } from "@/lib/format";
import { UsageHistory } from "./Subscription";
import { AutoRenewToggle, CancelAction } from "./SubscriptionActions";

type Subscription = NonNullable<SubscriptionOverview["subscription"]>;

const STATUS_TONE: Record<string, "ok" | "sun" | "bad" | "mute" | "t1"> = { trialing: "t1", active: "ok", past_due: "bad", cancel_scheduled: "sun", suspended: "bad", canceled: "mute" };

const SOURCE: Record<string, string> = { addon: "Complemento", override: "Excepción" };

function daysUntil(iso: string): number {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(new Date());
  return Math.round((Date.parse(`${iso.slice(0, 10)}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / 86_400_000);
}

function Breakdown({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="mt-2 grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5 text-[12px]">
      {rows.map(([label, value]) => (
        <span key={label} className="contents">
          <dt className="text-fg-3">{label}</dt>
          <dd className="text-right tabular-nums">{value}</dd>
        </span>
      ))}
    </dl>
  );
}

export function SubscriptionKpis({ data }: { data: SubscriptionOverview }) {
  const { plan, subscription, next_charge: next, payment_method: card } = data;
  if (!plan || !subscription) return null;
  const renewal = next?.date ?? subscription.period_end;
  const days = daysUntil(renewal);
  const cancelled = subscription.status === "cancel_scheduled";
  const renewalNote = cancelled ? "No se renovará" : days < 0 ? "Pendiente de renovar" : days === 0 ? `Hoy · ${subscription.auto_renew ? "automática" : "manual"}` : `En ${days} ${days === 1 ? "día" : "días"} · ${subscription.auto_renew ? "automática" : "manual"}`;
  const currency = plan.currency;
  return (
    <KpiGrid>
      <TintTile
        icon={Layers}
        tone="t1"
        label="Plan actual"
        value={plan.name}
        note={`${formatMoney(subscription.cycle === "annual" ? plan.price_year : plan.price_month, currency)} ${subscription.cycle === "annual" ? "al año" : "al mes"} + IGV`}
        info={<p>Plan de tu suscripción en la plataforma y su precio sin IGV según el ciclo de pago ({subscription.cycle === "annual" ? "anual" : "mensual"}). Se cambia con «Cambiar plan».</p>}
      />
      <TintTile
        icon={CalendarClock}
        tone={cancelled || days < 0 ? "sun" : "t4"}
        label="Próxima renovación"
        value={formatDate(renewal)}
        note={renewalNote}
        info={
          <p>
            Día siguiente al fin del periodo actual ({formatDate(subscription.period_start)} al {formatDate(subscription.period_end)}). Ese día el proceso de renovación emite la factura del nuevo periodo y la cobra con tu tarjeta{subscription.auto_renew ? "" : " si activas la renovación automática"}.
            {days < 0 ? " El periodo ya terminó y la renovación aún no se procesó." : ""}
          </p>
        }
      />
      <TintTile
        icon={Receipt}
        tone="violet"
        label="Próximo cargo estimado"
        value={next ? formatMoney(next.total, currency) : "—"}
        note={next ? `Incluye IGV${subscription.coupon ? ` · cupón ${subscription.coupon.code}` : ""}` : "Sin renovación programada"}
        info={
          next ? (
            <div>
              <p>Lo que se cobrará en la renovación del {formatDate(next.date)}:</p>
              <Breakdown
                rows={[
                  [`Plan ${next.plan} (${next.cycle === "annual" ? "anual" : "mensual"})`, formatMoney(next.base, currency)],
                  ["Complementos vigentes", formatMoney(next.addons, currency)],
                  ...(next.discount > 0 ? ([["Cupón", `− ${formatMoney(next.discount, currency)}`]] as [string, string][]) : []),
                  ...(next.credit > 0 ? ([["Saldo a favor", `− ${formatMoney(next.credit, currency)}`]] as [string, string][]) : []),
                  ["IGV", formatMoney(next.igv, currency)],
                  ["Total", formatMoney(next.total, currency)],
                ]}
              />
            </div>
          ) : (
            <p>La suscripción tiene una cancelación programada, así que no habrá otro cobro.</p>
          )
        }
      />
      <TintTile
        icon={CreditCard}
        tone={card ? "ok" : "bad"}
        label="Método de pago"
        value={card ? `${card.brand} •••• ${card.last4}` : "Sin tarjeta"}
        note={card ? `Vence ${card.exp}` : "Registra una tarjeta"}
        info={<p>Tarjeta predeterminada registrada en la pasarela{card?.updated_by ? ` por ${card.updated_by}` : ""}. Solo se guardan la marca, los últimos 4 dígitos, el vencimiento y el titular.</p>}
      />
    </KpiGrid>
  );
}

export function PlanPeriodCard({ subscription, manage }: { subscription: Subscription; manage: boolean }) {
  return (
    <Card>
      <TintCardTitle icon={ShieldCheck} title="Plan y periodo" />
      <FieldList
        fields={[
          { label: "Estado", value: <Badge tone={STATUS_TONE[subscription.status] ?? "mute"}>{subscription.status_label}</Badge> },
          { label: "Ciclo", value: subscription.cycle === "annual" ? "Anual" : "Mensual" },
          { label: "Periodo actual", value: `${formatDate(subscription.period_start)} – ${formatDate(subscription.period_end)}` },
          ...(subscription.trial_ends_at ? [{ label: "Prueba", value: `Hasta el ${formatDate(subscription.trial_ends_at)}${subscription.status === "trialing" ? "" : " · finalizada"}` }] : []),
          { label: "Cliente desde", value: formatDate(subscription.customer_since) },
          { label: "Saldo a favor", value: subscription.credit_balance > 0 ? formatMoney(subscription.credit_balance) : "—" },
          { label: "Cupón", value: subscription.coupon ? `${subscription.coupon.code} · ${subscription.coupon.label} · ${subscription.coupon.remaining_cycles} ${subscription.coupon.remaining_cycles === 1 ? "ciclo" : "ciclos"}` : "—" },
        ]}
      />
      {manage && (
        <div className="mt-3 border-t border-line-2 pt-3">
          <AutoRenewToggle subscription={subscription} />
        </div>
      )}
      <div className="mt-3 flex items-center justify-between gap-3 border-t border-line-2 pt-3">
        <span className="font-mono text-[11.5px] text-fg-3">{subscription.code}</span>
        {manage && subscription.status === "active" && <CancelAction periodEnd={subscription.period_end} coupon={subscription.coupon} />}
      </div>
    </Card>
  );
}

export function ModulesCard({ modules, plan }: { modules: SubscriptionOverview["modules"]; plan: string }) {
  return (
    <Card>
      <TintCardTitle icon={Layers} title="Módulos habilitados" aside={`${modules.filter((module) => module.enabled).length} de ${modules.length}`} />
      <p className="-mt-2 mb-3 text-[12px] text-fg-3">Del plan {plan}, de tus complementos y de las excepciones vigentes.</p>
      <ul className="grid gap-x-4 gap-y-1.5 sm:grid-cols-2">
        {modules.map((module) => (
          <li key={module.key} className="flex items-center justify-between gap-2 text-[12.5px]" title={module.valid_until ? `Vigente hasta el ${formatDate(module.valid_until)}` : undefined}>
            <span className={module.enabled ? "flex min-w-0 items-center gap-1.5" : "flex min-w-0 items-center gap-1.5 text-fg-3"}>
              {module.enabled ? <Check size={14} className="flex-none text-ok" /> : <X size={14} className="flex-none" />}
              <span className="truncate">{module.label}</span>
            </span>
            {module.enabled && SOURCE[module.source] && <Badge tone="t1" dot={false}>{SOURCE[module.source]}</Badge>}
          </li>
        ))}
      </ul>
    </Card>
  );
}

function luhn(digits: string): boolean {
  let total = 0;
  for (let index = 0; index < digits.length; index++) {
    let value = Number(digits[digits.length - 1 - index]);
    if (index % 2) {
      value *= 2;
      if (value > 9) value -= 9;
    }
    total += value;
  }
  return total % 10 === 0;
}

function brandOf(digits: string): string {
  if (/^4/.test(digits)) return "Visa";
  if (/^(5[1-5]|2[2-7])/.test(digits)) return "Mastercard";
  if (/^3[47]/.test(digits)) return "American Express";
  return "Diners Club";
}

function randomToken(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return `pm_local_${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

function CardUpdate({ holder, label }: { holder: string | null; label: string }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const digits = String(form.get("card") ?? "").replace(/\D/g, "");
    const expiry = /^(\d{2})\/(\d{4})$/.exec(String(form.get("expiry") ?? "").trim());
    const cvv = String(form.get("cvv") ?? "");
    const name = String(form.get("holder") ?? "").trim();
    if (digits.length < 13 || digits.length > 19 || !luhn(digits)) return setMessage("Revisa el número de la tarjeta.");
    if (!expiry || Number(expiry[1]) < 1 || Number(expiry[1]) > 12) return setMessage("El vencimiento va como MM/AAAA.");
    if (!/^\d{3,4}$/.test(cvv)) return setMessage("El CVV tiene 3 o 4 dígitos.");
    if (name === "") return setMessage("Escribe el nombre del titular.");
    setMessage(null);
    start(async () => {
      const opened = await openCardSession();
      if (!opened.session) return setMessage(opened.message);
      const result = await saveCard({ session: opened.session, token: randomToken(), brand: brandOf(digits), last4: digits.slice(-4), exp_month: Number(expiry[1]), exp_year: Number(expiry[2]), holder: name });
      if (result.done) setOpen(false);
      else setMessage(result.message);
    });
  };

  return (
    <>
      <Button variant="primary" size="sm" icon={<Pencil size={14} />} onClick={() => setOpen(true)}>
        {label}
      </Button>
      <SidePanel
        open={open}
        onOpenChange={setOpen}
        title={label}
        description="Formulario de la pasarela. Se valida con un cargo de S/ 1.00 que se revierte al instante. A KipuControl solo llegan la marca, los últimos 4 dígitos, el vencimiento y el titular; nunca el número completo ni el CVV."
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit" form="card-update" disabled={pending}>
              {pending ? "Guardando…" : "Guardar tarjeta"}
            </Button>
          </div>
        }
      >
        <form id="card-update" onSubmit={submit} className="flex flex-col gap-4" autoComplete="off">
          <TextField label="Número de tarjeta" name="card" inputMode="numeric" required maxLength={23} placeholder="4111 1111 1111 1111" />
          <TextField label="Titular" name="holder" required maxLength={120} defaultValue={holder ?? undefined} />
          <div className="grid grid-cols-2 gap-3">
            <TextField label="Vencimiento" name="expiry" required maxLength={7} placeholder="MM/AAAA" />
            <TextField label="CVV" name="cvv" type="password" inputMode="numeric" required maxLength={4} />
          </div>
          {message && <p className="text-[12.5px] text-bad">{message}</p>}
        </form>
      </SidePanel>
    </>
  );
}

export function PaymentMethodCard({ card, manage }: { card: SubscriptionOverview["payment_method"]; manage: boolean }) {
  return (
    <Card>
      <TintCardTitle
        icon={CreditCard}
        title="Método de pago"
        aside={
          <span className="inline-flex items-center gap-1 rounded-full bg-[color-mix(in_srgb,var(--ok)_12%,transparent)] px-2.5 py-1 text-[11.5px] font-semibold text-ok" title="La tarjeta se tokeniza en la pasarela; nunca se guarda el número completo ni el CVV.">
            <Lock size={12} /> Tokenizada · PCI
          </span>
        }
      />
      {card ? (
        <div className="flex items-center gap-3.5">
          <span className="grid h-11 w-11 flex-none place-items-center rounded-[12px] bg-accent/10 text-accent">
            <CreditCard size={19} />
          </span>
          <span className="min-w-0">
            <b className="block text-[14px]">
              {card.brand} •••• {card.last4}
            </b>
            <span className="block text-[12.5px] text-fg-2">
              {card.holder} · vence {card.exp}
            </span>
            <span className="block text-[11.5px] text-fg-3">
              Token <span className="font-mono">{card.token_hint}…</span> · actualizada el {formatDate(card.updated_at)}
              {card.updated_by ? ` por ${card.updated_by}` : ""}
            </span>
          </span>
        </div>
      ) : (
        <p className="rounded-[12px] bg-surface-2 px-3.5 py-3 text-[13px] text-fg-3">Aún no registras una tarjeta. Sin ella no podemos cobrar la renovación.</p>
      )}
      {manage && (
        <div className="mt-4 flex justify-end border-t border-line-2 pt-3">
          <CardUpdate holder={card?.holder ?? null} label={card ? "Actualizar tarjeta" : "Registrar tarjeta"} />
        </div>
      )}
    </Card>
  );
}

export function BillingForm({ billing, manage }: { billing: Subscription["billing"]; manage: boolean }) {
  const [state, action, pending] = useActionState(updateBilling, ADMIN_INITIAL);
  return (
    <Card>
      <TintCardTitle icon={Receipt} title="Datos de facturación" />
      <p className="-mt-2 mb-4 text-[12px] text-fg-3">Se usan en las próximas facturas; las ya emitidas no cambian.</p>
      <form action={action} className="grid gap-3 sm:grid-cols-12">
        <div className="sm:col-span-4">
          <TextField label="RUC" name="ruc" required inputMode="numeric" maxLength={11} defaultValue={billing.ruc} disabled={!manage} />
        </div>
        <div className="sm:col-span-8">
          <TextField label="Razón social" name="name" required defaultValue={billing.name} disabled={!manage} />
        </div>
        <div className="sm:col-span-8">
          <TextField label="Dirección fiscal" name="address" required defaultValue={billing.address} disabled={!manage} />
        </div>
        <div className="sm:col-span-4">
          <TextField label="Ubigeo" name="ubigeo" inputMode="numeric" maxLength={6} defaultValue={billing.ubigeo ?? undefined} disabled={!manage} />
        </div>
        <div className="sm:col-span-6">
          <TextField label="Correo para comprobantes" name="email" type="email" required defaultValue={billing.email} disabled={!manage} />
        </div>
        <div className="sm:col-span-6">
          <TextField label="Contacto de facturación" name="contact" maxLength={150} defaultValue={billing.contact ?? undefined} disabled={!manage} />
        </div>
        <div className="sm:col-span-6">
          <SelectField label="Comprobante" name="doc_type" options={[{ value: "Factura", label: "Factura" }, { value: "Boleta", label: "Boleta" }]} defaultValue={billing.doc_type} hint="Las empresas con RUC 20 reciben factura electrónica." />
        </div>
        {manage && (
          <div className="flex items-end justify-end gap-3 sm:col-span-12">
            {state.message && <p className="mr-auto text-[12.5px] text-bad">{state.message}</p>}
            {state.done && !state.message && <p className="mr-auto text-[12.5px] text-ok">Datos guardados.</p>}
            <Button variant="primary" size="sm" type="submit" icon={<Check size={14} />} disabled={pending}>
              {pending ? "Guardando…" : "Guardar datos"}
            </Button>
          </div>
        )}
      </form>
    </Card>
  );
}

export function HistoryTab({ history }: { history: SubscriptionOverview["history"] }) {
  const columns = [
    { id: "reservations_month", label: "Reservas" },
    { id: "whatsapp_month", label: "WhatsApp" },
    { id: "email_month", label: "Correos" },
    { id: "api_calls_month", label: "Llamadas API" },
  ];
  const months = [...new Set(Object.values(history).flatMap((series) => series.map((point) => point.month)))].sort().reverse();
  const value = (metric: string, month: string) => history[metric]?.find((point) => point.month === month)?.value;
  const current = new Date().toISOString().slice(0, 7);
  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-5 xl:grid-cols-2">
        <Card>
          <TintCardTitle icon={MessageSquare} title="Mensajería por mes" />
          <UsageHistory history={history} metrics={[{ id: "whatsapp_month", label: "WhatsApp" }, { id: "email_month", label: "Correos" }]} />
        </Card>
        <Card>
          <TintCardTitle icon={Webhook} title="Llamadas a la API por mes" />
          <UsageHistory history={history} metrics={[{ id: "api_calls_month", label: "API" }]} />
        </Card>
      </div>
      <Card>
        <TintCardTitle icon={BarChart3} title="Detalle mensual" />
        {months.length === 0 ? (
          <p className="text-[13px] text-fg-3">Aún no hay consumo registrado.</p>
        ) : (
          <div className="scroll-thin overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-line text-left text-[12px] text-fg-3">
                  <th className="py-2 pr-3 font-medium">Mes</th>
                  {columns.map((column) => (
                    <th key={column.id} className="py-2 pr-3 text-right font-medium">
                      {column.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {months.map((month) => (
                  <tr key={month} className="border-b border-line-2 transition-colors hover:bg-surface-2">
                    <td className="py-2 pr-3">
                      {monthName(month)}
                      {month.startsWith(current) && <Badge tone="t1" dot={false} className="ml-2">En curso</Badge>}
                    </td>
                    {columns.map((column) => (
                      <td key={column.id} className="py-2 pr-3 text-right tabular-nums">
                        {value(column.id, month) === undefined ? "—" : formatNumber(value(column.id, month) ?? 0)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
