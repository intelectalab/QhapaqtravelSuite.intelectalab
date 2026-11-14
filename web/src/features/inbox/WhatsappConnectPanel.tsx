"use client";

import { KeyRound, LockKeyhole, MessageCircle, PlugZap, Smartphone, Unplug } from "lucide-react";
import { useState } from "react";
import { connectWhatsapp, disconnectWhatsapp } from "@/app/(backoffice)/inbox/whatsapp-actions";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ChoiceGroup } from "@/components/ui/ChoiceGroup";
import { PanelAction } from "@/components/ui/PanelAction";
import { TextField } from "@/components/ui/TextField";
import { formatDateTime } from "@/lib/format";
import type { WhatsappConnection } from "@/lib/inbox";
import type { StepResult } from "@/lib/server/resource";

const initial: StepResult = { message: null, done: false };

const GUIDED = [
  { icon: Smartphone, title: "Inicia sesión en Meta", text: "Se abre la ventana oficial de Meta con tu cuenta de Facebook o de la empresa." },
  { icon: PlugZap, title: "Elige o crea tu número", text: "Si ya usas WhatsApp Business, puedes conservar el número con el QR oficial de Meta." },
  { icon: MessageCircle, title: "Listo para responder", text: "Los mensajes llegan a esta bandeja y tú pagas tus envíos directo a Meta." },
];

const OWN_STEPS = [
  "En Meta for Developers crea una app de tipo Empresa y agrega el producto WhatsApp.",
  "En Configuración básica copia el ID de la app y el secreto de la app.",
  "Crea un usuario del sistema con un token permanente con permiso whatsapp_business_messaging.",
  "En WhatsApp → Configuración de la API copia el ID del número.",
  "Guarda aquí y pega en Meta la URL de aviso y el token de verificación que te mostramos; suscribe el campo messages.",
];

function Notice() {
  return (
    <p className="flex items-start gap-2.5 rounded-xl bg-surface-2 px-3.5 py-3 text-[12.5px] text-fg-2">
      <LockKeyhole size={15} className="mt-0.5 shrink-0 text-accent" />
      <span>Los mensajes pasan por el servidor de KipuControl, que actúa como encargado de tratamiento, y se guardan cifrados. El número y la cuenta de WhatsApp Business siguen siendo tuyos.</span>
    </p>
  );
}

function Summary({ connection }: { connection: WhatsappConnection }) {
  const items = [
    { label: "Número", value: connection.display_phone ?? connection.phone_number_id ?? "—" },
    { label: "Conexión", value: connection.mode_label },
    { label: "Cuenta de WhatsApp Business", value: connection.waba_masked ?? "—", mono: true },
    { label: "Conectado desde", value: connection.connected_at ? formatDateTime(connection.connected_at) : "—" },
  ];
  return (
    <dl className="grid grid-cols-2 gap-2">
      {items.map((item) => (
        <div key={item.label} className="lift rounded-xl border border-line px-3 py-2.5">
          <dt className="text-[11.5px] text-fg-3">{item.label}</dt>
          <dd className={item.mono ? "mt-0.5 font-mono text-[12.5px]" : "mt-0.5 text-[13px] font-semibold"}>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function GuidedFields({ connection }: { connection: WhatsappConnection }) {
  const [testPhone, setTestPhone] = useState("");
  const code = `SIM-${testPhone.replace(/\D/g, "") || "registro"}`;
  return (
    <div className="grid gap-3">
      <ol className="grid gap-2">
        {GUIDED.map((step, index) => (
          <li key={step.title} className="flex items-start gap-3 rounded-xl border border-line-2 p-3 transition hover:border-line hover:bg-surface-2">
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-surface-2 text-accent">
              <step.icon size={16} />
            </span>
            <span>
              <span className="block text-[13px] font-semibold">{`${index + 1}. ${step.title}`}</span>
              <span className="block text-[12.5px] text-fg-2">{step.text}</span>
            </span>
          </li>
        ))}
      </ol>
      {!connection.platform.ready && <p className="rounded-xl bg-[color-mix(in_srgb,var(--warn)_12%,transparent)] px-3.5 py-2.5 text-[12.5px] text-fg">KipuControl todavía no terminó de configurar su app de Meta. Puedes usar tu propia app mientras tanto.</p>}
      {connection.platform.simulated && (
        <>
          <TextField label="Número de prueba" name="sim_phone" value={testPhone} onChange={(event) => setTestPhone(event.target.value)} inputMode="tel" maxLength={20} placeholder="+51 984 000 111" hint="El conector de Meta está en modo simulado: con este número armamos un registro de prueba." />
          <input type="hidden" name="code" value={code} />
        </>
      )}
    </div>
  );
}

function OwnAppFields({ connection }: { connection: WhatsappConnection }) {
  const own = connection.mode === "propia" ? connection.own_app : null;
  return (
    <div className="grid gap-3">
      <ol className="grid gap-1.5 rounded-xl border border-line-2 p-3 text-[12.5px] text-fg-2">
        {OWN_STEPS.map((step, index) => (
          <li key={step} className="flex gap-2">
            <span className="grid size-5 shrink-0 place-items-center rounded-full bg-surface-2 text-[11px] font-semibold text-fg">{index + 1}</span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField label="ID de la app" name="app_id" defaultValue={own?.app_id ?? ""} inputMode="numeric" maxLength={20} spellCheck={false} />
        <TextField label="ID del número" name="phone_number_id" defaultValue={connection.mode === "propia" ? (connection.phone_number_id ?? "") : ""} inputMode="numeric" maxLength={30} spellCheck={false} />
      </div>
      <TextField label="Secreto de la app" name="app_secret" type="password" revealable maxLength={200} autoComplete="new-password" spellCheck={false} icon={<KeyRound size={17} />} placeholder={own?.app_secret_set ? "Guardado. Escribe uno nuevo para cambiarlo." : "Con él verificamos la firma de cada aviso"} />
      <TextField label="Token permanente" name="access_token" type="password" revealable maxLength={600} autoComplete="new-password" spellCheck={false} icon={<KeyRound size={17} />} placeholder={own?.access_token_set ? "Guardado. Escribe uno nuevo para cambiarlo." : "Los envíos salen con este token"} />
      <TextField label="ID de la cuenta de WhatsApp Business" name="waba_id" inputMode="numeric" maxLength={30} spellCheck={false} placeholder={connection.waba_masked ?? "Opcional"} hint="Sirve para recibir la revisión de tus plantillas." />
      <div className="rounded-xl bg-surface-2 px-3.5 py-3 text-[12.5px] text-fg-2">
        <p className="font-semibold text-fg">URL de aviso para Meta</p>
        <p className="mt-0.5 break-all font-mono text-[11.5px]">{connection.own_app.webhook_url}</p>
        {own?.verify_token && (
          <>
            <p className="mt-2 font-semibold text-fg">Token de verificación</p>
            <p className="mt-0.5 break-all font-mono text-[11.5px]">{own.verify_token}</p>
          </>
        )}
        <p className="mt-2">Cada aviso llega firmado con {connection.own_app.signature_header} usando el secreto de tu app.</p>
      </div>
    </div>
  );
}

export function WhatsappConnectPanel({ connection }: { connection: WhatsappConnection }) {
  const [mode, setMode] = useState<string>(connection.mode);
  return (
    <PanelAction<StepResult>
      label={connection.connected ? "WhatsApp conectado" : "Conectar WhatsApp"}
      icon={<MessageCircle size={15} />}
      variant={connection.connected ? "secondary" : "primary"}
      formId="inbox-whatsapp-connect"
      title={connection.connected ? "WhatsApp conectado" : "Conectar WhatsApp"}
      description="Conecta tu propio número de WhatsApp Business con la app oficial de KipuControl en Meta."
      submitLabel={mode === "propia" ? "Guardar mi app de Meta" : connection.connected ? "Volver a conectar" : "Conectar con Meta"}
      action={connectWhatsapp}
      initial={initial}
      footerExtra={() =>
        connection.connected ? (
          <form
            action={async () => {
              await disconnectWhatsapp();
            }}
          >
            <Button type="submit" variant="ghost" icon={<Unplug size={15} />}>
              Desconectar
            </Button>
          </form>
        ) : null
      }
    >
      {() => (
        <div className="grid gap-4">
          <Notice />
          {connection.connected && <Summary connection={connection} />}
          {!connection.enabled && <Badge tone="warn">WhatsApp Business oficial no está activo en tu plan.</Badge>}
          <ChoiceGroup
            label="Cómo conectar"
            name="mode"
            defaultValue={connection.mode}
            onChange={setMode}
            options={[
              { value: "plataforma", label: "Registro guiado" },
              { value: "propia", label: "Mi propia app de Meta" },
            ]}
            hint={mode === "propia" ? "Opción avanzada: usas tu app de Meta y tu propia URL de aviso." : "Recomendado: no necesitas crear nada en Meta for Developers."}
          />
          {mode === "propia" ? <OwnAppFields connection={connection} /> : <GuidedFields connection={connection} />}
        </div>
      )}
    </PanelAction>
  );
}
