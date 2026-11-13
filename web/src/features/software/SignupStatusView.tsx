"use client";

import { ArrowRight, Check, CircleAlert, CreditCard, LoaderCircle, QrCode, Smartphone, Wallet } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { payCheckout } from "@/app/(software)/software/suscribirse/actions";
import { Button } from "@/components/ui/Button";
import { ChoiceGroup } from "@/components/ui/ChoiceGroup";
import { SelectField } from "@/components/ui/SelectField";
import { TextField } from "@/components/ui/TextField";
import { cn } from "@/lib/cn";
import { formatDate, formatMoney } from "@/lib/format";
import type { PaymentMethod, SignupStatus } from "@/lib/landing";
import { OrderSummary, SignupStepper } from "./SignupWizard";

const TEST_CARDS = [
  { value: "tok_ok_4242", label: "Visa terminada en 4242 · aprobada" },
  { value: "tok_51_0005", label: "Mastercard terminada en 0005 · fondos insuficientes" },
  { value: "tok_14_0002", label: "Tarjeta terminada en 0002 · inválida" },
];

function PaymentForm({ token, status }: { token: string; status: SignupStatus }) {
  const router = useRouter();
  const [method, setMethod] = useState<PaymentMethod>("tarjeta");
  const [message, setMessage] = useState<string | null>(status.last_error);
  const [pending, start] = useTransition();

  const pay = (form: FormData) =>
    start(async () => {
      setMessage(null);
      const payment = Object.fromEntries(["card_token", "phone", "approval_code", "paypal_order_id"].map((key) => [key, String(form.get(key) ?? "").trim()]).filter(([, value]) => value !== ""));
      const result = await payCheckout(token, method, method === "paypal" ? { ...payment, paypal_order_id: `SIM-ORDER-${status.tenant}` } : payment);
      if (!result.ok) setMessage(result.message ?? "No pudimos procesar el pago.");
      router.refresh();
    });

  return (
    <form action={pay} className="flex flex-col gap-5">
      <ChoiceGroup label="Medio de pago" name="method_choice" defaultValue="tarjeta" onChange={(value) => setMethod(value as PaymentMethod)} options={[{ value: "tarjeta", label: "Tarjeta" }, { value: "yape", label: "Yape" }, { value: "plin", label: "Plin" }, { value: "paypal", label: "PayPal" }]} />
      {method === "tarjeta" && (
        <div className="rounded-[16px] border border-dashed border-line p-4">
          <p className="mb-3 flex items-center gap-2 text-[13px] font-semibold">
            <CreditCard size={15} /> Campos seguros de la pasarela
          </p>
          <SelectField label="Tarjeta de prueba" name="card_token" defaultValue="tok_ok_4242" options={TEST_CARDS} hint="La pasarela está en modo de pruebas. Con la cuenta real, aquí aparecen sus campos alojados y KipuControl solo recibe un token." />
        </div>
      )}
      {(method === "yape" || method === "plin") && (
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label={`Celular con ${method === "yape" ? "Yape" : "Plin"}`} name="phone" required inputMode="numeric" maxLength={9} placeholder="9XXXXXXXX" icon={<Smartphone size={16} />} />
          <TextField label="Código de aprobación (opcional)" name="approval_code" inputMode="numeric" maxLength={6} hint="Sin código te mostramos un QR que vence en 10 minutos." />
        </div>
      )}
      {method === "paypal" && <p className="rounded-[14px] bg-surface-2 px-4 py-3 text-[13px] text-fg-2">Te llevaremos a PayPal para aprobar el pago. En modo de pruebas la aprobación es inmediata.</p>}
      {message && (
        <p className="flex items-start gap-2 rounded-[12px] bg-[color-mix(in_srgb,var(--bad)_9%,transparent)] px-4 py-2.5 text-[13px] font-medium text-bad">
          <CircleAlert size={15} className="mt-0.5 flex-none" /> {message}
        </p>
      )}
      <Button type="submit" disabled={pending} icon={pending ? <LoaderCircle size={16} className="animate-spin" /> : <Wallet size={16} />} className="self-end">
        Pagar {status.totals ? formatMoney(status.totals.total) : ""}
      </Button>
    </form>
  );
}

function WaitingQr({ token, status }: { token: string; status: SignupStatus }) {
  const router = useRouter();
  const seconds = status.poll_seconds;

  useEffect(() => {
    if (!seconds) return;
    const timer = window.setInterval(() => router.refresh(), seconds * 1000);
    return () => window.clearInterval(timer);
  }, [seconds, router]);

  return (
    <div className="flex flex-col items-center gap-4 rounded-[20px] border border-line bg-surface p-6 text-center">
      <span className="grid h-40 w-40 place-items-center rounded-[18px] border border-line bg-[repeating-linear-gradient(45deg,var(--surface-2)_0_8px,var(--surface)_8px_16px)]">
        <QrCode size={72} className="text-fg" />
      </span>
      <p className="max-w-sm text-[14px] text-fg-2">Escanea el código con {status.payment?.method === "plin" ? "Plin" : "Yape"} para completar el pago. Esta pantalla se actualiza sola.</p>
      {status.payment?.qr && <code className="break-all rounded-full bg-surface-2 px-3 py-1 text-[11.5px] text-fg-3">{status.payment.qr}</code>}
      <p className="flex items-center gap-2 text-[12.5px] text-fg-3">
        <LoaderCircle size={14} className="animate-spin" /> Esperando la confirmación de la billetera
      </p>
      <PaymentForm token={token} status={{ ...status, last_error: null }} />
    </div>
  );
}

function Done({ status }: { status: SignupStatus }) {
  const trial = status.state === "prueba";
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-center text-center">
        <span className="relative grid h-16 w-16 place-items-center">
          <span aria-hidden className="absolute inset-0 rounded-full bg-ok opacity-30 motion-safe:animate-ping" />
          <span className="relative grid h-16 w-16 place-items-center rounded-full bg-ok text-white animate-[pop-in_520ms_cubic-bezier(0.34,1.56,0.64,1)_backwards]">
            <Check size={30} strokeWidth={3} />
          </span>
        </span>
        <h1 className="site-display mt-6 text-[30px] font-bold tracking-[-0.03em] sm:text-[40px]">Te damos la bienvenida, {status.agency}.</h1>
        <p className="mt-3 max-w-lg text-[15px] text-fg-2">
          {trial ? `Tu prueba está activa${status.trial_ends_at ? ` hasta el ${formatDate(status.trial_ends_at, "long")}` : ""}. No te cobraremos nada sin tu confirmación.` : `Recibimos tu pago${status.invoice ? ` y emitimos el comprobante ${status.invoice.number}` : ""}. Tu agencia ya está activa.`}
        </p>
        <Button href={status.login_url} className="mt-6" icon={<ArrowRight size={16} />}>
          Entrar a KipuControl
        </Button>
      </div>
      <section className="rounded-[20px] border border-line bg-surface p-5">
        <h2 className="text-[15px] font-bold">Tus primeros pasos</h2>
        <ol className="mt-3 grid gap-2">
          {status.steps.map((step, index) => (
            <li key={step.code} className="lift flex items-center gap-3 rounded-[14px] border border-line px-4 py-3 text-[13.5px]">
              <span className={cn("grid h-7 w-7 flex-none place-items-center rounded-full text-[12px] font-bold", step.done ? "bg-ok text-white" : "bg-accent/10 text-accent")}>{step.done ? <Check size={13} strokeWidth={3} /> : index + 1}</span>
              {step.label}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

export function SignupStatusView({ token, status }: { token: string; status: SignupStatus }) {
  if (status.state === "pagada" || status.state === "prueba") return <Done status={status} />;

  const waiting = status.state === "pago_pendiente" && status.payment !== null && !status.payment.expired && status.poll_seconds !== null;

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)]">
      <div className="min-w-0">
        <SignupStepper current={2} />
        <h1 className="site-display text-[28px] font-bold tracking-[-0.03em] sm:text-[34px]">Paga y activa {status.agency}</h1>
        <p className="mb-6 mt-2 text-[14.5px] text-fg-2">{status.state === "abandonada" ? "Tu alta quedó pendiente. Retómala cuando quieras; guardamos el plan y el cupón." : "Tu cuenta está creada. Solo falta el pago del primer periodo."}</p>
        {waiting ? <WaitingQr token={token} status={status} /> : <PaymentForm token={token} status={status} />}
      </div>
      {status.totals && <OrderSummary totals={status.totals} />}
    </div>
  );
}
