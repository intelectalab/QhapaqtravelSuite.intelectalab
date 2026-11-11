import { ArrowRight, BedDouble, Building2, CalendarCheck, CircleSlash, Clock, Hotel, MapPin, Plane, TriangleAlert, Wallet } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { InfoTip } from "@/components/ui/InfoTip";
import { SimpleTable } from "@/components/ui/SimpleTable";
import { BOOKING_SECTION_RULE_NOTE, CHARGE_LABEL, PAX_TYPE_LABEL, PAYMENT_MODE_LABEL, WEEKDAYS, type BookingSectionId, type ProductBookingConfig } from "@/lib/catalog-booking";
import { cn } from "@/lib/cn";
import { formatDate, formatMoney } from "@/lib/format";
import { AccommodationAction, AddonAction, AddonDeleteAction, HotelAction, HotelDeleteAction, LegAction, LegDeleteAction, LegMoveButtons, OperationAction, PaxRulesAction, PaxRulesResetAction, PaymentAction, PaymentResetAction, PickupAction, RuleParamsAction, RuleResetAction, RuleToggleAction } from "./BookingForms";
import { PaxSimulator } from "./PaxSimulator";

type Config = ProductBookingConfig;

export function BookingCard({ title, hint, action, children }: { title: string; hint?: ReactNode; action?: ReactNode; children: ReactNode }) {
  return (
    <Card>
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-[15px] font-semibold tracking-tight">{title}</h3>
          {hint && <p className="mt-0.5 text-[12.5px] text-fg-3">{hint}</p>}
        </div>
        {action && <span className="flex flex-wrap items-center gap-2">{action}</span>}
      </header>
      {children}
    </Card>
  );
}

function RuleNotice({ config, section }: { config: Config; section: BookingSectionId }) {
  const status = config.sections[section].status;
  const note = BOOKING_SECTION_RULE_NOTE[status];
  if (!note) return null;
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-warn/30 bg-warn/[0.07] px-3.5 py-2.5 text-[13px]">
      <CircleSlash size={15} className="text-warn" />
      <span className="flex-1">{note}</span>
      {status === "tenant_off" && config.can.admin_rules && <SmallLink href="/admin/reglas" label="Centro de reglas" />}
      {status === "product_off" && <SmallLink href={`?seccion=reglas`} label="Ver reglas del producto" />}
    </div>
  );
}

function SmallLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1 text-[13px] font-semibold text-accent hover:underline">
      {label}
      <ArrowRight size={14} />
    </Link>
  );
}

function Warnings({ items }: { items: string[] }) {
  if (items.length === 0) return null;
  return (
    <ul className="mt-4 flex flex-col gap-1.5">
      {items.map((item) => (
        <li key={item} className="flex gap-2 text-[12.5px] text-warn">
          <TriangleAlert size={14} className="mt-0.5 flex-none" />
          {item}
        </li>
      ))}
    </ul>
  );
}

function Fact({ label, value, note }: { label: string; value: ReactNode; note?: string }) {
  return (
    <div className="lift rounded-[14px] border border-line px-4 py-3">
      <p className="text-[12px] font-medium text-fg-3">{label}</p>
      <p className="mt-0.5 text-[18px] font-bold tracking-tight">{value}</p>
      {note && <p className="text-[12px] text-fg-3">{note}</p>}
    </div>
  );
}

export function OperationCard({ config }: { config: Config }) {
  const days = new Set(config.operation.operating_weekdays.map(String));
  return (
    <BookingCard title="Operación" hint="Días en que se vende y anticipación mínima para reservar (R-WEEKDAYS y R-CUTOFF)." action={config.can.manage_availability && config.product.status !== "ARCHIVED" ? <OperationAction config={config} /> : undefined}>
      <RuleNotice config={config} section="disponibilidad" />
      <div className="flex flex-wrap items-center gap-1.5">
        {WEEKDAYS.map((day) => (
          <span key={day.value} className={cn("grid h-9 w-11 place-items-center rounded-lg border text-[12.5px] font-semibold transition", days.has(day.value) ? "border-accent bg-accent/10 text-accent" : "border-line text-fg-3 line-through")}>
            {day.label}
          </span>
        ))}
        <span className="ml-2 inline-flex items-center gap-1.5 text-[13px] text-fg-2">
          <Clock size={14} />
          {config.operation.cutoff_hours !== null ? `${config.operation.cutoff_hours} h de anticipación` : `Anticipación de la ficha: ${config.operation.advance_min_days} día(s)`}
        </span>
      </div>
      <p className="mt-3 text-[12.5px] text-fg-3">
        {config.summary.ranges} rango(s) de venta vigentes. <SmallLink href="/catalogo/salidas/rangos" label="Rangos de venta" />
      </p>
    </BookingCard>
  );
}

function AgeBands({ rules }: { rules: Config["pax_rules"]["effective"] }) {
  const top = Math.max(rules.adult_min_age + 6, 18);
  const width = (from: number, to: number) => `${(Math.max(0, to - from + 1) / (top + 1)) * 100}%`;
  const bands = [
    { label: "Infante", from: 0, to: rules.infant_max_age, tone: "bg-[color-mix(in_srgb,var(--violet)_70%,transparent)]" },
    { label: "Sin banda", from: rules.infant_max_age + 1, to: rules.child_min_age - 1, tone: "bg-bad/50" },
    { label: "Niño", from: rules.child_min_age, to: rules.child_max_age, tone: "bg-accent/70" },
    { label: "Sin banda", from: rules.child_max_age + 1, to: rules.adult_min_age - 1, tone: "bg-bad/50" },
    { label: "Adulto", from: rules.adult_min_age, to: top, tone: "bg-ok/70" },
  ].filter((band) => band.to >= band.from);
  return (
    <div>
      <div className="flex h-9 overflow-hidden rounded-xl">
        {bands.map((band, index) => (
          <span key={`${band.label}-${index}`} title={`${band.label}: ${band.from} a ${band.to === top ? "más" : band.to} años`} className={cn("grid origin-left place-items-center text-[11.5px] font-semibold text-white transition hover:brightness-110 motion-safe:animate-[fill-x_620ms_cubic-bezier(0.22,1,0.36,1)_backwards]", band.tone)} style={{ width: width(band.from, band.to), animationDelay: `${index * 90}ms` }}>
            {band.label}
          </span>
        ))}
      </div>
      <div className="mt-1 flex justify-between font-mono text-[11px] text-fg-3">
        <span>0</span>
        <span>{rules.infant_max_age}</span>
        <span>{rules.child_min_age}–{rules.child_max_age}</span>
        <span>{rules.adult_min_age}+</span>
      </div>
    </div>
  );
}

export function PaxSection({ config }: { config: Config }) {
  const rules = config.pax_rules.effective;
  const editable = config.can.update && config.product.status !== "ARCHIVED";
  return (
    <BookingCard
      title="Pasajeros"
      hint={
        <>
          {config.pax_rules.inherited ? "Usa las reglas de la agencia." : "Reglas propias del producto."}
          <InfoTip label="De dónde salen">Primero las reglas guardadas en el producto; si no hay, las de la agencia. Si una regla del centro está apagada, se quitan sus límites (R-CHILD-PER-ADULT, R-INFANT-FREE, R-MIN-ADULTS).</InfoTip>
        </>
      }
      action={
        editable ? (
          <>
            {!config.pax_rules.inherited && <PaxRulesResetAction config={config} />}
            <PaxRulesAction config={config} />
          </>
        ) : undefined
      }
    >
      <RuleNotice config={config} section="pasajeros" />
      <AgeBands rules={rules} />
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Fact label="Niño" value={rules.child_pays ? `${Number(rules.child_price_pct)} %` : "Gratis"} note={rules.child_pays ? "del adulto si no hay tarifa Niño" : "no paga tour"} />
        <Fact label="Infante" value={!rules.infant_allowed ? "No admitido" : rules.infant_pays ? "Paga" : "Gratis"} note={`hasta ${rules.infant_max_age} años`} />
        <Fact label="Por adulto" value={`${rules.max_children_per_adult >= 99 ? "∞" : rules.max_children_per_adult} · ${rules.max_infants_per_adult >= 99 ? "∞" : rules.max_infants_per_adult}`} note="niños · infantes" />
        <Fact label="Adultos mínimos" value={rules.min_adults} />
      </div>
      {config.pax_rules.values?.note && <p className="mt-3 text-[13px] text-fg-2">{config.pax_rules.values.note}</p>}
      <Warnings items={config.pax_rules.warnings} />
      <div className="mt-5">
        <PaxSimulator code={config.product.code} />
      </div>
    </BookingCard>
  );
}

export function AddonsSection({ config }: { config: Config }) {
  const editable = config.can.manage_rates && config.product.status !== "ARCHIVED";
  return (
    <BookingCard title="Adicionales" hint="Lo que el cliente suma a su reserva. Al eliminarlos, las reservas hechas no cambian." action={editable ? <AddonAction config={config} /> : undefined}>
      <RuleNotice config={config} section="adicionales" />
      <SimpleTable
        testId="product-addons"
        columns={[{ header: "Adicional" }, { header: "Categoría" }, { header: "Aplica a" }, { header: "Precio", align: "right" }, { header: "Proveedor" }, ...(editable ? [{ header: "" }] : [])]}
        rows={config.addons.map((addon) => ({
          key: addon.code,
          cells: [
            <span key="name">
              <b className="block font-semibold">{addon.name}</b>
              <span className="font-mono text-[12px] text-fg-3">{addon.code}{addon.is_optional ? "" : " · obligatorio"}{addon.stock_note ? ` · ${addon.stock_note}` : ""}</span>
            </span>,
            <Badge key="cat" tone="info">{addon.category}</Badge>,
            addon.applies_to.map((type) => PAX_TYPE_LABEL[type] ?? type).join(" · "),
            <span key="price" className="font-mono">
              {formatMoney(addon.price, addon.currency)}
              <span className="block text-[11.5px] font-normal text-fg-3">{CHARGE_LABEL[addon.charge_per]}</span>
            </span>,
            addon.service ? `${addon.provider?.name ?? "—"} · ${addon.service.ref}` : (addon.provider?.name ?? "—"),
            ...(editable
              ? [
                  <span key="actions" className="flex justify-end gap-1.5">
                    <AddonAction config={config} addon={addon} />
                    <AddonDeleteAction config={config} addon={addon} />
                  </span>,
                ]
              : []),
          ],
        }))}
        empty="Sin adicionales."
      />
    </BookingCard>
  );
}

export function LodgingSection({ config }: { config: Config }) {
  const lodging = config.accommodation;
  const editable = config.can.manage_rates && config.product.status !== "ARCHIVED";
  const example = config.examples.lodging;
  const currency = lodging.currency ?? "USD";
  return (
    <BookingCard
      title="Alojamiento"
      hint={lodging.enabled ? `${lodging.optional ? "Opcional" : "Incluido"} · ${lodging.cities} ciudad(es) · ${lodging.nights} noche(s)${lodging.expected_nights !== null ? ` de ${lodging.expected_nights} según la duración` : ""}` : "El producto no ofrece alojamiento."}
      action={
        editable ? (
          <>
            {lodging.enabled && <LegAction config={config} />}
            <AccommodationAction config={config} />
          </>
        ) : undefined
      }
    >
      <RuleNotice config={config} section="alojamiento" />
      {lodging.note && <p className="mb-3 text-[13px] text-fg-2">{lodging.note}</p>}
      {lodging.legs.length === 0 ? (
        <p className="rounded-[14px] border border-dashed border-line px-4 py-6 text-center text-[13px] text-fg-3">{lodging.enabled ? "Agrega el primer tramo: la ciudad y sus noches." : "Activa el alojamiento para armar los tramos por ciudad."}</p>
      ) : (
        <ol className={cn("grid gap-3 lg:grid-cols-2", !lodging.enabled && "opacity-60")}>
          {lodging.legs.map((leg, index) => (
            <li key={leg.id} className="lift rounded-[14px] border border-line p-4">
              <div className="mb-3 flex items-center gap-2">
                <span className="grid h-7 min-w-7 place-items-center rounded-full bg-accent px-1.5 text-[12px] font-bold text-white">{index + 1}</span>
                <span className="flex-1">
                  <b className="block text-[14px] font-semibold">{leg.city}</b>
                  <span className="text-[12px] text-fg-3">{leg.nights} noche(s){leg.destination?.name ? ` · ${leg.destination.name}` : ""}</span>
                </span>
                {editable && (
                  <span className="flex gap-1">
                    <LegMoveButtons config={config} index={index} />
                    <LegAction config={config} leg={leg} />
                    <LegDeleteAction config={config} leg={leg} />
                  </span>
                )}
              </div>
              <ul className="flex flex-col gap-2">
                {leg.hotels.map((hotel) => (
                  <li key={hotel.id} className="rounded-xl bg-surface-2/60 px-3 py-2.5">
                    <div className="flex items-start gap-2">
                      <Hotel size={15} className="mt-0.5 flex-none text-fg-3" />
                      <span className="flex-1 text-[13px]">
                        <b className="font-semibold">{hotel.name}</b>
                        <span className="block text-[12px] text-fg-3">{hotel.category}{hotel.provider?.name ? ` · ${hotel.provider.name}` : ""}</span>
                      </span>
                      {editable && (
                        <span className="flex gap-1">
                          <HotelAction config={config} leg={leg} hotel={hotel} />
                          <HotelDeleteAction config={config} leg={leg} hotel={hotel} />
                        </span>
                      )}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {hotel.room_types.map((room) => (
                        <span key={room.room_type} title={`Capacidad ${room.capacity}`} className="inline-flex items-center gap-1 rounded-full border border-line bg-surface px-2.5 py-1 text-[12px]">
                          <BedDouble size={12} className="text-fg-3" />
                          {room.room_type} · <b className="font-mono font-semibold">{formatMoney(room.price_per_night, currency)}</b>
                        </span>
                      ))}
                    </div>
                  </li>
                ))}
                {leg.hotels.length === 0 && <li className="text-[12.5px] text-warn">Sin hoteles en este tramo.</li>}
              </ul>
              {editable && (
                <div className="mt-2">
                  <HotelAction config={config} leg={leg} />
                </div>
              )}
            </li>
          ))}
        </ol>
      )}
      <Warnings items={lodging.warnings} />
      {example && (
        <div className="mt-5 rounded-[14px] border border-accent/25 bg-accent/[0.04] px-4 py-3">
          <p className="flex items-center gap-2 text-[13px] font-semibold">
            <Building2 size={15} className="text-accent" />
            Ejemplo del motor: {example.pax} adultos en la doble más económica · {example.rooms} habitación(es) · {example.nights} noche(s) ·{" "}
            <span className="font-mono">{formatMoney(example.total, example.currency)}</span>
            <InfoTip label="Cómo se calcula">El motor de reservas multiplica el precio por habitación por las noches de cada tramo y suma los tramos. Es el mismo cálculo que usa el sitio al reservar.</InfoTip>
          </p>
          <Warnings items={example.warnings} />
        </div>
      )}
    </BookingCard>
  );
}

export function PaymentSection({ config }: { config: Config }) {
  const payment = config.payment;
  const editable = config.can.manage_rates && config.product.status !== "ARCHIVED";
  const examples = new Map(config.examples.payment.map((example) => [example.mode, example]));
  const cards = [
    { mode: "total", detail: "Se cobra todo al reservar." },
    { mode: "adelanto", detail: `${payment.values?.deposit_pct ?? payment.tenant.deposit_pct} % al reservar, saldo ${payment.values?.balance_due_days ?? payment.tenant.balance_due_days} días antes.` },
    { mode: "pagar_despues", detail: `Bloquea cupos ${payment.tenant.hold_hours} h sin cobrar.` },
  ];
  return (
    <BookingCard
      title="Pago"
      hint={payment.inherited ? "Usa la política de la agencia." : "Política propia del producto."}
      action={
        editable ? (
          <>
            {!payment.inherited && <PaymentResetAction config={config} />}
            <PaymentAction config={config} />
          </>
        ) : undefined
      }
    >
      <RuleNotice config={config} section="pago" />
      <div className="grid gap-3 md:grid-cols-3">
        {cards.map((card) => {
          const on = payment.effective_modes.includes(card.mode);
          const example = examples.get(card.mode);
          return (
            <div key={card.mode} className={cn("lift rounded-[14px] border p-4", on ? "border-accent/40" : "border-line opacity-55")}>
              <p className="flex items-center gap-2 text-[13.5px] font-semibold">
                <Wallet size={15} className={on ? "text-accent" : "text-fg-3"} />
                {PAYMENT_MODE_LABEL[card.mode]}
                <Badge tone={on ? "ok" : "mute"}>{on ? "Se ofrece" : "No se ofrece"}</Badge>
              </p>
              <p className="mt-1 text-[12.5px] text-fg-3">{card.detail}</p>
              {on && example && (
                <p className="mt-3 border-t border-line-2 pt-2 font-mono text-[12.5px]">
                  {Number(example.balance) === 0 ? `${formatMoney(example.total, example.currency)} al reservar` : Number(example.deposit) === 0 ? `${formatMoney(example.balance, example.currency)} dentro de ${example.hold_hours ?? 0} h` : `${formatMoney(example.deposit, example.currency)} hoy · ${formatMoney(example.balance, example.currency)} ${example.balance_due ? `el ${formatDate(example.balance_due)}` : "después"}`}
                </p>
              )}
            </div>
          );
        })}
      </div>
      {config.examples.payment[0] && (
        <p className="mt-3 text-[12px] text-fg-3">
          Ejemplo para 2 adultos con salida el {formatDate(config.examples.payment[0].date)}, total {formatMoney(config.examples.payment[0].total, config.examples.payment[0].currency)}. Lo calcula el motor de reservas.
        </p>
      )}
      {payment.values?.note && <p className="mt-2 text-[13px] text-fg-2">{payment.values.note}</p>}
    </BookingCard>
  );
}

export function PickupSection({ config }: { config: Config }) {
  const pickup = config.pickup;
  const editable = config.can.manage_pickup && config.product.status !== "ARCHIVED";
  const icon = (kind: string) => (kind === "aeropuerto" ? <Plane size={15} /> : kind === "hotel" ? <Hotel size={15} /> : <MapPin size={15} />);
  const kinds = new Map(config.options.pickup_kinds.map((kind) => [kind.value, kind.label]));
  return (
    <BookingCard title="Recojo" hint={`${pickup.required ? "Obligatorio" : "Opcional"}${pickup.ask_flight ? " · pide número de vuelo" : ""}`} action={editable ? <PickupAction config={config} /> : undefined}>
      <RuleNotice config={config} section="recojo" />
      {pickup.points.length === 0 ? (
        <p className="rounded-[14px] border border-dashed border-line px-4 py-6 text-center text-[13px] text-fg-3">Sin puntos de partida.</p>
      ) : (
        <ol className="grid gap-2 md:grid-cols-2">
          {pickup.points.map((point) => (
            <li key={point.id} className="lift flex items-center gap-3 rounded-[14px] border border-line px-4 py-3">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-accent/10 text-accent">{icon(point.kind)}</span>
              <span className="text-[13px]">
                <b className="block font-semibold">{point.label}</b>
                <span className="text-[12px] text-fg-3">{kinds.get(point.kind) ?? point.kind}{point.requires_address ? " · pide dirección" : ""}</span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </BookingCard>
  );
}

export function RulesSection({ config }: { config: Config }) {
  const editable = config.can.update && config.product.status !== "ARCHIVED";
  const own = config.rules.filter((rule) => rule.product_override);
  const tenantOnly = config.rules.filter((rule) => !rule.product_override);
  const value = (rule: Config["rules"][number]) => rule.params.map((param) => `${param.label}: ${typeof param.value === "boolean" ? (param.value ? "sí" : "no") : param.value}${param.unit ? ` ${param.unit}` : ""}`).join(" · ");
  return (
    <BookingCard title="Reglas del producto" hint="Reglas del centro que este producto puede dejar de aplicar o ajustar. Un producto no enciende una regla apagada en la agencia (CAT-RL-02).">
      <SimpleTable
        testId="product-rules"
        columns={[{ header: "Regla" }, { header: "Agencia" }, { header: "Producto" }, { header: "Parámetros" }, ...(editable ? [{ header: "" }] : [])]}
        rows={own.map((rule) => ({
          key: rule.code,
          muted: !rule.tenant_enabled,
          cells: [
            <span key="name">
              <b className="block font-semibold">{rule.name}</b>
              <span className="font-mono text-[12px] text-fg-3">{rule.code} · {rule.group}</span>
            </span>,
            <Badge key="tenant" tone={rule.tenant_enabled ? "ok" : "mute"}>{rule.tenant_enabled ? "Activa" : "Apagada"}</Badge>,
            <Badge key="product" tone={!rule.tenant_enabled ? "mute" : rule.product_disabled ? "sun" : "ok"}>{!rule.tenant_enabled ? "No aplica" : rule.product_disabled ? "No se aplica" : Object.keys(rule.own_params).length ? "Ajustada" : "Se aplica"}</Badge>,
            <span key="params" className="whitespace-normal text-[12.5px] text-fg-2">{value(rule) || "—"}</span>,
            ...(editable
              ? [
                  <span key="actions" className="flex justify-end gap-1.5">
                    {rule.tenant_enabled && <RuleToggleAction config={config} rule={rule} />}
                    {rule.tenant_enabled && rule.params.length > 0 && <RuleParamsAction config={config} rule={rule} />}
                    {rule.has_override && <RuleResetAction config={config} rule={rule} />}
                  </span>,
                ]
              : []),
          ],
        }))}
        empty="No hay reglas ajustables por producto."
      />
      <p className="mt-4 flex flex-wrap items-center gap-2 text-[12.5px] text-fg-3">
        <CalendarCheck size={14} />
        {tenantOnly.length} reglas solo se configuran para toda la agencia: {tenantOnly.slice(0, 6).map((rule) => rule.name).join(", ")}
        {tenantOnly.length > 6 ? "…" : "."}
        {config.can.admin_rules ? <SmallLink href="/admin/reglas" label="Centro de reglas" /> : <span>Las administra el administrador de la agencia.</span>}
      </p>
    </BookingCard>
  );
}
