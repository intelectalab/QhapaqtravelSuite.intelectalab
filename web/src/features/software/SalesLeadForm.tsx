"use client";

import { ArrowRight, Building2, Check, LoaderCircle, Mail, Phone, User } from "lucide-react";
import { useActionState, useState } from "react";
import { sendSalesLead } from "@/app/(software)/software/suscribirse/actions";
import { Button } from "@/components/ui/Button";
import { ChoiceGroup } from "@/components/ui/ChoiceGroup";
import { SelectField } from "@/components/ui/SelectField";
import { SwitchField } from "@/components/ui/SwitchField";
import { TextArea } from "@/components/ui/TextArea";
import { TextField } from "@/components/ui/TextField";
import { DEMO_INITIAL, type DemoOptions } from "@/lib/software";

export function SalesLeadForm({ options, plan }: { options: DemoOptions; plan?: string }) {
  const [state, submit, pending] = useActionState(sendSalesLead, DEMO_INITIAL);
  const [consent, setConsent] = useState(false);
  const errors = state.errors;
  const values = state.values;

  if (state.done) {
    return (
      <div className="flex flex-col items-center py-8 text-center">
        <span className="grid h-14 w-14 place-items-center rounded-full bg-ok text-white animate-[pop-in_520ms_cubic-bezier(0.34,1.56,0.64,1)_backwards]">
          <Check size={26} strokeWidth={3} />
        </span>
        <p className="mt-4 max-w-sm text-[14.5px] text-fg-2">{state.message}</p>
        {state.code && <p className="mt-3 rounded-full bg-surface-2 px-4 py-1.5 text-[12.5px] text-fg-2">Código {state.code}</p>}
      </div>
    );
  }

  return (
    <form action={submit} className="grid gap-4" noValidate>
      <input type="hidden" name="plan" value={plan ?? ""} />
      <ChoiceGroup label="¿Qué necesitas?" name="intent" defaultValue="ventas" options={[{ value: "ventas", label: "Propuesta comercial" }, { value: "demo", label: "Demo guiada" }]} />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Nombre completo" name="full_name" defaultValue={values.full_name} icon={<User size={16} />} required error={errors.full_name} />
        <TextField label="Correo de trabajo" name="email" type="email" defaultValue={values.email} icon={<Mail size={16} />} required error={errors.email} />
        <TextField label="Teléfono o WhatsApp" name="phone" defaultValue={values.phone} icon={<Phone size={16} />} placeholder="Opcional" error={errors.phone} />
        <TextField label="Agencia" name="company" defaultValue={values.company} icon={<Building2 size={16} />} required error={errors.company} />
        <SelectField label="Tipo de agencia" name="business_type" placeholder="Elige una opción" options={options.business_types.map((type) => ({ value: type, label: type }))} error={errors.business_type} />
        <SelectField label="Personas en el equipo" name="team_size" defaultValue={options.team_sizes[1] ?? options.team_sizes[0]} options={options.team_sizes.map((size) => ({ value: size, label: size }))} error={errors.team_size} />
      </div>
      <TextArea label="Cuéntanos tu operación" name="message" defaultValue={values.message} rows={3} placeholder="Sedes, volumen de reservas al mes, integraciones que necesitas." />
      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden className="absolute left-[-9999px] h-px w-px opacity-0" />
      <SwitchField name="consent" label="Acepto que el equipo comercial me contacte" hint={errors.consent ?? "Respondemos en menos de 2 horas hábiles, de 9:00 a 19:00 (Lima)."} checked={consent} onCheckedChange={setConsent} />
      {state.message && <p className="rounded-[12px] bg-[color-mix(in_srgb,var(--bad)_10%,transparent)] px-4 py-2.5 text-[13px] font-medium text-bad">{state.message}</p>}
      <Button type="submit" disabled={pending} icon={pending ? <LoaderCircle size={16} className="animate-spin" /> : <ArrowRight size={16} />} className="justify-self-end">
        Hablar con ventas
      </Button>
    </form>
  );
}
