"use client";

import { Banknote, CalendarPlus, CirclePause, FileX2, Hash, Link2, Mail, RotateCw } from "lucide-react";
import { extendDunning, registerManualPayment, resendInvoice, retryInvoice, sendPaymentLink, suspendForDebt, voidInvoice } from "@/app/plataforma/(consola)/facturacion/actions";
import { SelectField } from "@/components/ui/SelectField";
import { TextArea } from "@/components/ui/TextArea";
import { TextField } from "@/components/ui/TextField";
import { formatMoney } from "@/lib/format";
import { MANUAL_METHODS, type InvoiceSummary } from "@/lib/platformBilling";
import { ConsoleAction } from "./ConsoleAction";

type Target = Pick<InvoiceSummary, "id" | "number" | "total" | "currency" | "status" | "tenant">;

interface ActionProps {
  invoice: Target;
  row?: boolean;
  size?: "md" | "sm";
}

const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(new Date());

export function RetryChargeAction({ invoice, row, size }: ActionProps) {
  return (
    <ConsoleAction
      id={`retry-${invoice.id}`}
      label="Reintentar cobro"
      icon={<RotateCw size={15} />}
      rowTone={row ? "neutral" : undefined}
      size={size}
      title={`Reintentar el cobro de ${invoice.number}`}
      description={`Se cargarán ${formatMoney(invoice.total, invoice.currency)} a la tarjeta registrada de ${invoice.tenant.name}. Un reintento manual no cambia el calendario de cobranza.`}
      submitLabel="Cobrar ahora"
      action={retryInvoice}
      fields={{ id: invoice.id }}
    />
  );
}

export function ManualPaymentAction({ invoice, row, size }: ActionProps) {
  return (
    <ConsoleAction
      id={`manual-${invoice.id}`}
      label="Registrar pago"
      icon={<Banknote size={15} />}
      rowTone={row ? "view" : undefined}
      variant="primary"
      size={size}
      title={`Registrar el pago de ${invoice.number}`}
      description={`${formatMoney(invoice.total, invoice.currency)} pagados por transferencia, depósito o billetera. Si ${invoice.tenant.name} no tiene otra deuda, su suscripción vuelve a estar al día${invoice.tenant.status === "suspendido" ? " y la agencia se reactiva" : ""}.`}
      submitLabel="Registrar pago"
      action={registerManualPayment}
      fields={{ id: invoice.id }}
    >
      <SelectField label="Medio de pago" name="method" options={MANUAL_METHODS.map((method) => ({ value: method, label: method }))} defaultValue={MANUAL_METHODS[0]} />
      <TextField label="Número de operación" name="reference" required minLength={4} maxLength={60} icon={<Hash size={16} />} placeholder="Por ejemplo: 00482913" />
      <TextField label="Fecha del pago" name="paid_on" type="date" required defaultValue={today()} max={today()} />
    </ConsoleAction>
  );
}

export function VoidInvoiceAction({ invoice, row, size }: ActionProps) {
  return (
    <ConsoleAction
      id={`void-${invoice.id}`}
      label="Anular con nota de crédito"
      icon={<FileX2 size={15} />}
      rowTone={row ? "delete" : undefined}
      size={size}
      title={`Anular ${invoice.number}`}
      description={invoice.status === "paid" ? `Se emitirá una nota de crédito NQ01 por ${formatMoney(invoice.total, invoice.currency)} y se pedirá el reembolso a la pasarela.` : `Se emitirá una nota de crédito NQ01 por ${formatMoney(invoice.total, invoice.currency)} y la factura deja de cobrarse.`}
      submitLabel="Anular factura"
      action={voidInvoice}
      fields={{ id: invoice.id }}
    >
      <TextArea label="Motivo" name="reason" required minLength={10} maxLength={300} placeholder="Por ejemplo: cobro duplicado del mismo periodo." hint="Aparece en la nota de crédito y en la auditoría." />
    </ConsoleAction>
  );
}

export function ExtendDunningAction({ invoice, size }: ActionProps) {
  return (
    <ConsoleAction
      id={`extend-${invoice.id}`}
      label="Prórroga de 7 días"
      icon={<CalendarPlus size={15} />}
      size={size}
      title={`Prórroga para ${invoice.tenant.name}`}
      description="El próximo reintento se mueve 7 días y el último también. Solo se concede una prórroga por factura."
      submitLabel="Dar prórroga"
      action={extendDunning}
      fields={{ id: invoice.id }}
    />
  );
}

export function SuspendForDebtAction({ invoice, size }: ActionProps) {
  return (
    <ConsoleAction
      id={`suspend-${invoice.id}`}
      label="Suspender agencia"
      icon={<CirclePause size={15} />}
      variant="ghost"
      size={size}
      title={`Suspender ${invoice.tenant.name}`}
      description="Sus usuarios no podrán ingresar y las sesiones abiertas se cierran. Los datos se conservan y se reactiva al pagar toda la deuda."
      submitLabel="Suspender"
      action={suspendForDebt}
      fields={{ id: invoice.id }}
    >
      <TextArea label="Motivo" name="reason" required minLength={5} maxLength={500} defaultValue={`Falta de pago de la factura ${invoice.number}.`} />
    </ConsoleAction>
  );
}

export function PaymentLinkAction({ invoice, size }: ActionProps) {
  return (
    <ConsoleAction
      id={`link-${invoice.id}`}
      label="Enviar enlace de pago"
      icon={<Link2 size={15} />}
      size={size}
      title={`Enlace de pago para ${invoice.tenant.name}`}
      description={`Le enviamos un correo al contacto de facturación con el monto de ${invoice.number} y el enlace para registrar o cambiar su tarjeta. El calendario de cobranza no cambia.`}
      submitLabel="Enviar enlace"
      action={sendPaymentLink}
      fields={{ id: invoice.id }}
    />
  );
}

export function ResendInvoiceAction({ invoice, size }: ActionProps) {
  return (
    <ConsoleAction
      id={`resend-${invoice.id}`}
      label="Reenviar por correo"
      icon={<Mail size={15} />}
      size={size}
      title={`Reenviar ${invoice.number}`}
      description={`${invoice.tenant.name} recibe de nuevo la factura en su correo de facturación, con su estado actual.`}
      submitLabel="Reenviar"
      action={resendInvoice}
      fields={{ id: invoice.id }}
    />
  );
}
