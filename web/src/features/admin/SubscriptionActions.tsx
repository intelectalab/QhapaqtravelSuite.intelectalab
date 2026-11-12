"use client";

import { ArrowUpRight, Ban, CalendarCheck, CalendarPlus, CalendarX2, CircleAlert, Lock, Mail, Minus, Plus, Receipt, RotateCcw, Sparkles, Ticket, Undo2, XCircle } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { addAddon, cancelSubscription, changePlan, payInvoice, previewPlanChange, redeemCoupon, removeAddon, resumeSubscription, sendInvoice, setAutoRenew, updateAddon, voidScheduledChange } from "@/app/(backoffice)/admin/suscripcion/actions";
import { Badge } from "@/components/ui/Badge";
import { ChoiceGroup } from "@/components/ui/ChoiceGroup";
import { FieldList } from "@/components/ui/Details";
import { PanelAction } from "@/components/ui/PanelAction";
import { SelectField } from "@/components/ui/SelectField";
import { SwitchField } from "@/components/ui/SwitchField";
import { TextArea } from "@/components/ui/TextArea";
import { TextField } from "@/components/ui/TextField";
import { PlanChangeNote, PlanChangeSummary } from "@/features/billing/PlanChangeSummary";
import { ADMIN_INITIAL, type AddonOffer, type AdminActionState, type BillingCycle, type PlanChangePreview, type PlanOption, type SubscriptionOverview } from "@/lib/admin";
import { cn } from "@/lib/cn";
import { formatDate, formatMoney } from "@/lib/format";

type Subscription = NonNullable<SubscriptionOverview["subscription"]>;

const CYCLES = [
  { value: "monthly", label: "Mensual" },
  { value: "annual", label: "Anual" },
];

const CANCEL_REASONS = ["Precio", "Faltan funciones", "Es difícil de usar", "Cerramos o pausamos la agencia", "Nos vamos a otro sistema", "Otro motivo"];

const CANCEL_SOLUTIONS = ["Otro sistema de gestión", "Hojas de cálculo", "Desarrollo propio", "Ninguna por ahora"];

function PlanPreview({ plan, cycle, current, currentCycle, currency }: { plan: string; cycle: BillingCycle; current: string; currentCycle: BillingCycle; currency: string }) {
  const [state, setState] = useState<{ key: string; preview: PlanChangePreview | null; message: string | null } | null>(null);
  const key = `${plan}|${cycle}`;
  const same = plan === current && cycle === currentCycle;

  useEffect(() => {
    if (same) return;
    let alive = true;
    previewPlanChange(plan, cycle).then((result) => {
      if (alive) setState({ key, ...result });
    });
    return () => {
      alive = false;
    };
  }, [plan, cycle, key, same]);

  if (same) return <PlanChangeNote>Es tu plan actual. Elige otro plan o ciclo.</PlanChangeNote>;
  if (state?.key !== key) return <PlanChangeNote>Calculando el cambio…</PlanChangeNote>;
  if (!state.preview) return <PlanChangeNote tone="bad">{state.message}</PlanChangeNote>;

  return <PlanChangeSummary preview={state.preview} currency={currency} />;
}

function PlanChangeFields({ plans, current, currentCycle, initialPlan, currency }: { plans: PlanOption[]; current: string; currentCycle: BillingCycle; initialPlan: string; currency: string }) {
  const [plan, setPlan] = useState(initialPlan);
  const [cycle, setCycle] = useState<BillingCycle>(currentCycle);
  return (
    <>
      <ChoiceGroup label="Plan" name="plan" options={plans.map((item) => ({ value: item.code, label: item.code === current ? `${item.name} (actual)` : item.name }))} defaultValue={initialPlan} onChange={setPlan} />
      <ChoiceGroup label="Ciclo de pago" name="cycle" options={CYCLES} defaultValue={currentCycle} onChange={(value) => setCycle(value as BillingCycle)} hint="Pasar a anual abre un periodo nuevo de 12 meses. Pasar a mensual se aplica en la renovación." />
      <PlanPreview plan={plan} cycle={cycle} current={current} currentCycle={currentCycle} currency={currency} />
    </>
  );
}

export function ChangePlanAction({ plans, current, cycle, currency, target, trigger }: { plans: PlanOption[]; current: string; cycle: BillingCycle; currency: string; target?: string; trigger?: (open: () => void) => React.ReactNode }) {
  return (
    <PanelAction<AdminActionState>
      label="Cambiar plan"
      icon={<Sparkles size={16} />}
      variant="primary"
      formId={`plan-change-${target ?? "header"}`}
      trigger={trigger}
      title="Cambiar plan"
      description="Las subidas se aplican hoy con prorrateo. Las bajadas quedan para la renovación."
      submitLabel="Confirmar cambio"
      action={changePlan}
      initial={ADMIN_INITIAL}
    >
      {() => <PlanChangeFields plans={plans} current={current} currentCycle={cycle} initialPlan={target ?? plans.find((plan) => plan.code !== current && plan.rank > (plans.find((item) => item.code === current)?.rank ?? 0))?.code ?? current} currency={currency} />}
    </PanelAction>
  );
}

export function CouponAction({ active, label = "Aplicar cupón" }: { active: Subscription["coupon"]; label?: string }) {
  return (
    <PanelAction<AdminActionState> label={label} icon={<Ticket size={16} />} size={label === "Aplicar cupón" ? "md" : "sm"} formId={label === "Aplicar cupón" ? "coupon-redeem" : "coupon-retention"} title={label} description={active ? `Ya tienes el cupón ${active.code}. Los cupones no se acumulan.` : "El descuento se aplica desde la próxima factura."} submitLabel="Aplicar" action={redeemCoupon} initial={ADMIN_INITIAL}>
      {() => <TextField label="Código del cupón" name="code" required maxLength={40} autoComplete="off" />}
    </PanelAction>
  );
}

export function AutoRenewToggle({ subscription }: { subscription: Subscription }) {
  const [checked, setChecked] = useState(subscription.auto_renew);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const blocked = subscription.status === "cancel_scheduled";

  return (
    <div>
      <SwitchField
        label="Renovación automática"
        name="auto_renew"
        checked={checked}
        disabled={pending || blocked}
        hint={blocked ? "Reanuda la suscripción para volver a renovar." : checked ? `Se renueva el ${formatDate(subscription.period_end)} con tu tarjeta registrada.` : `Sin renovación, la suscripción se cierra el ${formatDate(subscription.period_end)}.`}
        onCheckedChange={(value) => {
          setChecked(value);
          start(async () => {
            const result = await setAutoRenew(value);
            if (!result.done) {
              setChecked(!value);
              setMessage(result.message);
            } else setMessage(null);
          });
        }}
      />
      {message && <p className="mt-1.5 text-[12.5px] text-bad">{message}</p>}
    </div>
  );
}

export function CancelAction({ periodEnd, coupon }: { periodEnd: string; coupon?: Subscription["coupon"] }) {
  return (
    <PanelAction<AdminActionState> label="Cancelar suscripción" icon={<Ban size={15} />} variant="ghost" size="sm" formId="subscription-cancel" title="Cancelar suscripción" submitLabel="Programar cancelación" action={cancelSubscription} initial={ADMIN_INITIAL}>
      {() => (
        <>
          <ol className="grid grid-cols-3 gap-2 text-center">
            {[
              { icon: CalendarCheck, title: "Hoy", text: "Se programa la cancelación" },
              { icon: CalendarX2, title: formatDate(periodEnd), text: "Último día con todo activo" },
              { icon: Lock, title: "30 días más", text: "Solo lectura para exportar" },
            ].map((step, index) => (
              <li key={step.title} className="relative flex flex-col items-center gap-1 rounded-tile border border-line px-2 py-2.5">
                <span className={cn("grid h-8 w-8 place-items-center rounded-full", index === 2 ? "bg-surface-2 text-fg-2" : "bg-accent/10 text-accent")}>
                  <step.icon size={15} />
                </span>
                <b className="text-[12.5px] font-semibold">{step.title}</b>
                <span className="text-[11.5px] leading-snug text-fg-3">{step.text}</span>
              </li>
            ))}
          </ol>
          <div className="flex items-start justify-between gap-3 rounded-[12px] bg-accent/5 px-3.5 py-3 text-[12.5px] text-fg-2">
            <p>
              <b className="text-fg">Antes de irte:</b> puedes pasar a un plan menor, retirar complementos o aplicar un cupón de retención.
            </p>
            <CouponAction active={coupon ?? null} label="Aplicar cupón de retención" />
          </div>
          <CancelFields />
        </>
      )}
    </PanelAction>
  );
}

function CancelFields() {
  const [score, setScore] = useState<number | null>(null);
  const [exportData, setExportData] = useState(true);
  const [accept, setAccept] = useState(false);
  return (
    <>
      <SelectField label="Motivo principal" name="reason" options={CANCEL_REASONS.map((reason) => ({ value: reason, label: reason }))} placeholder="Elige un motivo" />
      <SelectField label="Qué usarás en su lugar (opcional)" name="solution" options={CANCEL_SOLUTIONS.map((item) => ({ value: item, label: item }))} placeholder="Elige una opción" clearable />
      <fieldset>
        <legend className="mb-1.5 text-[13px] font-semibold text-fg">Qué tan probable es que nos recomiendes (opcional)</legend>
        <div className="grid grid-cols-11 gap-1">
          {Array.from({ length: 11 }, (_, value) => (
            <button key={value} type="button" aria-pressed={score === value} onClick={() => setScore(score === value ? null : value)} className={cn("h-9 rounded-[9px] text-[12.5px] font-semibold transition", score === value ? "bg-accent text-white" : "bg-surface-2 text-fg-2 hover:bg-accent/10 hover:text-accent")}>
              {value}
            </button>
          ))}
        </div>
        {score !== null && <input type="hidden" name="score" value={score} />}
      </fieldset>
      <TextArea label="Qué te habría hecho quedarte (opcional)" name="stay" rows={2} maxLength={500} />
      <TextArea label="Comentarios (opcional)" name="comments" rows={2} maxLength={1000} />
      <SwitchField label="Quiero exportar mis datos antes del cierre" name="export" checked={exportData} onCheckedChange={setExportData} hint="Te enviamos el enlace de descarga por correo." />
      <SwitchField label="Entiendo que la cuenta se cierra al final del periodo" name="accept" checked={accept} onCheckedChange={setAccept} hint="Puedes reanudar antes de esa fecha sin perder nada." />
    </>
  );
}

function ConfirmAction({ label, icon, formId, title, description, submitLabel, action }: { label: string; icon: React.ReactNode; formId: string; title: string; description: string; submitLabel: string; action: () => Promise<AdminActionState> }) {
  return (
    <PanelAction<AdminActionState> label={label} icon={icon} size="sm" formId={formId} title={title} description={description} submitLabel={submitLabel} action={action} initial={ADMIN_INITIAL}>
      {() => null}
    </PanelAction>
  );
}

export function SubscriptionBanners({ subscription, overdue, near, currency }: { subscription: Subscription; overdue: SubscriptionOverview["invoices"]; near: number; currency: string }) {
  const banners: { key: string; tone: "warn" | "bad" | "t1"; icon: React.ReactNode; text: string; action?: React.ReactNode }[] = [];

  if (subscription.status === "cancel_scheduled" && subscription.cancel_at) {
    banners.push({ key: "cancel", tone: "warn", icon: <Ban size={17} />, text: `La suscripción se cancela el ${formatDate(subscription.cancel_at)}. Hasta entonces todo sigue funcionando.`, action: <ConfirmAction label="Reanudar" icon={<RotateCcw size={15} />} formId="subscription-resume" title="Reanudar suscripción" description="Se anula la cancelación y vuelve la renovación automática." submitLabel="Reanudar" action={resumeSubscription} /> });
  }

  if (subscription.scheduled && subscription.scheduled.kind !== "cancel") {
    const target = subscription.scheduled.plan ? `al plan ${subscription.scheduled.plan}` : "de ciclo";
    banners.push({ key: "scheduled", tone: "t1", icon: <ArrowUpRight size={17} />, text: `Cambio programado ${target}${subscription.scheduled.cycle ? ` (${subscription.scheduled.cycle === "annual" ? "anual" : "mensual"})` : ""} desde el ${formatDate(subscription.scheduled.effective_at)}.`, action: <ConfirmAction label="Anular" icon={<Undo2 size={15} />} formId="subscription-void-change" title="Anular cambio programado" description="Sigues con tu plan actual en la renovación." submitLabel="Anular cambio" action={voidScheduledChange} /> });
  }

  if (overdue.length > 0) {
    const total = overdue.reduce((sum, invoice) => sum + invoice.total, 0);
    banners.push({ key: "overdue", tone: "bad", icon: <XCircle size={17} />, text: `${overdue.length === 1 ? "Tienes 1 factura pendiente" : `Tienes ${overdue.length} facturas pendientes`} por ${formatMoney(total, currency)}.`, action: <PayInvoiceAction number={overdue[0].number} total={overdue[0].total} currency={currency} /> });
  }

  if (near > 0) {
    banners.push({ key: "usage", tone: "warn", icon: <CircleAlert size={17} />, text: `${near === 1 ? "Un límite del plan supera" : `${near} límites del plan superan`} el 80 % este mes. Revisa el consumo o suma un complemento.` });
  }

  if (banners.length === 0) return null;

  return (
    <div className="mb-5 flex flex-col gap-2.5">
      {banners.map((banner) => (
        <div key={banner.key} className={cn("flex flex-wrap items-center gap-3 rounded-[14px] border px-4 py-3 text-[13.5px]", banner.tone === "bad" ? "border-[color-mix(in_srgb,var(--bad)_30%,transparent)] bg-[color-mix(in_srgb,var(--bad)_6%,var(--surface))]" : banner.tone === "warn" ? "border-[color-mix(in_srgb,var(--warn)_30%,transparent)] bg-[color-mix(in_srgb,var(--warn)_7%,var(--surface))]" : "border-accent/25 bg-accent/5")}>
          <span className={banner.tone === "bad" ? "text-bad" : banner.tone === "warn" ? "text-warn" : "text-accent"}>{banner.icon}</span>
          <p className="min-w-0 flex-1">{banner.text}</p>
          {banner.action}
        </div>
      ))}
    </div>
  );
}

export function PayInvoiceAction({ number, total, currency }: { number: string; total: number; currency: string }) {
  return (
    <PanelAction<AdminActionState> label="Pagar ahora" size="sm" variant="primary" formId={`invoice-pay-${number}`} title={`Pagar factura ${number}`} description={`Cobraremos ${formatMoney(total, currency)} con tu tarjeta registrada.`} submitLabel="Pagar" action={payInvoice} initial={ADMIN_INITIAL}>
      {() => <input type="hidden" name="number" value={number} />}
    </PanelAction>
  );
}

function periodDays(subscription: Subscription): { left: number; total: number } {
  const start = new Date(`${subscription.period_start}T12:00:00`).getTime();
  const end = new Date(`${subscription.period_end}T12:00:00`).getTime();
  const total = Math.max(1, Math.round((end - start) / 86_400_000) + 1);
  const left = Math.max(0, Math.min(total, Math.round((end - Date.now()) / 86_400_000) + 1));
  return { left, total };
}

function AddonFields({ offer, subscription, currency, current }: { offer: AddonOffer; subscription: Subscription; currency: string; current: number }) {
  const [quantity, setQuantity] = useState(Math.max(1, current || 1));
  const { left, total } = periodDays(subscription);
  const delta = quantity - current;
  const prorated = subscription.status === "trialing" ? 0 : (offer.price * Math.max(0, delta) * left) / total;
  return (
    <>
      <input type="hidden" name="code" value={offer.code} />
      {offer.quantity_allowed && <TextField label={`Cantidad (${offer.unit})`} name="quantity" type="number" inputMode="numeric" min={1} max={100} defaultValue={String(quantity)} required onChange={(event) => setQuantity(Math.max(1, Number(event.target.value) || 1))} />}
      {offer.code === "custom_domain" && current === 0 && <TextField label="Dominio" name="domain" required placeholder="reservas.miagencia.pe" hint="Crea un registro CNAME hacia tenants.kipucontrol.com; el certificado SSL se emite al validar el DNS." />}
      <FieldList
        fields={[
          { label: "Precio mensual", value: formatMoney(offer.price * quantity, currency) },
          { label: `Hoy (${left} de ${total} días)`, value: prorated > 0 ? `${formatMoney(prorated, currency)} + IGV` : "Sin cargo" },
          { label: "Desde la renovación", value: `${formatMoney(offer.price * quantity, currency)} al mes + IGV` },
        ]}
      />
    </>
  );
}

export function AddonsTable({ data, manage }: { data: SubscriptionOverview; manage: boolean }) {
  const subscription = data.subscription;
  const currency = data.plan?.currency ?? "PEN";
  if (!subscription) return null;
  const billable = data.addons.reduce((sum, addon) => sum + addon.quantity * addon.unit_price, 0);
  return (
    <div>
      <ul className="mb-4 grid gap-2 xl:grid-cols-3">
        {[
          { icon: CalendarPlus, title: "Hoy, lo proporcional", text: "Se cobran solo los días que quedan del periodo." },
          { icon: Receipt, title: "En tu factura mensual", text: "Desde el siguiente periodo van con el plan." },
          { icon: CalendarX2, title: "Al retirar, hasta el cierre", text: "Sigue activo hasta fin de periodo, sin reembolso parcial." },
        ].map((item) => (
          <li key={item.title} className="lift flex items-start gap-2.5 rounded-tile border border-line px-3 py-2.5">
            <span className="grid h-8 w-8 flex-none place-items-center rounded-lg bg-accent/10 text-accent">
              <item.icon size={15} />
            </span>
            <span className="min-w-0 text-[12px] text-fg-3">
              <b className="block text-[12.5px] font-semibold text-fg">{item.title}</b>
              {item.text}
            </span>
          </li>
        ))}
      </ul>
      <div className="scroll-thin overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-line text-left text-[12px] text-fg-3">
              <th className="py-2 pr-3 font-medium">Complemento</th>
              <th className="py-2 pr-3 text-right font-medium">Precio</th>
              <th className="py-2 pr-3 font-medium">Estado</th>
              <th className="py-2 text-right font-medium">Acción</th>
            </tr>
          </thead>
          <tbody>
            {data.addon_catalog.map((offer) => {
              const active = data.addons.find((addon) => addon.code === offer.code);
              const state = offer.included ? "included" : active ? (active.ends_at ? "leaving" : "active") : offer.available ? "offer" : "locked";
              return (
                <tr key={offer.code} className="border-b border-line-2 align-middle transition-colors hover:bg-surface-2">
                  <td className="py-3 pr-3">
                    <b className="block font-semibold">{offer.label}</b>
                    {active?.detail && <span className="font-mono text-[11.5px] text-fg-3">{active.detail}</span>}
                  </td>
                  <td className="py-3 pr-3 text-right tabular-nums">
                    {offer.included ? "—" : (
                      <>
                        {formatMoney(offer.price, currency)}
                        <span className="block text-[11px] text-fg-3">por {offer.unit} al mes</span>
                      </>
                    )}
                  </td>
                  <td className="py-3 pr-3">
                    {state === "included" && <Badge tone="ok">Incluido en tu plan</Badge>}
                    {state === "active" && <Badge tone="ok">Activo{offer.quantity_allowed ? ` × ${active!.quantity}` : ""}</Badge>}
                    {state === "leaving" && <Badge tone="sun">Se retira el {formatDate(active!.ends_at!)}</Badge>}
                    {state === "offer" && <span className="text-[12.5px] text-fg-3">No contratado</span>}
                    {state === "locked" && <Badge tone="mute">No disponible en tu plan</Badge>}
                  </td>
                  <td className="py-3 text-right">
                    {manage && (
                      <span className="inline-flex gap-1.5">
                        {state === "offer" && (
                          <PanelAction<AdminActionState> label="Contratar" icon={<Plus size={15} />} size="sm" variant="primary" formId={`addon-add-${offer.code}`} title={`Contratar ${offer.label}`} description="Se cobra hoy la parte proporcional del periodo y luego cada mes con tu plan." submitLabel="Contratar" action={addAddon} initial={ADMIN_INITIAL}>
                            {() => <AddonFields offer={offer} subscription={subscription} currency={currency} current={0} />}
                          </PanelAction>
                        )}
                        {state === "active" && offer.quantity_allowed && (
                          <PanelAction<AdminActionState> label="Ajustar" size="sm" formId={`addon-update-${offer.code}`} title={`Ajustar ${offer.label}`} description="Subir se cobra hoy por los días que quedan. No puedes bajar de lo que ya consumiste este periodo." submitLabel="Guardar" action={updateAddon} initial={ADMIN_INITIAL}>
                            {() => <AddonFields offer={offer} subscription={subscription} currency={currency} current={active!.quantity} />}
                          </PanelAction>
                        )}
                        {state === "active" && (
                          <PanelAction<AdminActionState> label="Retirar" icon={<Minus size={15} />} size="sm" variant="ghost" formId={`addon-remove-${offer.code}`} title={`Retirar ${offer.label}`} description={`Sigue activo hasta el ${formatDate(subscription.period_end)} y no se cobra en la renovación.`} submitLabel="Programar retiro" action={removeAddon} initial={ADMIN_INITIAL}>
                            {() => <input type="hidden" name="code" value={offer.code} />}
                          </PanelAction>
                        )}
                        {state === "leaving" && (
                          <PanelAction<AdminActionState> label="Mantener" icon={<RotateCcw size={15} />} size="sm" formId={`addon-keep-${offer.code}`} title={`Mantener ${offer.label}`} description="Se anula el retiro y sigue en la renovación." submitLabel="Mantener" action={addAddon} initial={ADMIN_INITIAL}>
                            {() => <input type="hidden" name="code" value={offer.code} />}
                          </PanelAction>
                        )}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-[12.5px] text-fg-2">
        Total de complementos facturables: <b>{formatMoney(billable, currency)}</b> al mes + IGV.
      </p>
    </div>
  );
}

export function SendInvoiceAction({ number }: { number: string }) {
  return (
    <PanelAction<AdminActionState> label="Reenviar por correo" icon={<Mail size={15} />} size="sm" variant="ghost" formId={`invoice-send-${number}`} title={`Reenviar factura ${number}`} description="La enviamos al correo para comprobantes de tus datos de facturación." submitLabel="Reenviar" action={sendInvoice} initial={ADMIN_INITIAL}>
      {() => <input type="hidden" name="number" value={number} />}
    </PanelAction>
  );
}
