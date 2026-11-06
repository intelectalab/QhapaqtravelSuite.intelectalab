"use client";

import { CreditCard, Loader2, ShieldAlert } from "lucide-react";
import { useActionState, useState } from "react";
import { placeOrder } from "@/app/(sitio)/sitio/[agencia]/actions";
import { ChoiceGroup } from "@/components/ui/ChoiceGroup";
import { SelectField } from "@/components/ui/SelectField";
import { TextField } from "@/components/ui/TextField";
import { IDLE } from "@/lib/site";
import { CheckBox, FieldError, FormAlert } from "./FormBits";
import { useSite } from "./SiteContext";

const COUNTRIES = ["Perú", "Argentina", "Bolivia", "Brasil", "Chile", "Colombia", "Ecuador", "México", "Estados Unidos", "Canadá", "España", "Francia", "Alemania", "Reino Unido", "Italia", "Otro"].map((value) => ({ value, label: value }));

export function CheckoutForm({ policies }: { policies: { product: string; text: string }[] }) {
  const { agencia, name } = useSite();
  const [state, action, pending] = useActionState(placeOrder.bind(null, agencia), IDLE);
  const [billing, setBilling] = useState("Boleta");
  const [docType, setDocType] = useState("DNI");
  const errors = state.errors ?? {};

  return (
    <form action={action} className="grid gap-6">
      <div className="flex items-start gap-3 rounded-card border border-[color-mix(in_srgb,var(--warn)_35%,transparent)] bg-[color-mix(in_srgb,var(--warn)_9%,var(--surface))] p-4 text-[13.5px] leading-relaxed text-fg-2">
        <ShieldAlert size={20} className="mt-0.5 flex-none text-warn" />
        <p>
          <b className="text-fg">Pago simulado.</b> Este sitio está en modo demostración: no te pediremos datos de tarjeta ni se realizará ningún cargo. Al confirmar se crean tu pedido y tu reserva, y luego podrás simular el pago.
        </p>
      </div>

      <section className="rounded-card border border-line bg-surface p-5 shadow-card">
        <h2 className="text-[16px] font-semibold text-fg">1. Datos del comprador</h2>
        <p className="mt-0.5 text-[12.5px] text-fg-3">El comprador queda como titular de la reserva. Los datos de los acompañantes se completan después.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <TextField label="Nombres y apellidos" name="name" autoComplete="name" required />
            <FieldError message={errors.name} />
          </div>
          <div>
            <TextField label="Correo electrónico" name="email" type="email" autoComplete="email" required />
            <FieldError message={errors.email} />
          </div>
          <div>
            <TextField label="Celular" name="phone" type="tel" autoComplete="tel" required />
            <FieldError message={errors.phone} />
          </div>
          <SelectField label="País de residencia" name="country" options={COUNTRIES} defaultValue="Perú" />
          <div className="grid grid-cols-[130px_1fr] gap-2">
            <SelectField label="Documento" name="doc_type" options={[{ value: "DNI", label: "DNI" }, { value: "CE", label: "Carné ext." }, { value: "Pasaporte", label: "Pasaporte" }]} defaultValue="DNI" onChange={setDocType} />
            <div>
              <TextField label="Número" name="doc_number" inputMode={docType === "DNI" ? "numeric" : "text"} maxLength={15} required />
              <FieldError message={errors.doc_number} />
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-card border border-line bg-surface p-5 shadow-card">
        <h2 className="text-[16px] font-semibold text-fg">2. Comprobante</h2>
        <div className="mt-4">
          <ChoiceGroup label="Tipo de comprobante" name="billing_type" options={[{ value: "Boleta", label: "Boleta" }, { value: "Factura", label: "Factura" }]} defaultValue="Boleta" onChange={setBilling} />
        </div>
        {billing === "Factura" && (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 animate-[rise-in_320ms_cubic-bezier(0.22,1,0.36,1)_backwards]">
            <div>
              <TextField label="RUC" name="ruc" inputMode="numeric" maxLength={11} />
              <FieldError message={errors.ruc} />
            </div>
            <div>
              <TextField label="Razón social" name="business_name" />
              <FieldError message={errors.business_name} />
            </div>
            <div className="sm:col-span-2">
              <TextField label="Dirección fiscal" name="fiscal_address" />
              <FieldError message={errors.fiscal_address} />
            </div>
          </div>
        )}
      </section>

      <section className="rounded-card border border-line bg-surface p-5 shadow-card">
        <h2 className="text-[16px] font-semibold text-fg">3. Condiciones</h2>
        {policies.length > 0 && (
          <ul className="mt-3 grid gap-2">
            {policies.map((policy) => (
              <li key={policy.product} className="rounded-xl bg-surface-2 px-3.5 py-2.5 text-[12.5px] leading-relaxed text-fg-2">
                <b className="block text-fg">Cancelación · {policy.product}</b>
                {policy.text}
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4 grid gap-3">
          <CheckBox name="terms" error={errors.terms} label={<>Acepto los términos de la compra y las políticas de cancelación de cada servicio.</>} />
          <CheckBox
            name="privacy"
            error={errors.privacy}
            label={
              <>
                Autorizo a <b className="font-semibold text-fg">{name}</b> a tratar mis datos para gestionar la reserva, incluida su transferencia a los proveedores del servicio (Ley 29733).
              </>
            }
          />
          <CheckBox name="marketing" label="Quiero recibir novedades y ofertas por correo (opcional)." />
        </div>
      </section>

      {state.status === "error" && <FormAlert message={state.message} />}

      <button type="submit" disabled={pending} className="inline-flex h-12 items-center justify-center gap-2 rounded-control bg-brand text-[15px] font-semibold text-brand-fg shadow-[0_10px_24px_-12px_var(--brand)] transition hover:-translate-y-0.5 hover:brightness-110 disabled:opacity-60">
        {pending ? <Loader2 size={17} className="animate-spin" /> : <CreditCard size={17} />}
        Confirmar pedido
      </button>
    </form>
  );
}
