"use client";

import { Check, CircleCheck, CirclePause, CirclePlay, Gift, Hourglass, Pencil, Plus, TicketX } from "lucide-react";
import { useState } from "react";
import { saveCoupon, setCouponStatus } from "@/app/plataforma/(consola)/facturacion/actions";
import { DataTable } from "@/components/table/DataTable";
import { RowActions } from "@/components/table/RowActions";
import type { Column, FilterConfig, MetricFilter, SortOption } from "@/components/table/types";
import { Badge } from "@/components/ui/Badge";
import { ChoiceGroup } from "@/components/ui/ChoiceGroup";
import { TextArea } from "@/components/ui/TextArea";
import { TextField } from "@/components/ui/TextField";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/format";
import { planTone } from "@/lib/platform";
import type { Coupon } from "@/lib/platformBilling";
import { toneStyle } from "@/lib/tone";
import { ConsoleAction } from "./ConsoleAction";

type PlanOption = { code: string; name: string; rank: number };

const state = (coupon: Coupon) => (coupon.status === "inactive" ? { label: "Desactivado", tone: "mute" as const } : coupon.expired ? { label: "Vencido", tone: "warn" as const } : coupon.exhausted ? { label: "Agotado", tone: "warn" as const } : { label: "Activo", tone: "ok" as const });

function PlanPicker({ plans, selected }: { plans: PlanOption[]; selected: string[] }) {
  const [value, setValue] = useState<string[]>(selected);
  const toggle = (code: string) => setValue((current) => (current.includes(code) ? current.filter((item) => item !== code) : [...current, code]));

  return (
    <fieldset>
      <legend className="mb-1.5 text-[13px] font-semibold">Planes</legend>
      <div className="flex flex-wrap gap-2">
        {plans.map((plan) => {
          const on = value.includes(plan.code);
          return (
            <button
              key={plan.code}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(plan.code)}
              style={toneStyle(planTone(plan.rank))}
              className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-semibold transition-[transform,background-color,color] duration-200 hover:-translate-y-0.5", on ? "border-[var(--tint)] bg-[var(--tint)] text-white" : "border-line bg-surface text-fg-2")}
            >
              {on && <Check size={14} />}
              {plan.name}
            </button>
          );
        })}
      </div>
      {value.map((code) => (
        <input key={code} type="hidden" name="plans" value={code} />
      ))}
      <p className="mt-1.5 text-[12.5px] text-fg-3">Solo las agencias de estos planes pueden canjearlo.</p>
    </fieldset>
  );
}

export function CouponFormAction({ coupon, plans }: { coupon?: Coupon; plans: PlanOption[] }) {
  return (
    <ConsoleAction
      id={coupon ? `coupon-${coupon.code}` : "coupon-new"}
      label={coupon ? "Editar" : "Nuevo cupón"}
      icon={coupon ? <Pencil size={15} /> : <Plus size={16} strokeWidth={2.4} />}
      rowTone={coupon ? "edit" : undefined}
      variant={coupon ? "secondary" : "primary"}
      title={coupon ? `Editar ${coupon.code}` : "Nuevo cupón"}
      description={coupon ? `Ya tiene ${coupon.redeemed} ${coupon.redeemed === 1 ? "canje" : "canjes"}. Los cambios rigen para los canjes nuevos.` : "Las agencias lo canjean al suscribirse o desde su portal. No se acumula con otros cupones."}
      submitLabel={coupon ? "Guardar cambios" : "Crear cupón"}
      action={saveCoupon}
      fields={coupon ? { original: coupon.code } : {}}
    >
      {!coupon && <TextField label="Código" name="code" required minLength={4} maxLength={20} pattern="[A-Za-z0-9_\-]{4,20}" placeholder="VERANO26" hint="De 4 a 20 letras, números o guiones. Se guarda en mayúsculas." className="uppercase" />}
      <ChoiceGroup
        label="Tipo de descuento"
        name="type"
        options={[
          { value: "percent", label: "Porcentaje" },
          { value: "fixed", label: "Monto fijo" },
        ]}
        defaultValue={coupon?.type ?? "percent"}
      />
      <div className="grid grid-cols-2 gap-3">
        <TextField label="Valor" name="value" type="number" min={0.01} step="0.01" required defaultValue={coupon?.value ?? ""} hint="Hasta 50 si es porcentaje." />
        <TextField label="Ciclos que dura" name="duration_cycles" type="number" min={1} max={12} required defaultValue={coupon?.duration_cycles ?? 3} />
        <TextField label="Canjes máximos" name="max_redemptions" type="number" min={Math.max(1, coupon?.redeemed ?? 1)} defaultValue={coupon?.max_redemptions ?? ""} hint="Vacío: sin tope." />
        <TextField label="Válido hasta" name="valid_to" type="date" defaultValue={coupon?.valid_to ?? ""} hint="Vacío: sin vencimiento." />
      </div>
      <PlanPicker plans={plans} selected={coupon?.plans.map((plan) => plan.code) ?? plans.map((plan) => plan.code)} />
      <TextArea label="Nota interna" name="note" maxLength={200} defaultValue={coupon?.note ?? ""} placeholder="Para qué campaña o caso se creó." />
    </ConsoleAction>
  );
}

function CouponStatusAction({ coupon }: { coupon: Coupon }) {
  const activate = coupon.status === "inactive";
  const blocked = activate && (coupon.expired || coupon.exhausted);
  return (
    <ConsoleAction
      id={`coupon-status-${coupon.code}`}
      label={activate ? "Activar" : "Desactivar"}
      icon={activate ? <CirclePlay size={15} /> : <CirclePause size={15} />}
      rowTone={activate ? "neutral" : "delete"}
      title={activate ? `Activar ${coupon.code}` : `Desactivar ${coupon.code}`}
      description={blocked ? `No se puede activar: el cupón está ${coupon.expired ? "vencido" : "agotado"}. Crea uno nuevo.` : activate ? "Las agencias podrán volver a canjearlo mientras esté vigente y tenga canjes disponibles." : "Nadie más podrá canjearlo. Las agencias que ya lo usan conservan su descuento hasta completar los ciclos."}
      submitLabel={activate ? "Activar" : "Desactivar"}
      action={setCouponStatus}
      fields={{ code: coupon.code, active: activate ? "1" : "0" }}
    />
  );
}

function Redemptions({ coupon }: { coupon: Coupon }) {
  const pct = coupon.max_redemptions ? Math.min(100, (coupon.redeemed / coupon.max_redemptions) * 100) : null;
  return (
    <div className="group w-full min-w-[120px]">
      <p className="mb-1 font-mono text-[12.5px]">
        <b className="font-semibold">{coupon.redeemed}</b>
        <span className="text-fg-3"> / {coupon.max_redemptions ?? "sin tope"}</span>
      </p>
      {pct !== null && (
        <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
          <span className={cn("block h-full origin-left rounded-full transition-[filter] duration-300 group-hover:brightness-110 motion-safe:animate-[fill-x_700ms_cubic-bezier(0.4,0,0.2,1)_backwards]", pct >= 90 ? "bg-bad" : pct >= 60 ? "bg-warn" : "bg-ok")} style={{ width: `${Math.max(pct, 3)}%` }} />
        </div>
      )}
    </div>
  );
}

const metrics: MetricFilter<Coupon>[] = [
  { id: "active", label: "Activos", tone: "ok", icon: <CircleCheck size={19} />, matches: (coupon) => state(coupon).label === "Activo" },
  { id: "spent", label: "Vencidos o agotados", tone: "warn", icon: <Hourglass size={19} />, matches: (coupon) => coupon.status === "active" && (coupon.expired || coupon.exhausted) },
  { id: "inactive", label: "Desactivados", tone: "mute", icon: <TicketX size={19} />, matches: (coupon) => coupon.status === "inactive" },
];

const sorts: SortOption<Coupon>[] = [
  { id: "created", label: "Fecha de creación", type: "date", value: (coupon) => coupon.created_at },
  { id: "redeemed", label: "Canjes", type: "number", value: (coupon) => coupon.redeemed },
  { id: "valid", label: "Vigencia", type: "date", value: (coupon) => coupon.valid_to },
];

export function CouponsTable({ coupons, plans }: { coupons: Coupon[]; plans: PlanOption[] }) {
  const columns: Column<Coupon>[] = [
    {
      id: "code",
      header: "Cupón",
      mobile: "title",
      cell: (coupon) => (
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 flex-none place-items-center rounded-[10px] bg-[color-mix(in_srgb,var(--violet)_14%,transparent)] text-[var(--violet)]">
            <Gift size={17} />
          </span>
          <span className="min-w-0">
            <b className="block font-mono text-[13.5px] font-semibold tracking-wide">{coupon.code}</b>
            <small className="block truncate text-xs text-fg-3">{coupon.note ?? "Sin nota"}</small>
          </span>
        </div>
      ),
    },
    { id: "discount", header: "Descuento", cell: (coupon) => <span className="text-[13.5px] font-semibold">{coupon.label}</span> },
    {
      id: "plans",
      header: "Planes",
      wideOnly: true,
      cell: (coupon) => (
        <span className="flex flex-wrap gap-1">
          {coupon.plans.map((plan) => (
            <Badge key={plan.code} tone={planTone(plans.find((item) => item.code === plan.code)?.rank ?? 1)} dot={false}>
              {plan.name}
            </Badge>
          ))}
        </span>
      ),
    },
    { id: "redeemed", header: "Canjes", cell: (coupon) => <Redemptions coupon={coupon} /> },
    { id: "valid", header: "Vigencia", wideOnly: true, cell: (coupon) => <span className="text-[13px]">{coupon.valid_to ? `Hasta el ${formatDate(coupon.valid_to)}` : "Sin vencimiento"}</span> },
    { id: "status", header: "Estado", cell: (coupon) => <Badge tone={state(coupon).tone}>{state(coupon).label}</Badge> },
    {
      id: "actions",
      header: "",
      mobile: "hidden",
      align: "right",
      cell: (coupon) => (
        <RowActions>
          <CouponFormAction coupon={coupon} plans={plans} />
          <CouponStatusAction coupon={coupon} />
        </RowActions>
      ),
    },
  ];
  const filters: FilterConfig<Coupon>[] = [
    { id: "type", label: "Tipo", options: [{ value: "percent", label: "Porcentaje" }, { value: "fixed", label: "Monto fijo" }], value: (coupon) => coupon.type },
    { id: "plan", label: "Plan", options: plans.map((plan) => ({ value: plan.code, label: plan.name })), value: (coupon) => coupon.plans.map((plan) => plan.code) },
  ];

  return <DataTable screen="plataforma-cupones" rows={coupons} columns={columns} getKey={(coupon) => coupon.id} entityLabel="cupones" searchText={(coupon) => `${coupon.code} ${coupon.note ?? ""}`} searchPlaceholder="Buscar cupón" metrics={metrics} filters={filters} sorts={sorts} />;
}
