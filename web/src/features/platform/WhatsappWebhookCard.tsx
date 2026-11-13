"use client";

import { MessageCircle } from "lucide-react";
import { useState } from "react";
import { saveWhatsappWebhook } from "@/app/plataforma/(consola)/configuracion/whatsapp-actions";
import { Badge } from "@/components/ui/Badge";
import { FieldList } from "@/components/ui/Details";
import { SwitchField } from "@/components/ui/SwitchField";
import { TextField } from "@/components/ui/TextField";
import { EditSection, SectionCard } from "@/features/admin/Settings";
import type { PlatformSettingsOverview } from "@/lib/platform";

type Webhook = PlatformSettingsOverview["sections"]["whatsapp_webhook"];

function WebhookFields({ webhook }: { webhook: Webhook }) {
  const [clear, setClear] = useState(false);
  return (
    <>
      {!clear && (
        <TextField
          label="Token de verificación"
          name="verify_token"
          type="password"
          revealable
          maxLength={120}
          autoComplete="new-password"
          spellCheck={false}
          placeholder={webhook.verify_token_set ? "Configurado. Escribe uno nuevo para cambiarlo." : "El mismo que escribes en Meta"}
          hint="De 12 a 120 caracteres. Se guarda cifrado y no se vuelve a mostrar."
        />
      )}
      {webhook.verify_token_set && <SwitchField label="Quitar el token" name="clear" checked={clear} onCheckedChange={setClear} hint="Meta no podrá volver a verificar la suscripción hasta que guardes otro." />}
    </>
  );
}

export function WhatsappWebhookCard({ webhook, version, index }: { webhook: Webhook; version: number; index: number }) {
  return (
    <SectionCard
      index={index}
      icon={MessageCircle}
      tone="ok"
      title="Webhook de WhatsApp"
      updated={webhook.changed_at}
      action={
        <EditSection section="whatsapp_webhook" version={version} action={saveWhatsappWebhook} title="Webhook de WhatsApp" description="Meta llama a esta dirección para confirmar la suscripción de la app y responde con el token que escribas aquí. Es uno solo para todas las agencias; cada agencia carga el secreto de su número en su bandeja.">
          <WebhookFields webhook={webhook} />
        </EditSection>
      }
    >
      <FieldList
        fields={[
          { label: "Token de verificación", value: <Badge tone={webhook.verify_token_set ? "ok" : "mute"}>{webhook.verify_token_set ? "Configurado" : "Sin configurar"}</Badge> },
          { label: "URL de devolución", value: <span className="break-all font-mono text-[12.5px]">{webhook.callback_url}</span> },        ]}
      />
    </SectionCard>
  );
}
