"use client";

import { Receipt } from "lucide-react";
import { useState } from "react";
import { saveFiscalWebhook } from "@/app/plataforma/(consola)/configuracion/fiscal-actions";
import { Badge } from "@/components/ui/Badge";
import { FieldList } from "@/components/ui/Details";
import { SwitchField } from "@/components/ui/SwitchField";
import { TextField } from "@/components/ui/TextField";
import { EditSection, SectionCard } from "@/features/admin/Settings";
import type { PlatformSettingsOverview } from "@/lib/platform";

type Webhook = PlatformSettingsOverview["sections"]["fiscal_webhook"];

function SecretFields({ webhook }: { webhook: Webhook }) {
  const [clear, setClear] = useState(false);
  return (
    <>
      {!clear && (
        <TextField
          label="Secreto de firma"
          name="webhook_secret"
          type="password"
          revealable
          maxLength={200}
          autoComplete="new-password"
          spellCheck={false}
          placeholder={webhook.secret_set ? "Configurado. Escribe uno nuevo para cambiarlo." : "El que te entrega el OSE"}
          hint="De 16 a 200 caracteres, sin espacios. Se guarda cifrado y no se vuelve a mostrar."
        />
      )}
      {webhook.secret_set && <SwitchField label="Quitar el secreto" name="clear" checked={clear} onCheckedChange={setClear} hint="Los avisos del OSE se validarán con la clave local de la instalación hasta que guardes otro." />}
    </>
  );
}

export function FiscalWebhookCard({ webhook, version, index }: { webhook: Webhook; version: number; index: number }) {
  return (
    <SectionCard
      index={index}
      icon={Receipt}
      tone="t2"
      title="Webhook fiscal"
      updated={webhook.changed_at}
      action={
        <EditSection section="fiscal_webhook" version={version} action={saveFiscalWebhook} title="Webhook fiscal" description="El OSE avisa a esta dirección cuando SUNAT acepta u observa un comprobante, y firma cada aviso con este secreto. Es uno solo para todas las agencias.">
          <SecretFields webhook={webhook} />
        </EditSection>
      }
    >
      <FieldList
        fields={[
          { label: "Secreto de firma", value: <Badge tone={webhook.secret_set ? "ok" : "mute"}>{webhook.secret_set ? "Configurado" : "Sin configurar"}</Badge> },
          { label: "Proveedor", value: webhook.simulated ? <Badge tone="warn">Simulado</Badge> : "OSE conectado" },
          { label: "URL de devolución", value: <span className="break-all font-mono text-[12.5px]">{webhook.callback_url}</span> },
          { label: "Cabecera de firma", value: <span className="font-mono text-[12.5px]">{webhook.signature_header}</span> },
        ]}
      />
    </SectionCard>
  );
}
