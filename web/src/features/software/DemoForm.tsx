"use client";

import { ArrowRight, Building2, CalendarCheck, Check, LoaderCircle, Mail, MapPin, MonitorPlay, Phone, User } from "lucide-react";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Captcha } from "@/components/ui/Captcha";
import { ChoiceGroup } from "@/components/ui/ChoiceGroup";
import { SelectField } from "@/components/ui/SelectField";
import { SwitchField } from "@/components/ui/SwitchField";
import { TextArea } from "@/components/ui/TextArea";
import { TextField } from "@/components/ui/TextField";
import { cn } from "@/lib/cn";
import { DEMO_INITIAL, type BillingCycle, type DemoFormState, type DemoKind, type DemoOptions } from "@/lib/software";

interface DemoFormProps {
  options: DemoOptions;
  action: (state: DemoFormState, form: FormData) => Promise<DemoFormState>;
  initialKind: DemoKind;
  initialPlan?: string;
  initialCycle: BillingCycle;
}

const KINDS: { value: DemoKind; label: string; hint: string; icon: typeof MonitorPlay }[] = [
  { value: "demo", label: "Solicitar demo", hint: "Un recorrido guiado según cómo trabaja tu agencia.", icon: MonitorPlay },
  { value: "trial", label: "Empezar prueba", hint: "Tu propio espacio para probar con tu equipo.", icon: CalendarCheck },
];

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <span className="text-bad">{message}</span>;
}

function Success({ state }: { state: DemoFormState }) {
  return (
    <div className="flex flex-col items-center px-4 py-10 text-center">
      <span className="relative grid h-16 w-16 place-items-center">
        <span aria-hidden className="absolute inset-0 rounded-full bg-ok opacity-30 motion-safe:animate-ping" />
        <span className="relative grid h-16 w-16 place-items-center rounded-full bg-ok text-white animate-[pop-in_520ms_cubic-bezier(0.34,1.56,0.64,1)_backwards]">
          <Check size={30} strokeWidth={3} />
        </span>
      </span>
      <h2 className="mt-6 text-[22px] font-bold tracking-tight text-fg">Solicitud enviada</h2>
      <p className="mt-2 max-w-sm text-[14.5px] leading-relaxed text-fg-2">{state.message}</p>
      {state.code && (
        <p className="mt-4 rounded-full bg-surface-2 px-4 py-1.5 text-[13px] text-fg-2">
          Código de seguimiento <b className="font-mono text-fg">{state.code}</b>
        </p>
      )}
      <div className="mt-8 flex flex-wrap justify-center gap-2">
        <Button href="/software/planes" variant="secondary">
          Ver planes
        </Button>
        <Button href="/" variant="ghost">
          Volver al inicio
        </Button>
      </div>
    </div>
  );
}

export function DemoForm({ options, action, initialKind, initialPlan, initialCycle }: DemoFormProps) {
  const [state, submit, pending] = useActionState(action, DEMO_INITIAL);
  const [kind, setKind] = useState<DemoKind>(initialKind);
  const [plan, setPlan] = useState(initialPlan ?? "");
  const [consent, setConsent] = useState(false);
  const chosen = options.plans.find((item) => item.code === plan);
  const errors = state.errors;
  const values = state.values;

  if (state.done) return <Success state={state} />;

  return (
    <form action={submit} className="grid gap-5" noValidate>
      <fieldset>
        <legend className="mb-2 text-[13px] font-semibold text-fg">¿Qué prefieres?</legend>
        <div role="radiogroup" className="grid gap-2 sm:grid-cols-2">
          {KINDS.map((item) => {
            const on = kind === item.value;
            return (
              <button
                key={item.value}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setKind(item.value)}
                className={cn("lift group flex items-start gap-3 rounded-[14px] border p-3.5 text-left", on ? "border-accent bg-[color-mix(in_srgb,var(--accent)_7%,var(--surface))]" : "border-line bg-surface hover:border-[color-mix(in_srgb,var(--fg-3)_40%,transparent)]")}
              >
                <span className={cn("grid h-9 w-9 flex-none place-items-center rounded-[10px] transition-transform duration-300 group-hover:-rotate-6", on ? "bg-accent text-white" : "bg-surface-2 text-fg-2")}>
                  <item.icon size={17} />
                </span>
                <span>
                  <span className="block text-[14px] font-semibold text-fg">{item.label}</span>
                  <span className="mt-0.5 block text-[12.5px] leading-snug text-fg-3">{item.value === "trial" && chosen ? `${chosen.trial_days} días gratis en ${chosen.name}.` : item.hint}</span>
                </span>
              </button>
            );
          })}
        </div>
        <input type="hidden" name="kind" value={kind} />
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Nombre completo" name="full_name" defaultValue={values.full_name} autoComplete="name" icon={<User size={17} />} required hint={<FieldError message={errors.full_name} />} />
        <TextField label="Correo de trabajo" name="email" defaultValue={values.email} type="email" autoComplete="email" icon={<Mail size={17} />} required hint={<FieldError message={errors.email} />} />
        <TextField label="Teléfono o WhatsApp" name="phone" defaultValue={values.phone} type="tel" autoComplete="tel" icon={<Phone size={17} />} placeholder="Opcional" hint={<FieldError message={errors.phone} />} />
        <TextField label="Agencia" name="company" defaultValue={values.company} autoComplete="organization" icon={<Building2 size={17} />} required hint={<FieldError message={errors.company} />} />
        <SelectField label="Tipo de agencia" name="business_type" placeholder="Elige una opción" options={options.business_types.map((type) => ({ value: type, label: type }))} hint={errors.business_type} />
        <TextField label="Ciudad" name="city" defaultValue={values.city} autoComplete="address-level2" icon={<MapPin size={17} />} placeholder="Opcional" hint={<FieldError message={errors.city} />} />
      </div>

      <ChoiceGroup label="¿Cuántas personas usarían el sistema?" name="team_size" defaultValue={options.team_sizes[0]} options={options.team_sizes.map((size) => ({ value: size, label: size }))} hint={errors.team_size} />

      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          label="Plan de interés"
          name="plan"
          defaultValue={plan}
          placeholder="Aún no lo sé"
          options={[{ value: "", label: "Aún no lo sé" }, ...options.plans.map((item) => ({ value: item.code, label: item.name }))]}
          onChange={setPlan}
        />
        {plan ? (
          <div className="animate-[rise-in_320ms_cubic-bezier(0.22,1,0.36,1)_backwards]">
            <ChoiceGroup
              label="Facturación"
              name="billing_cycle"
              defaultValue={initialCycle}
              options={[
                { value: "month", label: "Mensual" },
                { value: "year", label: "Anual" },
              ]}
            />
          </div>
        ) : null}
      </div>

      <TextArea label="¿Qué te gustaría resolver?" name="message" defaultValue={values.message} rows={4} placeholder="Por ejemplo: cotizamos por WhatsApp y perdemos el seguimiento de los pagos." hint={<FieldError message={errors.message} />} />

      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden className="absolute left-[-9999px] h-px w-px opacity-0" />

      <div className="rounded-[14px] bg-surface-2 p-4">
        <SwitchField label="Acepto que Qhapaq me contacte por esta solicitud" hint={errors.consent ?? "Usamos tus datos solo para responder a esta solicitud."} name="consent" checked={consent} onCheckedChange={setConsent} />
      </div>

      <Captcha />
      {state.message && !state.done && <p className="rounded-[12px] bg-[color-mix(in_srgb,var(--bad)_10%,transparent)] px-4 py-3 text-[13.5px] font-medium text-bad animate-[rise-in_320ms_cubic-bezier(0.22,1,0.36,1)_backwards]">{state.message}</p>}

      <Button type="submit" variant="primary" disabled={pending} icon={pending ? <LoaderCircle size={17} className="animate-spin" /> : <ArrowRight size={17} />} className="site-sheen relative h-12 w-full overflow-hidden text-[15px]">
        {pending ? "Enviando" : kind === "trial" ? "Empezar mi prueba" : "Solicitar mi demo"}
      </Button>
    </form>
  );
}
