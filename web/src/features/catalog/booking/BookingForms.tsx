"use client";

import { ArrowDown, ArrowUp, BedDouble, CalendarCog, Hotel, MapPinned, Plus, RotateCcw, SlidersHorizontal, Wallet } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import { deleteAddon, deleteHotel, deleteLeg, reorderLegs, resetPaxRules, resetPayment, resetRuleOverride, saveAccommodation, saveAddon, saveHotel, saveLeg, saveOperation, savePaxRules, savePayment, savePickup, saveRuleOverride } from "@/app/(backoffice)/catalogo/productos/booking-actions";
import { RowIcon } from "@/components/table/RowActions";
import { ChipToggleGroup } from "@/components/ui/ChipToggleGroup";
import { PanelAction } from "@/components/ui/PanelAction";
import { RepeatableFields } from "@/components/ui/RepeatableFields";
import { SelectField } from "@/components/ui/SelectField";
import { SwitchField } from "@/components/ui/SwitchField";
import { TextArea } from "@/components/ui/TextArea";
import { TextField } from "@/components/ui/TextField";
import { ConfirmAction, HiddenFields, PanelSection, STEP_INITIAL } from "@/features/catalog-shared/CatalogPanels";
import { WEEKDAYS, type AccommodationHotel, type AccommodationLeg, type BookingAddon, type ProductBookingConfig, type ProductRuleState } from "@/lib/catalog-booking";
import type { StepResult } from "@/lib/server/resource";

type Config = ProductBookingConfig;

const stamp = (config: Config) => ({ product: config.product.code, lock_version: config.product.lock_version });

function Toggle({ name, label, hint, defaultChecked, onChange }: { name: string; label: string; hint?: string; defaultChecked: boolean; onChange?: (checked: boolean) => void }) {
  const [checked, setChecked] = useState(defaultChecked);
  return (
    <SwitchField
      name={name}
      label={label}
      hint={hint}
      checked={checked}
      onCheckedChange={(value) => {
        setChecked(value);
        onChange?.(value);
      }}
    />
  );
}

function BookingPanel({ id, label, title, description, submitLabel, action, icon, trigger, variant = "secondary", children }: { id: string; label: string; title: string; description?: ReactNode; submitLabel: string; action: (state: StepResult, form: FormData) => Promise<StepResult>; icon?: ReactNode; trigger?: (open: () => void) => ReactNode; variant?: "primary" | "secondary" | "ghost"; children: ReactNode }) {
  const router = useRouter();
  return (
    <PanelAction<StepResult> label={label} icon={icon} variant={variant} size="sm" formId={`booking-${id}`} title={title} description={description} submitLabel={submitLabel} action={action} initial={STEP_INITIAL} trigger={trigger} onDone={() => router.refresh()}>
      {() => children}
    </PanelAction>
  );
}

export function OperationAction({ config }: { config: Config }) {
  return (
    <BookingPanel id="operation" label="Editar operación" icon={<CalendarCog size={15} />} title="Días de operación y anticipación" description="El motor de reservas no vende los días que no opera ni las fechas dentro del plazo de anticipación." submitLabel="Guardar operación" action={saveOperation}>
      <HiddenFields values={stamp(config)} />
      <ChipToggleGroup label="Días que opera" name="operating_weekdays" options={WEEKDAYS} defaultValue={config.operation.operating_weekdays.map(String)} hint="Al menos un día (CAT-AV-06)." />
      <TextField label="Anticipación mínima (horas)" name="cutoff_hours" type="number" min={0} max={8760} defaultValue={config.operation.cutoff_hours ?? ""} hint={`Vacío: usa la anticipación de la ficha (${config.operation.advance_min_days} días) o la de la agencia.`} />
    </BookingPanel>
  );
}

export function PaxRulesAction({ config }: { config: Config }) {
  const current = config.pax_rules.values ?? config.pax_rules.effective;
  const [childPays, setChildPays] = useState(current.child_pays);
  const [infantAllowed, setInfantAllowed] = useState(current.infant_allowed);
  return (
    <BookingPanel id="pax" label={config.pax_rules.inherited ? "Personalizar" : "Editar"} icon={<SlidersHorizontal size={15} />} title="Reglas de pasajeros" description="Bandas de edad, cuánto paga el niño y cuántos niños e infantes caben por adulto." submitLabel="Guardar reglas" action={savePaxRules}>
      <HiddenFields values={stamp(config)} />
      <PanelSection title="Bandas de edad">
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Infante hasta (años)" name="infant_max_age" type="number" min={0} max={5} required defaultValue={current.infant_max_age} />
          <TextField label="Niño desde (años)" name="child_min_age" type="number" min={0} max={17} required defaultValue={current.child_min_age} />
          <TextField label="Niño hasta (años)" name="child_max_age" type="number" min={0} max={17} required defaultValue={current.child_max_age} />
          <TextField label="Adulto desde (años)" name="adult_min_age" type="number" min={1} max={21} required defaultValue={current.adult_min_age} />
        </div>
        <p className="text-[12.5px] text-fg-3">Deben ir en orden: infante &lt; niño ≤ niño hasta &lt; adulto (CAT-PX-01).</p>
      </PanelSection>
      <PanelSection title="Precio">
        <Toggle name="child_pays" label="El niño paga" defaultChecked={current.child_pays} onChange={setChildPays} />
        {childPays && <TextField label="Precio del niño (% del adulto)" name="child_price_pct" type="number" min={0} max={100} step="0.01" required defaultValue={current.child_price_pct} hint="Respaldo: si hay una tarifa Niño vigente, el motor usa esa tarifa (CAT-PX-03)." />}
        <Toggle name="infant_allowed" label="Admite infantes" defaultChecked={current.infant_allowed} onChange={setInfantAllowed} />
        {infantAllowed && <Toggle name="infant_pays" label="El infante paga (lo mismo que el niño)" defaultChecked={current.infant_pays} />}
      </PanelSection>
      <PanelSection title="Límites">
        <div className="grid grid-cols-3 gap-3">
          <TextField label="Niños por adulto" name="max_children_per_adult" type="number" min={0} max={10} required defaultValue={current.max_children_per_adult} />
          <TextField label="Infantes por adulto" name="max_infants_per_adult" type="number" min={0} max={5} required defaultValue={current.max_infants_per_adult} />
          <TextField label="Adultos mínimos" name="min_adults" type="number" min={0} max={10} required defaultValue={current.min_adults} />
        </div>
      </PanelSection>
      <TextArea label="Nota al cliente" name="note" rows={2} maxLength={500} defaultValue={config.pax_rules.values?.note ?? undefined} placeholder="Por ejemplo: los infantes comparten cama con un adulto." />
    </BookingPanel>
  );
}

export function PaxRulesResetAction({ config }: { config: Config }) {
  return <ConfirmAction id="pax-reset" label="Usar las de la agencia" tone="neutral" icon={<RotateCcw size={15} />} title="Volver a las reglas de la agencia" description="El producto deja de tener reglas propias de pasajeros y usa las de la agencia. Queda en el historial." submitLabel="Restablecer" action={resetPaxRules} hidden={stamp(config)} />;
}

export function AddonAction({ config, addon }: { config: Config; addon?: BookingAddon }) {
  const services = config.options.services.map((service) => ({ value: service.id, label: service.name, hint: service.ref }));
  return (
    <BookingPanel
      id={addon ? `addon-${addon.code}` : "addon-new"}
      label={addon ? "Editar" : "Nuevo adicional"}
      icon={addon ? undefined : <Plus size={15} />}
      variant={addon ? "secondary" : "primary"}
      trigger={addon ? (open) => <RowIcon tone="edit" label="Editar" onClick={open} /> : undefined}
      title={addon ? `Editar ${addon.name}` : "Nuevo adicional"}
      description="Museos, entradas, comidas o extensiones que el cliente suma a su reserva."
      submitLabel={addon ? "Guardar cambios" : "Crear adicional"}
      action={saveAddon}
    >
      <HiddenFields values={{ ...stamp(config), addon: addon?.code }} />
      <TextField label="Nombre" name="name" required minLength={3} maxLength={150} defaultValue={addon?.name} placeholder="Museo Larco (Lima)" />
      <div className="grid grid-cols-2 gap-3">
        <SelectField label="Categoría" name="category" defaultValue={addon?.category ?? config.options.addon_categories[0]} options={config.options.addon_categories.map((value) => ({ value, label: value }))} />
        <SelectField label="Se cobra" name="charge_per" defaultValue={addon?.charge_per ?? "pax"} options={[{ value: "pax", label: "Por pasajero" }, { value: "reserva", label: "Por reserva" }]} />
        <SelectField label="Moneda" name="currency" defaultValue={addon?.currency ?? config.options.currencies[0]} options={config.options.currencies.map((value) => ({ value, label: value }))} />
        <TextField label="Precio de venta" name="price" type="number" min={0} step="0.01" required defaultValue={addon?.price} />
      </div>
      <ChipToggleGroup label="Aplica a" name="applies_to" options={config.options.pax_types} defaultValue={addon?.applies_to ?? ["ADT", "CHD"]} hint="Al menos un tipo de pasajero (CAT-AD-01)." />
      <SelectField label="Servicio del catálogo" name="service_id" clearable searchable placeholder="Sin servicio vinculado" defaultValue={addon?.service?.id ?? ""} options={services} hint="Si eliges un servicio, el proveedor se toma de él (CAT-AD-02)." />
      <SelectField label="Proveedor" name="provider_id" clearable searchable placeholder="Sin proveedor" defaultValue={addon?.provider?.id ?? ""} options={config.options.providers.map((provider) => ({ value: provider.id, label: provider.name, hint: provider.type }))} />
      <TextField label="Stock o nota" name="stock_note" maxLength={200} defaultValue={addon?.stock_note ?? undefined} placeholder="Cupos limitados por día" />
      <Toggle name="is_optional" label="Opcional para el cliente" defaultChecked={addon?.is_optional ?? true} />
    </BookingPanel>
  );
}

export function AddonDeleteAction({ config, addon }: { config: Config; addon: BookingAddon }) {
  return <ConfirmAction id={`addon-del-${addon.code}`} label="Eliminar" title="Eliminar adicional" description={`${addon.name} deja de ofrecerse. Las reservas que ya lo incluyen no cambian (CAT-AD-03).`} submitLabel="Eliminar adicional" action={deleteAddon} hidden={{ ...stamp(config), addon: addon.code }} />;
}

export function AccommodationAction({ config }: { config: Config }) {
  const lodging = config.accommodation;
  const [enabled, setEnabled] = useState(lodging.enabled);
  return (
    <BookingPanel id="lodging" label={lodging.enabled ? "Configurar" : "Ofrecer alojamiento"} icon={<BedDouble size={15} />} variant={lodging.enabled ? "secondary" : "primary"} title="Alojamiento" description="Hoteles por ciudad que el cliente elige al reservar. Al retirarlo, los tramos y hoteles se conservan." submitLabel="Guardar" action={saveAccommodation}>
      <HiddenFields values={stamp(config)} />
      <Toggle name="enabled" label="El producto ofrece alojamiento" defaultChecked={lodging.enabled} onChange={setEnabled} />
      {enabled && (
        <>
          <Toggle name="optional" label="Es opcional" hint="Si lo apagas, el alojamiento va incluido y el cliente no puede quitarlo." defaultChecked={lodging.optional} />
          <SelectField label="Moneda de las habitaciones" name="currency" defaultValue={lodging.currency ?? "USD"} options={config.options.currencies.map((value) => ({ value, label: value }))} />
          <TextArea label="Nota" name="note" rows={2} maxLength={500} defaultValue={lodging.note ?? undefined} placeholder="Precio por habitación y noche, desayuno incluido." />
        </>
      )}
    </BookingPanel>
  );
}

export function LegAction({ config, leg }: { config: Config; leg?: AccommodationLeg }) {
  return (
    <BookingPanel
      id={leg ? `leg-${leg.code}` : "leg-new"}
      label={leg ? "Editar" : "Nuevo tramo"}
      icon={leg ? undefined : <MapPinned size={15} />}
      trigger={leg ? (open) => <RowIcon tone="edit" label="Editar tramo" onClick={open} /> : undefined}
      title={leg ? `Editar tramo ${leg.city}` : "Nuevo tramo"}
      description="Cada tramo es una ciudad del itinerario con sus noches de hotel."
      submitLabel={leg ? "Guardar tramo" : "Crear tramo"}
      action={saveLeg}
    >
      <HiddenFields values={{ ...stamp(config), leg: leg?.id }} />
      <TextField label="Ciudad" name="city" required minLength={2} maxLength={80} defaultValue={leg?.city} placeholder="Arequipa" />
      <div className="grid grid-cols-2 gap-3">
        <TextField label="Noches" name="nights" type="number" min={1} max={30} required defaultValue={leg?.nights ?? 1} hint="De 1 a 30 (CAT-LG-01)." />
        <TextField label="Orden" name="sequence" type="number" min={1} max={60} defaultValue={leg?.sequence ?? config.accommodation.legs.length + 1} />
      </div>
      <SelectField label="Destino del catálogo" name="destination_id" clearable searchable placeholder="Sin destino" defaultValue={leg?.destination?.id ?? ""} options={config.options.destinations.map((destination) => ({ value: destination.id, label: destination.name }))} />
    </BookingPanel>
  );
}

export function LegDeleteAction({ config, leg }: { config: Config; leg: AccommodationLeg }) {
  return <ConfirmAction id={`leg-del-${leg.code}`} label="Eliminar tramo" title="Eliminar tramo" description={`${leg.city} y sus ${leg.hotels.length} hotel(es) dejan de ofrecerse.`} submitLabel="Eliminar tramo" action={deleteLeg} hidden={{ ...stamp(config), leg: leg.id }} />;
}

export function LegMoveButtons({ config, index }: { config: Config; index: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const legs = config.accommodation.legs;
  const move = (delta: number) => {
    const ids = legs.map((leg) => leg.id);
    const [moved] = ids.splice(index, 1);
    ids.splice(index + delta, 0, moved);
    const form = new FormData();
    form.set("product", config.product.code);
    form.set("lock_version", String(config.product.lock_version));
    form.set("ids", JSON.stringify(ids));
    start(async () => {
      const result = await reorderLegs(STEP_INITIAL, form);
      if (result.done) router.refresh();
    });
  };
  return (
    <>
      <RowIcon tone="neutral" label="Subir" icon={<ArrowUp size={15} />} onClick={() => move(-1)} disabledHint={index === 0 || pending ? "Ya es el primero" : undefined} />
      <RowIcon tone="neutral" label="Bajar" icon={<ArrowDown size={15} />} onClick={() => move(1)} disabledHint={index === legs.length - 1 || pending ? "Ya es el último" : undefined} />
    </>
  );
}

function RoomMatrix({ config, hotel }: { config: Config; hotel?: AccommodationHotel }) {
  const capacity: Record<string, number> = { Simple: 1, Doble: 2, Matrimonial: 2, Triple: 3, Familiar: 4, Suite: 2 };
  return (
    <fieldset>
      <legend className="mb-1.5 text-[13px] font-semibold text-fg">Tipos de habitación</legend>
      <p className="-mt-1 mb-2 text-[12.5px] text-fg-3">Deja el precio vacío en los tipos que el hotel no ofrece. Al menos uno (CAT-LG-01).</p>
      <div className="grid gap-2">
        {config.options.room_types.map((type) => {
          const room = hotel?.room_types.find((item) => item.room_type === type);
          return (
            <div key={type} className="grid grid-cols-[96px_minmax(0,1fr)_minmax(0,1fr)] items-end gap-2 rounded-xl border border-line px-3 py-2">
              <input type="hidden" name="room_types" value={type} />
              <span className="pb-2.5 text-[13px] font-semibold">{type}</span>
              <TextField label="Capacidad" name={`capacity_${type}`} type="number" min={1} max={8} defaultValue={room?.capacity ?? capacity[type] ?? 2} />
              <TextField label={`Precio por noche (${config.accommodation.currency ?? "USD"})`} name={`price_${type}`} type="number" min={0.01} step="0.01" defaultValue={room?.price_per_night ?? ""} />
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}

export function HotelAction({ config, leg, hotel }: { config: Config; leg: AccommodationLeg; hotel?: AccommodationHotel }) {
  return (
    <BookingPanel
      id={hotel ? `hotel-${hotel.id}` : `hotel-new-${leg.code}`}
      label={hotel ? "Editar" : "Agregar hotel"}
      icon={hotel ? undefined : <Hotel size={15} />}
      variant="ghost"
      trigger={hotel ? (open) => <RowIcon tone="edit" label="Editar hotel" onClick={open} /> : undefined}
      title={hotel ? `Editar ${hotel.name}` : `Nuevo hotel en ${leg.city}`}
      description="El precio es por habitación y noche, en la moneda del alojamiento."
      submitLabel={hotel ? "Guardar hotel" : "Agregar hotel"}
      action={saveHotel}
    >
      <HiddenFields values={{ ...stamp(config), leg: leg.id, hotel: hotel?.id }} />
      <TextField label="Hotel" name="name" required minLength={3} maxLength={150} defaultValue={hotel?.name} placeholder="Casona del Sillar (3*)" />
      <div className="grid grid-cols-2 gap-3">
        <SelectField label="Categoría" name="category" defaultValue={hotel?.category ?? config.options.hotel_categories[0]} options={config.options.hotel_categories.map((value) => ({ value, label: value }))} />
        <SelectField label="Proveedor" name="provider_id" clearable searchable placeholder="Sin contrato" defaultValue={hotel?.provider?.id ?? ""} options={config.options.providers.filter((provider) => provider.type === "Hotel").map((provider) => ({ value: provider.id, label: provider.name }))} />
      </div>
      <RoomMatrix config={config} hotel={hotel} />
    </BookingPanel>
  );
}

export function HotelDeleteAction({ config, leg, hotel }: { config: Config; leg: AccommodationLeg; hotel: AccommodationHotel }) {
  return <ConfirmAction id={`hotel-del-${hotel.id}`} label="Eliminar hotel" title="Eliminar hotel" description={`${hotel.name} deja de ofrecerse en ${leg.city}.`} submitLabel="Eliminar hotel" action={deleteHotel} hidden={{ ...stamp(config), leg: leg.id, hotel: hotel.id }} />;
}

export function PaymentAction({ config }: { config: Config }) {
  const payment = config.payment;
  const values = payment.values;
  const modes = values?.modes ?? ["total", "adelanto"];
  return (
    <BookingPanel id="payment" label={payment.inherited ? "Personalizar" : "Editar"} icon={<Wallet size={15} />} title="Modalidades de pago" description="Cómo puede pagar el cliente al reservar este producto." submitLabel="Guardar política" action={savePayment}>
      <HiddenFields values={stamp(config)} />
      <ChipToggleGroup label="Modalidades con cobro" name="modes" options={[{ value: "total", label: "Pago total" }, { value: "adelanto", label: "Adelanto" }]} defaultValue={modes} hint="Al menos una (CAT-PY-01)." />
      <div className="grid grid-cols-2 gap-3">
        <TextField label="Adelanto (%)" name="deposit_pct" type="number" min={1} max={99} defaultValue={values?.deposit_pct ?? ""} hint={`Vacío: ${payment.tenant.deposit_pct} % de la agencia.`} />
        <TextField label="Saldo (días antes)" name="balance_due_days" type="number" min={0} max={180} defaultValue={values?.balance_due_days ?? ""} hint={`Vacío: ${payment.tenant.balance_due_days} días de la agencia.`} />
      </div>
      {payment.pay_later.tenant_enabled ? (
        <>
          <input type="hidden" name="pay_later_shown" value="1" />
          <Toggle name="pay_later_enabled" label="Ofrecer pagar después" hint={`Bloquea los cupos ${payment.tenant.hold_hours} h sin cobro (R-PAY-LATER).`} defaultChecked={payment.pay_later.enabled} />
        </>
      ) : (
        <p className="rounded-xl bg-surface-2 px-3.5 py-2.5 text-[12.5px] text-fg-3">Pagar después está apagado para la agencia. Se activa en el centro de reglas.</p>
      )}
      <TextArea label="Nota al cliente" name="note" rows={2} maxLength={500} defaultValue={values?.note ?? undefined} placeholder="El saldo se cobra 30 días antes de la salida." />
    </BookingPanel>
  );
}

export function PaymentResetAction({ config }: { config: Config }) {
  return <ConfirmAction id="payment-reset" label="Usar la de la agencia" tone="neutral" icon={<RotateCcw size={15} />} title="Volver a la política de la agencia" description="El producto deja de tener modalidades propias y usa las de la agencia." submitLabel="Restablecer" action={resetPayment} hidden={stamp(config)} />;
}

export function PickupAction({ config }: { config: Config }) {
  const pickup = config.pickup;
  return (
    <BookingPanel id="pickup" label="Editar recojo" icon={<MapPinned size={15} />} title="Puntos de partida y recojo" description="Lo que el cliente elige en el checkout para que Operaciones lo recoja." submitLabel="Guardar recojo" action={savePickup}>
      <HiddenFields values={stamp(config)} />
      <Toggle name="required" label="El recojo es obligatorio" hint="Si lo es, debe haber al menos un punto (CAT-PK-01)." defaultChecked={pickup.required} />
      <Toggle name="ask_flight" label="Pedir número de vuelo" defaultChecked={pickup.ask_flight} />
      <RepeatableFields label="Puntos" name="points" itemLabel="Punto" addLabel="Agregar punto" max={30} fields={[{ key: "label", label: "Punto", maxLength: 150, placeholder: "Hotel en Miraflores o Barranco" }]} defaultValue={pickup.points.map((point) => ({ label: point.label }))} hint="El tipo (aeropuerto, hotel, terminal) se deduce del texto." />
    </BookingPanel>
  );
}

export function RuleToggleAction({ config, rule }: { config: Config; rule: ProductRuleState }) {
  const turnOn = rule.product_disabled;
  return (
    <ConfirmAction
      id={`rule-${rule.code}`}
      label={turnOn ? "Aplicar" : "No aplicar"}
      tone="neutral"
      icon={<SlidersHorizontal size={15} />}
      title={turnOn ? `Aplicar ${rule.name}` : `No aplicar ${rule.name}`}
      description={turnOn ? "El producto vuelve a usar esta regla de la agencia." : "Solo este producto deja de usar la regla. La agencia la sigue aplicando en el resto."}
      submitLabel={turnOn ? "Aplicar" : "No aplicar"}
      action={saveRuleOverride}
      hidden={{ ...stamp(config), rule: rule.code, enabled: turnOn ? "on" : "" }}
    />
  );
}

export function RuleParamsAction({ config, rule }: { config: Config; rule: ProductRuleState }) {
  return (
    <BookingPanel id={`rule-params-${rule.code}`} label="Parámetros" trigger={(open) => <RowIcon tone="edit" label="Parámetros propios" onClick={open} />} title={rule.name} description="Los valores iguales a los de la agencia no se guardan como propios (CAT-RL-03)." submitLabel="Guardar parámetros" action={saveRuleOverride}>
      <HiddenFields values={{ ...stamp(config), rule: rule.code, enabled: rule.product_disabled ? "" : "on" }} />
      {rule.params.map((param) => (
        <div key={param.key}>
          <input type="hidden" name="param_keys" value={param.key} />
          {param.type === "bool" ? (
            <>
              <input type="hidden" name={`bool_${param.key}`} value="1" />
              <Toggle name={`param_${param.key}`} label={param.label} defaultChecked={Boolean(param.value)} />
            </>
          ) : param.type === "choice" ? (
            <SelectField label={param.label} name={`param_${param.key}`} defaultValue={String(param.value)} options={param.options ?? []} />
          ) : (
            <TextField label={`${param.label}${param.unit ? ` (${param.unit})` : ""}`} name={`param_${param.key}`} type="number" min={param.min ?? undefined} max={param.max ?? undefined} step="any" defaultValue={String(param.value)} hint={`Agencia: ${String(rule.tenant_params[param.key] ?? "—")}`} />
          )}
        </div>
      ))}
    </BookingPanel>
  );
}

export function RuleResetAction({ config, rule }: { config: Config; rule: ProductRuleState }) {
  return <ConfirmAction id={`rule-reset-${rule.code}`} label="Restablecer" tone="neutral" icon={<RotateCcw size={15} />} title={`Restablecer ${rule.name}`} description="Se borran el ajuste y los parámetros propios del producto; vuelve a regir lo de la agencia." submitLabel="Restablecer" action={resetRuleOverride} hidden={{ ...stamp(config), rule: rule.code }} />;
}
