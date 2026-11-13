"use client";

import { KeyRound, Plug } from "lucide-react";
import { saveChannelAccounts } from "@/app/(backoffice)/inbox/channel-actions";
import { ChannelIcon } from "@/features/inbox/InboxViews";
import { Badge } from "@/components/ui/Badge";
import { PanelAction } from "@/components/ui/PanelAction";
import { SelectField } from "@/components/ui/SelectField";
import { TextField } from "@/components/ui/TextField";
import { CHANNEL_ACCOUNT_STATUS, type ChannelAccount } from "@/lib/inbox";
import type { StepResult } from "@/lib/server/resource";

const initial: StepResult = { message: null, done: false };

const STATUS_OPTIONS = Object.entries(CHANNEL_ACCOUNT_STATUS).map(([value, { label }]) => ({ value, label }));

function ChannelBlock({ account }: { account: ChannelAccount }) {
  const whatsapp = account.channel === "whatsapp";
  const key = whatsapp ? "phone_number_id" : "mailbox";
  const identifier = (whatsapp ? account.phone_number_id : account.mailbox) ?? "";
  const status = CHANNEL_ACCOUNT_STATUS[account.status];
  const name = (field: string) => `${account.channel}.${field}`;

  return (
    <section className="lift rounded-xl border border-line p-4">
      <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2.5 text-[14px] font-semibold">
          <ChannelIcon channel={account.channel} />
          {account.label}
        </span>
        <span className="flex flex-wrap items-center gap-1.5">
          <Badge tone={account.connected ? status.tone : "mute"}>{account.connected ? status.label : "Sin configurar"}</Badge>
          <Badge tone={account.webhook_secret_set ? "ok" : "warn"} dot={false}>
            <KeyRound size={12} className="mr-1 inline" />
            {account.webhook_secret_set ? "Secreto configurado" : "Sin secreto"}
          </Badge>
        </span>
      </header>
      <p className="mb-3 rounded-lg bg-surface-2 px-3 py-2 text-[12px] text-fg-2">
        {whatsapp ? "Dirección del webhook en Meta" : "Dirección de reenvío del proveedor de correo"}: <span className="break-all font-mono text-[11.5px]">{account.webhook_url}</span>. Cada envío llega firmado con <span className="font-mono text-[11.5px]">{account.signature_header}</span>.
      </p>
      <input type="hidden" name={`${name(key)}.before`} value={identifier} />
      <input type="hidden" name={`${name("sla")}.before`} value={String(account.first_response_sla_minutes)} />
      <input type="hidden" name={`${name("status")}.before`} value={account.status} />
      <div className="grid gap-3 sm:grid-cols-2">
        {whatsapp ? (
          <TextField label="ID del número" name={name(key)} defaultValue={identifier} inputMode="numeric" maxLength={30} spellCheck={false} hint="En Meta: WhatsApp → Configuración de la API → Identificador del número." />
        ) : (
          <TextField label="Buzón" name={name(key)} type="email" defaultValue={identifier} maxLength={190} spellCheck={false} hint="La dirección a la que te escriben los clientes." />
        )}
        <TextField label="Plazo de primera respuesta" name={name("sla")} type="number" inputMode="numeric" min={5} max={2880} defaultValue={account.first_response_sla_minutes} hint="En minutos, de 5 a 2880." />
        <SelectField label="Estado" name={name("status")} options={STATUS_OPTIONS} defaultValue={account.status} hint="Desconectado deja de recibir mensajes." />
        <TextField
          label="Secreto del webhook"
          name={name("webhook_secret")}
          type="password"
          revealable
          maxLength={255}
          autoComplete="new-password"
          placeholder={account.webhook_secret_set ? "Configurado. Escribe uno nuevo para cambiarlo." : "Pega el secreto de firma"}
          hint="Se guarda cifrado y no se vuelve a mostrar."
        />
      </div>
    </section>
  );
}

export function ChannelAccountsPanel({ accounts }: { accounts: ChannelAccount[] }) {
  return (
    <PanelAction<StepResult>
      label="Canales e integración"
      icon={<Plug size={15} />}
      formId="inbox-channel-accounts"
      title="Canales e integración"
      description="Conecta el número de WhatsApp y el buzón de correo. Los mensajes que lleguen firmados con el secreto se convierten en conversaciones de esta bandeja."
      submitLabel="Guardar canales"
      action={saveChannelAccounts}
      initial={initial}
    >
      {() => (
        <div className="grid gap-4">
          {accounts.map((account) => (
            <ChannelBlock key={account.channel} account={account} />
          ))}
        </div>
      )}
    </PanelAction>
  );
}
