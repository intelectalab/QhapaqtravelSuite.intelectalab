"use client";

import { CalendarHeart, CreditCard, Heart, Loader2, LogIn, LogOut, MailCheck, ReceiptText, Search, Ticket, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useActionState, useState, useTransition, type ReactNode } from "react";
import { forgotAccount, loginAccount, logoutAccount, lookupOrder, registerAccount, requestTripLink, resendVerification, sendArcoRequest, toggleWish, unsubscribeNewsletter, updateAccount } from "@/app/(sitio)/sitio/[agencia]/actions";
import { SelectField } from "@/components/ui/SelectField";
import { TextArea } from "@/components/ui/TextArea";
import { TextField } from "@/components/ui/TextField";
import { cn } from "@/lib/cn";
import { IDLE, SITE_COUNTRIES, SITE_DOC_TYPES, WISHLIST_STORAGE_KEY, type AccountMe, type SiteFormState } from "@/lib/site";
import { useStoredValue } from "@/lib/useStoredValue";
import { CheckBox, FormAlert } from "./FormBits";
import { Done, Section } from "./Forms";
import { useSite } from "./SiteContext";

const LOCALES = [{ value: "es", label: "Español" }, { value: "en", label: "English" }, { value: "pt", label: "Português" }, { value: "fr", label: "Français" }, { value: "de", label: "Deutsch" }];

const parseWishlist = (raw: string | null): string[] => {
  try {
    const value = JSON.parse(raw ?? "[]");
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
};

const serializeWishlist = (value: string[]) => JSON.stringify(value);

function useLocalWishlist() {
  return useStoredValue(WISHLIST_STORAGE_KEY, parseWishlist, serializeWishlist);
}

function SubmitButton({ pending, label, icon }: { pending: boolean; label: string; icon: ReactNode }) {
  return (
    <button type="submit" disabled={pending} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-control bg-brand px-6 text-[15px] font-semibold text-brand-fg shadow-[0_10px_24px_-12px_var(--brand)] transition hover:-translate-y-0.5 hover:brightness-110 disabled:opacity-60 sm:w-auto">
      {pending ? <Loader2 size={17} className="animate-spin" /> : icon}
      {label}
    </button>
  );
}

function Notice({ tone, children }: { tone: "ok" | "info" | "warn"; children: ReactNode }) {
  return <p className={cn("rounded-xl border px-4 py-3 text-[13.5px] leading-relaxed", tone === "ok" ? "border-[color-mix(in_srgb,var(--ok)_30%,transparent)] bg-[color-mix(in_srgb,var(--ok)_8%,var(--surface))] text-fg" : tone === "warn" ? "border-[color-mix(in_srgb,var(--warn)_35%,transparent)] bg-[color-mix(in_srgb,var(--warn)_8%,var(--surface))] text-fg" : "border-[color-mix(in_srgb,var(--info)_30%,transparent)] bg-[color-mix(in_srgb,var(--info)_8%,var(--surface))] text-fg")}>{children}</p>;
}

function errorsOf(state: SiteFormState): Record<string, string> {
  return state.errors ?? {};
}

export function LoginForm({ next, notice }: { next?: string; notice?: string }) {
  const { agencia, href } = useSite();
  const [wishlist] = useLocalWishlist();
  const [state, action, pending] = useActionState(loginAccount.bind(null, agencia), IDLE);
  const errors = errorsOf(state);

  return (
    <form action={action} className="grid gap-4">
      {notice && <Notice tone="info">{notice}</Notice>}
      <FormAlert message={state.status === "error" ? state.message : undefined} />
      <input type="hidden" name="wishlist" value={JSON.stringify(wishlist)} />
      {next && <input type="hidden" name="next" value={next} />}
      <TextField label="Correo electrónico" name="email" type="email" autoComplete="email" error={errors.email} />
      <TextField label="Contraseña" name="password" revealable autoComplete="current-password" error={errors.password} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SubmitButton pending={pending} label="Ingresar" icon={<LogIn size={17} />} />
        <Link href={href("/cuenta/recuperar")} className="text-[13px] font-semibold text-accent hover:underline">
          Olvidé mi contraseña
        </Link>
      </div>
    </form>
  );
}

export function RegisterForm() {
  const { agencia, name } = useSite();
  const [wishlist] = useLocalWishlist();
  const [state, action, pending] = useActionState(registerAccount.bind(null, agencia), IDLE);
  const errors = errorsOf(state);

  return (
    <form action={action} className="grid gap-5">
      <FormAlert message={state.status === "error" ? state.message : undefined} />
      <input type="hidden" name="wishlist" value={JSON.stringify(wishlist)} />
      <Section title="Tus datos" hint="Si ya compraste con nosotros, usa el mismo correo: vinculamos tus reservas.">
        <TextField label="Nombres y apellidos" name="name" autoComplete="name" error={errors.name} />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Correo electrónico" name="email" type="email" autoComplete="email" error={errors.email} />
          <TextField label="Celular" name="phone" type="tel" autoComplete="tel" placeholder="+51 9xx xxx xxx" error={errors.phone} />
        </div>
        <div className="grid gap-4 sm:grid-cols-[1fr_140px_1fr]">
          <SelectField label="País de residencia" name="country" options={SITE_COUNTRIES} defaultValue="Perú" error={errors.country} />
          <SelectField label="Documento" name="doc_type" options={SITE_DOC_TYPES} defaultValue="DNI" error={errors.doc_type} />
          <TextField label="Número de documento" name="doc_number" autoComplete="off" error={errors.doc_number} />
        </div>
      </Section>
      <Section title="Tu contraseña" hint="Mínimo 8 caracteres.">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Contraseña" name="password" revealable autoComplete="new-password" error={errors.password} />
          <TextField label="Repite la contraseña" name="password_confirmation" revealable autoComplete="new-password" />
        </div>
      </Section>
      <div className="grid gap-3">
        <CheckBox
          name="accept"
          error={errors.accept}
          label={
            <>
              Acepto los términos y autorizo a <b className="font-semibold text-fg">{name}</b> a tratar mis datos para gestionar mis reservas, conforme a la Ley 29733.
            </>
          }
        />
        <CheckBox name="newsletter" label="Quiero recibir ofertas y novedades por correo (opcional)." />
      </div>
      <div>
        <SubmitButton pending={pending} label="Crear mi cuenta" icon={<UserRound size={17} />} />
      </div>
    </form>
  );
}

export function ForgotForm() {
  const { agencia, href } = useSite();
  const [state, action, pending] = useActionState(forgotAccount.bind(null, agencia), IDLE);

  if (state.status === "done") {
    return (
      <Done title="Revisa tu correo" action={<Link href={href("/cuenta/ingresar")} className="inline-flex h-11 items-center rounded-control border border-line px-5 text-[14px] font-semibold text-fg transition hover:bg-surface-2">Volver a ingresar</Link>}>
        <p>{state.message} Al terminar, vuelve aquí e ingresa con tu nueva contraseña.</p>
      </Done>
    );
  }

  return (
    <form action={action} className="grid gap-4">
      <FormAlert message={state.status === "error" ? state.message : undefined} />
      <TextField label="Correo de tu cuenta" name="email" type="email" autoComplete="email" error={state.errors?.email} />
      <div>
        <SubmitButton pending={pending} label="Enviarme el enlace" icon={<MailCheck size={17} />} />
      </div>
    </form>
  );
}

export function LookupForm() {
  const { agencia } = useSite();
  const [state, action, pending] = useActionState(lookupOrder.bind(null, agencia), IDLE);
  const errors = errorsOf(state);

  return (
    <form action={action} className="grid gap-4">
      <FormAlert message={state.status === "error" ? state.message : undefined} />
      <TextField label="Correo con el que compraste" name="email" type="email" autoComplete="email" error={errors.email} />
      <TextField label="Código de pedido o de reserva" name="code" placeholder="WEB-2026-000123 o RES-2026-0456" autoComplete="off" error={errors.code} hint="Lo encuentras en el correo de confirmación." />
      <div>
        <SubmitButton pending={pending} label="Buscar mi compra" icon={<Search size={17} />} />
      </div>
    </form>
  );
}

export function TripLinkForm() {
  const { agencia } = useSite();
  const [state, action, pending] = useActionState(requestTripLink.bind(null, agencia), IDLE);
  const errors = errorsOf(state);

  if (state.status === "done") {
    return (
      <Done title="Revisa tu correo">
        <p>{state.message} Ábrelo desde el celular o la computadora donde quieras ver tu viaje.</p>
      </Done>
    );
  }

  return (
    <form action={action} className="grid gap-4">
      <FormAlert message={state.status === "error" ? state.message : undefined} />
      <TextField label="Correo del titular o del viajero" name="email" type="email" autoComplete="email" error={errors.email} />
      <TextField label="Código de reserva" name="code" placeholder="RES-2026-000123" autoComplete="off" error={errors.code} hint="Está en tu confirmación y en tus vouchers." />
      <div>
        <SubmitButton pending={pending} label="Enviarme el enlace" icon={<MailCheck size={17} />} />
      </div>
    </form>
  );
}

export function UnsubscribeForm({ token }: { token: string }) {
  const { agencia } = useSite();
  const [state, action, pending] = useActionState(unsubscribeNewsletter.bind(null, agencia, token), IDLE);

  if (state.status === "done") return <Notice tone="ok">{state.message}</Notice>;

  return (
    <form action={action} className="grid gap-4">
      <FormAlert message={state.status === "error" ? state.message : undefined} />
      <div>
        <SubmitButton pending={pending} label="Confirmar la baja" icon={<MailCheck size={17} />} />
      </div>
    </form>
  );
}

export function VerifyNotice({ email }: { email: string }) {
  const { agencia } = useSite();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <Notice tone="warn">
      Confirma tu correo <b>{email}</b> con el enlace que te enviamos.{" "}
      {message ?? (
        <button type="button" disabled={pending} onClick={() => start(async () => setMessage((await resendVerification(agencia)).message))} className="font-semibold text-accent hover:underline disabled:opacity-60">
          {pending ? "Enviando…" : "Reenviar enlace"}
        </button>
      )}
    </Notice>
  );
}

const NAV = [
  { path: "/cuenta", label: "Mis reservas", icon: CalendarHeart, exact: true },
  { path: "/cuenta/vouchers", label: "Vouchers", icon: Ticket },
  { path: "/cuenta/pagos", label: "Pagos", icon: CreditCard },
  { path: "/cuenta/deseos", label: "Lista de deseos", icon: Heart },
  { path: "/cuenta/datos", label: "Mis datos", icon: UserRound },
];

export function AccountNav({ pending }: { pending: number }) {
  const { agencia, href } = useSite();
  const pathname = usePathname();
  const [leaving, start] = useTransition();
  const active = (path: string, exact?: boolean) => (exact ? pathname === href(path) || pathname.startsWith(href("/cuenta/reservas")) : pathname.startsWith(href(path)));

  return (
    <nav aria-label="Secciones de tu cuenta" className="flex gap-1 overflow-x-auto rounded-card border border-line bg-surface p-1.5 shadow-card lg:flex-col lg:overflow-visible">
      {NAV.map(({ path, label, icon: Icon, exact }) => (
        <Link key={path} href={href(path)} aria-current={active(path, exact) ? "page" : undefined} className={cn("flex h-11 flex-none items-center gap-2.5 rounded-xl px-3.5 text-[14px] font-semibold transition", active(path, exact) ? "bg-brand text-brand-fg" : "text-fg-2 hover:bg-surface-2 hover:text-fg")}>
          <Icon size={17} />
          {label}
          {path === "/cuenta/pagos" && pending > 0 && <span className={cn("ml-auto grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[11px] font-bold", active(path) ? "bg-brand-fg text-brand" : "bg-warn text-white")}>{pending}</span>}
        </Link>
      ))}
      <button type="button" disabled={leaving} onClick={() => start(() => logoutAccount(agencia))} className="flex h-11 flex-none items-center gap-2.5 rounded-xl px-3.5 text-[14px] font-semibold text-fg-3 transition hover:bg-surface-2 hover:text-fg disabled:opacity-60 lg:mt-1 lg:border-t lg:border-line lg:pt-1">
        {leaving ? <Loader2 size={17} className="animate-spin" /> : <LogOut size={17} />}
        Cerrar sesión
      </button>
    </nav>
  );
}

export function ProfileForm({ me }: { me: AccountMe }) {
  const { agencia } = useSite();
  const [state, action, pending] = useActionState(updateAccount.bind(null, agencia), IDLE);
  const errors = errorsOf(state);

  return (
    <form action={action} className="grid gap-4">
      {state.status === "done" && <Notice tone="ok">{state.message}</Notice>}
      <FormAlert message={state.status === "error" ? state.message : undefined} />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Nombres y apellidos" value={me.name} readOnly disabled hint="Para corregirlo, escríbenos o usa la solicitud de rectificación." />
        <TextField label="Documento" value={me.document ?? "—"} readOnly disabled />
        <TextField label="Correo de contacto" name="email" type="email" defaultValue={me.email ?? ""} error={errors.email} disabled={me.passenger} />
        <TextField label="Celular" name="phone" type="tel" defaultValue={me.phone ?? ""} error={errors.phone} disabled={me.passenger} />
        <SelectField label="País" name="country" options={SITE_COUNTRIES} defaultValue={me.country ?? "Perú"} error={errors.country} />
        <TextField label="Ciudad" name="city" defaultValue={me.city ?? ""} error={errors.city} disabled={me.passenger} />
        <SelectField label="Idioma de los correos" name="locale" options={LOCALES} defaultValue={me.locale} />
      </div>
      <CheckBox name="newsletter" defaultChecked={me.newsletter} label="Recibir ofertas y novedades por correo." />
      {!me.passenger && (
        <div>
          <SubmitButton pending={pending} label="Guardar cambios" icon={<UserRound size={17} />} />
        </div>
      )}
    </form>
  );
}

export function ArcoForm({ types }: { types: AccountMe["arco_types"] }) {
  const { agencia } = useSite();
  const [state, action, pending] = useActionState(sendArcoRequest.bind(null, agencia), IDLE);
  const errors = errorsOf(state);

  if (state.status === "done") return <Notice tone="ok">{state.message}</Notice>;

  return (
    <form action={action} className="grid gap-4">
      <FormAlert message={state.status === "error" ? state.message : undefined} />
      <SelectField label="Derecho que quieres ejercer" name="type" options={types.map((type) => ({ value: type.value, label: `${type.label} · respuesta en ${type.days} días hábiles` }))} defaultValue={types[0]?.value} error={errors.type} />
      <TextArea label="Cuéntanos tu pedido" name="detail" rows={4} error={errors.detail} placeholder="Ej. Quiero recibir una copia de los datos personales que guardan de mí." />
      <div>
        <SubmitButton pending={pending} label="Enviar solicitud" icon={<ReceiptText size={17} />} />
      </div>
    </form>
  );
}

export function WishButton({ slug, signedIn, initial = false, className }: { slug: string; signedIn: boolean; initial?: boolean; className?: string }) {
  const { agencia } = useSite();
  const router = useRouter();
  const [local, setLocal] = useLocalWishlist();
  const [saved, setSaved] = useState(initial);
  const [pending, start] = useTransition();
  const on = signedIn ? saved : local.includes(slug);

  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={on ? "Quitar de mi lista de deseos" : "Guardar en mi lista de deseos"}
      title={on ? "En tu lista de deseos" : "Guardar en mi lista de deseos"}
      disabled={pending}
      onClick={() => {
        if (!signedIn) {
          setLocal(on ? local.filter((item) => item !== slug) : [...local, slug]);
          return;
        }
        start(async () => {
          const result = await toggleWish(agencia, slug, !on);
          if (result.ok) setSaved(!on);
          router.refresh();
        });
      }}
      className={cn("inline-flex h-11 items-center justify-center gap-2 rounded-control border px-4 text-[13.5px] font-semibold transition hover:-translate-y-0.5 disabled:opacity-60", on ? "border-[color-mix(in_srgb,var(--bad)_35%,transparent)] bg-[color-mix(in_srgb,var(--bad)_8%,var(--surface))] text-bad" : "border-line bg-surface text-fg-2 hover:text-fg", className)}
    >
      <Heart size={16} className={cn("transition-transform", on && "scale-110 fill-current")} />
      {on ? "Guardado" : "Guardar"}
    </button>
  );
}
