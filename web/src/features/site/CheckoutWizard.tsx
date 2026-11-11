"use client";

import { ArrowLeft, ArrowRight, Loader2, Lock } from "lucide-react";
import { useActionState, useCallback, useMemo, useState, useTransition } from "react";
import { placeOrder, validateCheckoutStep } from "@/app/(sitio)/sitio/[agencia]/actions";
import { Captcha } from "@/components/ui/Captcha";
import { ChoiceGroup } from "@/components/ui/ChoiceGroup";
import { SelectField } from "@/components/ui/SelectField";
import { StepIndicator } from "@/components/ui/StepIndicator";
import { TextArea } from "@/components/ui/TextArea";
import { TextField } from "@/components/ui/TextField";
import { cn } from "@/lib/cn";
import { capitalize, formatDate, formatMoney } from "@/lib/format";
import { IDLE, SITE_COUNTRIES, SITE_DOC_TYPES, type CheckoutTerms } from "@/lib/site";
import { CheckBox, FieldError, FormAlert } from "./FormBits";
import { PaymentFields, type PaymentValue } from "./PaymentFields";
import { useSite } from "./SiteContext";

const TYPE_LABEL: Record<string, string> = { adt: "Adulto", chd: "Niño", inf: "Infante" };

type Buyer = Record<"name" | "email" | "phone" | "country" | "doc_type" | "doc_number" | "birth_date" | "diet" | "billing_type" | "ruc" | "business_name" | "fiscal_address", string>;
type Traveler = Record<"first_name" | "last_name" | "birth_date" | "doc_type" | "doc_number" | "nationality" | "diet", string>;
type Line = Record<"pickup_point" | "pickup_address" | "pickup_flight" | "pickup_arrival" | "comments", string> & { line: number };

const emptyTraveler = (): Traveler => ({ first_name: "", last_name: "", birth_date: "", doc_type: "Pasaporte", doc_number: "", nationality: "Perú", diet: "" });

function Panel({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-card border border-line bg-surface p-5 shadow-card animate-[rise-in_320ms_cubic-bezier(0.22,1,0.36,1)_backwards]">
      <h2 className="text-[16px] font-semibold text-fg">{title}</h2>
      {hint && <p className="mt-0.5 text-[12.5px] text-fg-3">{hint}</p>}
      <div className="mt-4 grid gap-4">{children}</div>
    </section>
  );
}

export function CheckoutWizard({ terms, walletPhone }: { terms: CheckoutTerms; walletPhone: string | null }) {
  const { agencia, name: agencyName } = useSite();
  const travelersNeeded = terms.group.adt + terms.group.chd + terms.group.inf;
  const travelerTypes = useMemo(() => [...Array(terms.group.adt).fill("adt"), ...Array(terms.group.chd).fill("chd"), ...Array(terms.group.inf).fill("inf")] as string[], [terms.group]);
  const hasExtras = terms.items.some((item) => item.pickup !== null || item.comments !== null);
  const steps = ["Comprador", "Viajeros", ...(hasExtras ? ["Recojo y comentarios"] : []), "Revisión", "Pago"];
  const keys = ["comprador", "pasajeros", ...(hasExtras ? ["recojo"] : []), "revision", "pago"];
  const required = terms.companions.when === "al_reservar";

  const [step, setStep] = useState(0);
  const [reached, setReached] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | undefined>();
  const [checking, startCheck] = useTransition();
  const [buyer, setBuyer] = useState<Buyer>({ name: "", email: "", phone: "", country: "Perú", doc_type: "DNI", doc_number: "", birth_date: "", diet: "", billing_type: "Boleta", ruc: "", business_name: "", fiscal_address: "" });
  const [buyerTravels, setBuyerTravels] = useState(true);
  const [travelers, setTravelers] = useState<Traveler[]>(() => travelerTypes.map(() => emptyTraveler()));
  const [lines, setLines] = useState<Line[]>(() => terms.items.map((item) => ({ line: item.line, pickup_point: "", pickup_address: "", pickup_flight: "", pickup_arrival: "", comments: "" })));
  const [consents, setConsents] = useState({ terms: false, privacy: false, marketing: false });
  const [mode, setMode] = useState<string>(terms.modes[0]?.value ?? "total");
  const [payment, setPayment] = useState<PaymentValue>({ method: "tarjeta", ready: false });
  const [state, action, pending] = useActionState(placeOrder.bind(null, agencia), IDLE);
  const onPayment = useCallback((value: PaymentValue) => setPayment(value), []);

  const setBuyerField = (field: keyof Buyer) => (value: string) => setBuyer((current) => ({ ...current, [field]: value }));
  const setTraveler = (index: number, field: keyof Traveler, value: string) => setTravelers((current) => current.map((row, position) => (position === index ? { ...row, [field]: value } : row)));
  const setLine = (index: number, field: keyof Omit<Line, "line">, value: string) => setLines((current) => current.map((row, position) => (position === index ? { ...row, [field]: value } : row)));
  const allErrors = { ...errors, ...(state.errors ?? {}) };

  const travelerPayload = () => {
    const rows = travelers.map((row, index) => (index === 0 && buyerTravels ? { ...row, first_name: row.first_name || buyer.name.split(" ")[0] || "", last_name: row.last_name || buyer.name.split(" ").slice(1).join(" "), birth_date: row.birth_date || buyer.birth_date, doc_type: row.doc_number ? row.doc_type : buyer.doc_type, doc_number: row.doc_number || buyer.doc_number, nationality: row.nationality || buyer.country, diet: row.diet || buyer.diet } : row));
    const filled = rows.some((row) => row.first_name || row.last_name || row.birth_date);
    return required || filled ? rows : [];
  };

  const payload = (): Record<string, unknown> => ({
    ...buyer,
    passengers: travelerPayload(),
    lines,
    pay_mode: mode,
    method: payment.method,
    card_token: payment.card_token,
    card_holder: payment.card_holder,
    operation_ref: payment.operation_ref,
    ...consents,
  });

  const next = () => {
    const key = keys[step];
    if (key === "revision") {
      if (!consents.terms || !consents.privacy) {
        setErrors({ terms: consents.terms ? "" : "Debes aceptar los términos y las políticas de cancelación.", privacy: consents.privacy ? "" : "Debes autorizar el tratamiento de tus datos." });
        return;
      }
      setErrors({});
      setStep(step + 1);
      setReached(Math.max(reached, step + 1));
      return;
    }
    startCheck(async () => {
      const result = await validateCheckoutStep(agencia, key, payload());
      if (result.status === "error") {
        setErrors(result.errors ?? {});
        setMessage(result.message);
        return;
      }
      setErrors({});
      setMessage(undefined);
      setStep(step + 1);
      setReached(Math.max(reached, step + 1));
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  };

  const due = terms.modes.find((option) => option.value === mode)?.amount ?? terms.total;

  return (
    <div className="grid gap-5">
      <StepIndicator steps={steps} current={step} done={(index) => index < reached || index < step} reachable={(index) => index <= reached} onSelect={(index) => setStep(index)} />

      {keys[step] === "comprador" && (
        <>
          <Panel title="Datos del comprador" hint="Quien compra queda como titular. Enviaremos la confirmación a este correo.">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <TextField label="Nombres y apellidos" autoComplete="name" value={buyer.name} onChange={(event) => setBuyerField("name")(event.target.value)} />
                <FieldError message={allErrors.name} />
              </div>
              <div>
                <TextField label="Correo electrónico" type="email" autoComplete="email" value={buyer.email} onChange={(event) => setBuyerField("email")(event.target.value)} />
                <FieldError message={allErrors.email} />
              </div>
              <div>
                <TextField label="Celular" type="tel" autoComplete="tel" value={buyer.phone} onChange={(event) => setBuyerField("phone")(event.target.value)} />
                <FieldError message={allErrors.phone} />
              </div>
              <SelectField label="País de residencia" name="country" options={SITE_COUNTRIES} value={buyer.country} onChange={setBuyerField("country")} />
              <div className="grid grid-cols-[130px_1fr] gap-2">
                <SelectField label="Documento" name="doc_type" options={SITE_DOC_TYPES} value={buyer.doc_type} onChange={setBuyerField("doc_type")} />
                <div>
                  <TextField label="Número" inputMode={buyer.doc_type === "DNI" ? "numeric" : "text"} maxLength={15} value={buyer.doc_number} onChange={(event) => setBuyerField("doc_number")(event.target.value)} />
                  <FieldError message={allErrors.doc_number} />
                </div>
              </div>
              <TextField label="Fecha de nacimiento" type="date" value={buyer.birth_date} onChange={(event) => setBuyerField("birth_date")(event.target.value)} hint="Opcional" />
              <TextField label="Restricciones alimentarias" maxLength={120} value={buyer.diet} onChange={(event) => setBuyerField("diet")(event.target.value)} placeholder="Opcional" />
            </div>
          </Panel>
          <Panel title="Comprobante">
            <ChoiceGroup label="Tipo de comprobante" name="billing_type" options={[{ value: "Boleta", label: "Boleta" }, { value: "Factura", label: "Factura" }]} defaultValue={buyer.billing_type} onChange={setBuyerField("billing_type")} />
            {buyer.billing_type === "Factura" && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <TextField label="RUC" inputMode="numeric" maxLength={11} value={buyer.ruc} onChange={(event) => setBuyerField("ruc")(event.target.value)} />
                  <FieldError message={allErrors.ruc} />
                </div>
                <div>
                  <TextField label="Razón social" value={buyer.business_name} onChange={(event) => setBuyerField("business_name")(event.target.value)} />
                  <FieldError message={allErrors.business_name} />
                </div>
                <div className="sm:col-span-2">
                  <TextField label="Dirección fiscal" value={buyer.fiscal_address} onChange={(event) => setBuyerField("fiscal_address")(event.target.value)} />
                  <FieldError message={allErrors.fiscal_address} />
                </div>
              </div>
            )}
          </Panel>
        </>
      )}

      {keys[step] === "pasajeros" && (
        <Panel title={`Datos de los ${travelersNeeded} viajeros`} hint={required ? "Los necesitamos para emitir entradas y boletos a nombre de cada viajero. La edad se calcula a la fecha del viaje." : "Puedes completarlos ahora o después desde tu cuenta."}>
          <CheckBox name="buyer_travels" defaultChecked={buyerTravels} onChange={setBuyerTravels} label="El comprador también viaja (usamos sus datos para el primer viajero)." />
          <FieldError message={allErrors.passengers} />
          {travelers.map((traveler, index) => {
            const prefix = `passengers.${index}`;
            const auto = index === 0 && buyerTravels;
            return (
              <fieldset key={index} className="grid gap-3 rounded-2xl border border-line p-4 sm:grid-cols-2">
                <legend className="px-1 text-[13px] font-semibold text-fg">{TYPE_LABEL[travelerTypes[index]]} {travelerTypes.slice(0, index + 1).filter((type) => type === travelerTypes[index]).length}{auto ? " · comprador" : ""}</legend>
                <div>
                  <TextField label="Nombres" value={traveler.first_name} placeholder={auto ? buyer.name.split(" ")[0] : undefined} onChange={(event) => setTraveler(index, "first_name", event.target.value)} />
                  <FieldError message={allErrors[`${prefix}.first_name`]} />
                </div>
                <div>
                  <TextField label="Apellidos" value={traveler.last_name} placeholder={auto ? buyer.name.split(" ").slice(1).join(" ") : undefined} onChange={(event) => setTraveler(index, "last_name", event.target.value)} />
                  <FieldError message={allErrors[`${prefix}.last_name`]} />
                </div>
                <div>
                  <TextField label="Fecha de nacimiento" type="date" value={traveler.birth_date || (auto ? buyer.birth_date : "")} onChange={(event) => setTraveler(index, "birth_date", event.target.value)} />
                  <FieldError message={allErrors[`${prefix}.birth_date`]} />
                </div>
                <SelectField label="Nacionalidad" name={`${prefix}.nationality`} options={SITE_COUNTRIES} value={traveler.nationality} onChange={(value) => setTraveler(index, "nationality", value)} />
                <div className="grid grid-cols-[130px_1fr] gap-2 sm:col-span-2">
                  <SelectField label="Documento" name={`${prefix}.doc_type`} options={SITE_DOC_TYPES} value={traveler.doc_type} onChange={(value) => setTraveler(index, "doc_type", value)} />
                  <div>
                    <TextField label="Número" maxLength={15} value={traveler.doc_number} placeholder={auto ? buyer.doc_number : undefined} onChange={(event) => setTraveler(index, "doc_number", event.target.value)} />
                    <FieldError message={allErrors[`${prefix}.doc_number`]} />
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <TextField label="Restricciones alimentarias" maxLength={120} value={traveler.diet} placeholder="Opcional" onChange={(event) => setTraveler(index, "diet", event.target.value)} />
                </div>
              </fieldset>
            );
          })}
        </Panel>
      )}

      {keys[step] === "recojo" && (
        <Panel title="Recojo y comentarios" hint="Opcional. Ayuda a Operaciones a coordinar tu servicio.">
          {terms.items.map((item, index) => (
            <fieldset key={item.line} className="grid gap-3 rounded-2xl border border-line p-4">
              <legend className="px-1 text-[13px] font-semibold text-fg">{item.product.name} · {capitalize(formatDate(item.date, "long"))}</legend>
              {item.pickup && (
                <>
                  {item.pickup.points.length > 0 ? (
                    <SelectField label="Punto de recojo" name={`lines.${index}.pickup_point`} clearable placeholder="Elige una opción" options={item.pickup.points.map((point) => ({ value: point.label, label: point.label }))} value={lines[index].pickup_point} onChange={(value) => setLine(index, "pickup_point", value)} />
                  ) : (
                    item.pickup.text && <p className="rounded-xl bg-surface-2 px-3.5 py-2.5 text-[13px] text-fg-2">{item.pickup.text}</p>
                  )}
                  <div>
                    <TextField label="Hotel o dirección" maxLength={200} value={lines[index].pickup_address} onChange={(event) => setLine(index, "pickup_address", event.target.value)} placeholder="Nombre del hotel y distrito" />
                    <FieldError message={allErrors[`lines.${index}.pickup_address`] ?? allErrors[`lines.${index}.pickup_point`]} />
                  </div>
                  {item.pickup.ask_flight && item.pickup.points.find((point) => point.label === lines[index].pickup_point)?.kind === "aeropuerto" && (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <TextField label="Vuelo de llegada" maxLength={10} value={lines[index].pickup_flight} onChange={(event) => setLine(index, "pickup_flight", event.target.value.toUpperCase())} placeholder="LA2047 (opcional)" />
                        <FieldError message={allErrors[`lines.${index}.pickup_flight`]} />
                      </div>
                      <TextField label="Llegada" type="datetime-local" value={lines[index].pickup_arrival} onChange={(event) => setLine(index, "pickup_arrival", event.target.value)} />
                    </div>
                  )}
                </>
              )}
              {item.comments !== null && (
                <div>
                  <TextArea label="Comentarios para la agencia" rows={3} maxLength={item.comments} value={lines[index].comments} onChange={(event) => setLine(index, "comments", event.target.value)} placeholder="Celebraciones, movilidad reducida, alergias…" />
                  <FieldError message={allErrors[`lines.${index}.comments`]} />
                </div>
              )}
            </fieldset>
          ))}
        </Panel>
      )}

      {keys[step] === "revision" && (
        <>
          <Panel title="Revisa tu compra">
            <dl className="grid gap-2 text-[13.5px] sm:grid-cols-2">
              <div><dt className="text-fg-3">Comprador</dt><dd className="font-semibold text-fg">{buyer.name}</dd><dd className="text-fg-2">{buyer.email} · {buyer.phone}</dd></div>
              <div><dt className="text-fg-3">Comprobante</dt><dd className="font-semibold text-fg">{buyer.billing_type}{buyer.billing_type === "Factura" ? ` · RUC ${buyer.ruc}` : ` · ${buyer.doc_type} ${buyer.doc_number}`}</dd></div>
            </dl>
            {travelerPayload().length > 0 && (
              <ul className="grid gap-1 text-[13px] text-fg-2">
                {travelerPayload().map((row, index) => <li key={index}>{TYPE_LABEL[travelerTypes[index]]} · {row.first_name} {row.last_name}</li>)}
              </ul>
            )}
          </Panel>
          <Panel title="Condiciones de cada servicio">
            <ul className="grid gap-2">
              {terms.items.map((item) => (
                <li key={item.line} className="rounded-xl bg-surface-2 px-3.5 py-2.5 text-[12.5px] leading-relaxed text-fg-2">
                  <b className="block text-[13px] text-fg">{item.product.name}</b>
                  {item.cancellation ? <>{item.cancellation.tiers}<span className="block text-fg-3">{item.cancellation.text}</span></> : "Según las condiciones del proveedor."}
                </li>
              ))}
            </ul>
            <CheckBox name="terms" defaultChecked={consents.terms} onChange={(checked) => setConsents((current) => ({ ...current, terms: checked }))} error={allErrors.terms || undefined} label="Acepto los términos de la compra y las políticas de cancelación de cada servicio." />
            <CheckBox name="privacy" defaultChecked={consents.privacy} onChange={(checked) => setConsents((current) => ({ ...current, privacy: checked }))} error={allErrors.privacy || undefined} label={<>Autorizo a <b className="font-semibold text-fg">{agencyName}</b> a tratar mis datos para gestionar la reserva, incluida su transferencia a los proveedores del servicio (Ley 29733).</>} />
            <CheckBox name="marketing" defaultChecked={consents.marketing} onChange={(checked) => setConsents((current) => ({ ...current, marketing: checked }))} label="Quiero recibir novedades y ofertas por correo (opcional)." />
          </Panel>
        </>
      )}

      {keys[step] === "pago" && (
        <form action={action} className="grid gap-5">
          <Panel title="¿Cómo quieres pagar?">
            <div role="radiogroup" className="grid gap-2 sm:grid-cols-2">
              {terms.modes.map((option) => (
                <button key={option.value} type="button" role="radio" aria-checked={mode === option.value} onClick={() => setMode(option.value)} className={cn("lift rounded-2xl border p-4 text-left transition", mode === option.value ? "border-brand bg-[color-mix(in_srgb,var(--brand)_8%,var(--surface))]" : "border-line bg-surface hover:border-[color-mix(in_srgb,var(--brand)_40%,transparent)]")}>
                  <span className="block text-[14px] font-semibold text-fg">{option.value === "adelanto" ? `Adelanto ${option.pct} %` : option.label}</span>
                  <span className="block text-[20px] font-bold tabular-nums text-fg">{formatMoney(option.amount, terms.currency)}</span>
                  {option.value === "adelanto" && option.balance && option.balance_due && <span className="block text-[12.5px] text-fg-2">Saldo de {formatMoney(option.balance, terms.currency)} hasta el {formatDate(option.balance_due)}</span>}
                </button>
              ))}
            </div>
            {terms.adelanto_unavailable && <p className="text-[12.5px] text-fg-3">{terms.adelanto_unavailable}</p>}
          </Panel>
          <Panel title="Medio de pago">
            <PaymentFields methods={terms.methods} accounts={terms.bank_accounts} walletPhone={walletPhone} onChange={onPayment} errors={allErrors} />
          </Panel>
          <input type="hidden" name="payload" value={JSON.stringify(payload())} />
          {state.status === "error" && <FormAlert message={state.message} />}
          <Captcha />
          <button type="submit" disabled={pending || !payment.ready} className="inline-flex h-12 items-center justify-center gap-2 rounded-control bg-brand text-[15px] font-semibold text-brand-fg shadow-[0_10px_24px_-12px_var(--brand)] transition hover:-translate-y-0.5 hover:brightness-110 disabled:opacity-60">
            {pending ? <Loader2 size={17} className="animate-spin" /> : <Lock size={17} />}
            {payment.method === "tarjeta" ? `Pagar ${formatMoney(due, terms.currency)}` : `Registrar pago de ${formatMoney(due, terms.currency)}`}
          </button>
        </form>
      )}

      {keys[step] !== "pago" && (
        <>
          {message && <FormAlert message={message} />}
          <div className="flex flex-wrap items-center justify-between gap-3">
            {step > 0 ? (
              <button type="button" onClick={() => setStep(step - 1)} className="inline-flex h-11 items-center gap-1.5 rounded-control px-4 text-[14px] font-semibold text-fg-2 transition hover:bg-surface-2 hover:text-fg">
                <ArrowLeft size={16} /> Anterior
              </button>
            ) : (
              <span />
            )}
            <button type="button" onClick={next} disabled={checking} className="inline-flex h-11 items-center gap-1.5 rounded-control bg-brand px-5 text-[14px] font-semibold text-brand-fg transition hover:brightness-110 disabled:opacity-60">
              {checking ? <Loader2 size={16} className="animate-spin" /> : null}
              Continuar <ArrowRight size={16} />
            </button>
          </div>
        </>
      )}
    </div>
  );
}
