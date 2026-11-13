"use client";

import { CheckCircle2, Send, XCircle } from "lucide-react";
import Link from "next/link";
import { useActionState, useState, type ReactNode } from "react";
import { cancelBooking, registerAgency } from "@/app/(vitrina)/vitrina/actions";
import { cityName, rlPath, type RlFormResult } from "@/lib/rutas-libres";

const initial: RlFormResult = { ok: false, message: null };

function Done({ message, children }: { message: string; children?: ReactNode }) {
  return (
    <div role="status" className="flex flex-col items-start gap-4">
      <span className="grid h-12 w-12 place-items-center rounded-full bg-[var(--rl-emerald-soft)] text-[var(--rl-emerald)]"><CheckCircle2 size={26} /></span>
      <p className="text-[15px] font-semibold">{message}</p>
      {children}
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className="flex items-start gap-3 text-left text-[13.5px]">
      <span className={`mt-0.5 flex h-5 w-9 flex-none items-center rounded-full p-0.5 transition ${checked ? "bg-[var(--rl-cobalt)]" : "bg-[var(--rl-line-strong)]"}`}><span className={`h-4 w-4 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-4" : ""}`} /></span>
      <span>{label}</span>
    </button>
  );
}

export function AgencyForm({ cities }: { cities: string[] }) {
  const [state, action, pending] = useActionState(registerAgency, initial);
  const [city, setCity] = useState(cities[0] ?? "lima");
  const [pass, setPass] = useState(false);
  const [news, setNews] = useState(true);
  if (state.ok && state.message) return <Done message={state.message} />;
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="city" value={city} />
      <input type="hidden" name="wants_pass" value={pass ? "1" : "0"} />
      <input type="hidden" name="marketing_opt_in" value={news ? "1" : "0"} />
      <label className="rl-field sm:col-span-2">Nombre comercial<input className="rl-input" name="name" required minLength={3} maxLength={160} /></label>
      <fieldset className="sm:col-span-2">
        <legend className="mb-2 text-[13px] font-semibold">Ciudad donde opera</legend>
        <div className="flex flex-wrap gap-2">
          {cities.map((value) => (
            <button key={value} type="button" aria-pressed={city === value} onClick={() => setCity(value)} className="rl-chip">{cityName(value)}</button>
          ))}
        </div>
      </fieldset>
      <label className="rl-field">Correo<input className="rl-input" name="email" type="email" required maxLength={160} autoComplete="email" /></label>
      <label className="rl-field">WhatsApp<input className="rl-input" name="phone" maxLength={30} autoComplete="tel" /></label>
      <label className="rl-field">RUC<input className="rl-input" name="ruc" inputMode="numeric" pattern="(10|20)[0-9]{9}" maxLength={11} title="11 dígitos, empieza con 10 o 20" /></label>
      <label className="rl-field">Licencia de turismo<input className="rl-input" name="license_ref" maxLength={60} placeholder="Registro DIRCETUR" /></label>
      <div className="flex flex-col gap-3 sm:col-span-2">
        <Toggle label="Quiero probar el Pase Básico de 30 días con mi propio sitio web" checked={pass} onChange={setPass} />
        <Toggle label="Recibir novedades de Rutas Libres para agencias" checked={news} onChange={setNews} />
      </div>
      {state.message && <p role="alert" className="rounded-2xl bg-[var(--rl-coral-soft)] px-4 py-3 text-[13.5px] font-semibold text-[var(--rl-coral)] sm:col-span-2">{state.message}</p>}
      <button type="submit" disabled={pending} className="rl-cta sm:col-span-2"><Send size={16} />{pending ? "Enviando…" : "Enviar registro"}</button>
    </form>
  );
}

export function CancelForm({ token, base }: { token: string; base: string }) {
  const [state, action, pending] = useActionState(cancelBooking, initial);
  if (state.ok && state.message) {
    return (
      <Done message={state.message}>
        <Link href={rlPath(base)} className="rl-btn">Ver otros tours</Link>
      </Done>
    );
  }
  return (
    <form action={action} className="flex flex-col items-start gap-4">
      <input type="hidden" name="token" value={token} />
      {state.message && <p role="alert" className="rounded-2xl bg-[var(--rl-coral-soft)] px-4 py-3 text-[13.5px] font-semibold text-[var(--rl-coral)]">{state.message}</p>}
      <div className="flex flex-wrap gap-3">
        <button type="submit" disabled={pending} className="rl-cta"><XCircle size={16} />{pending ? "Cancelando…" : "Sí, cancelar mi reserva"}</button>
        <Link href={rlPath(base)} className="rl-btn">Mantener la reserva</Link>
      </div>
    </form>
  );
}
