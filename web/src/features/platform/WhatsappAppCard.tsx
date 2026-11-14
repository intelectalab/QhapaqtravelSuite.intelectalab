"use client";

import { KeyRound, LockKeyhole, MessageCircle, PlugZap, ShieldCheck, Smartphone } from "lucide-react";
import { saveWhatsappApp, testWhatsappApp } from "@/app/plataforma/(consola)/integraciones/whatsapp/actions";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FieldList } from "@/components/ui/Details";
import { InfoTip } from "@/components/ui/InfoTip";
import { PanelAction } from "@/components/ui/PanelAction";
import { TextField } from "@/components/ui/TextField";
import { TintCardTitle } from "@/components/ui/Tinted";
import { EditSection, SectionCard } from "@/features/admin/Settings";
import { ADMIN_INITIAL, type AdminActionState } from "@/lib/admin";
import { formatDateTime } from "@/lib/format";
import type { WhatsappAppSummary } from "@/lib/platform";
import type { Tone } from "@/lib/tone";

const STATUS: Record<WhatsappAppSummary["status"], { label: string; tone: Tone }> = {
  lista: { label: "Lista", tone: "ok" },
  incompleta: { label: "Faltan datos", tone: "warn" },
  sin_configurar: { label: "Sin configurar", tone: "mute" },
};

const STEPS = [
  { icon: Smartphone, title: "La agencia pulsa «Conectar WhatsApp»", text: "En su bandeja, con el registro guiado de Meta y su propio número." },
  { icon: PlugZap, title: "Meta devuelve el número y la cuenta", text: "Los reconocemos por el ID del número y guardamos la cuenta cifrada." },
  { icon: LockKeyhole, title: "Cada aviso llega firmado", text: "Validamos la firma con el secreto de esta app y guardamos los mensajes cifrados." },
];

function AppFields({ app }: { app: WhatsappAppSummary }) {
  return (
    <>
      <TextField label="ID de la app" name="app_id" defaultValue={app.app_id} inputMode="numeric" maxLength={20} required spellCheck={false} hint="Meta for Developers → tu app → Configuración básica." />
      <TextField
        label="Secreto de la app"
        name="app_secret"
        type="password"
        revealable
        maxLength={200}
        autoComplete="new-password"
        spellCheck={false}
        icon={<KeyRound size={17} />}
        placeholder={app.app_secret_set ? `Guardado (${app.app_secret_hint}). Escribe uno nuevo para rotarlo.` : "Pega el secreto de la app"}
        hint="Firma cada aviso de Meta. Al rotarlo, el anterior sigue valiendo 24 horas."
      />
      <TextField
        label="Token de verificación"
        name="verify_token"
        type="password"
        revealable
        maxLength={120}
        autoComplete="new-password"
        spellCheck={false}
        placeholder={app.verify_token_set ? "Configurado. Escribe uno nuevo para cambiarlo." : "El mismo que escribes en Meta"}
        hint="De 12 a 120 caracteres. Meta lo usa una vez para confirmar la URL de devolución."
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField label="ID de configuración del registro guiado" name="config_id" defaultValue={app.config_id} inputMode="numeric" maxLength={40} spellCheck={false} hint="Facebook Login para empresas → Configuraciones." />
        <TextField label="Versión de la API" name="api_version" defaultValue={app.api_version} maxLength={8} spellCheck={false} hint="Por ejemplo v21.0." />
      </div>
    </>
  );
}

function TestApp({ app }: { app: WhatsappAppSummary }) {
  return (
    <PanelAction<AdminActionState>
      label="Probar"
      formId="whatsapp-app-test"
      title="Probar la app de Meta"
      description="Le pedimos a Meta que confirme el ID y el secreto guardados. No envía mensajes."
      submitLabel="Probar ahora"
      action={testWhatsappApp}
      initial={ADMIN_INITIAL}
      trigger={(open) => (
        <Button variant="secondary" size="sm" icon={<ShieldCheck size={15} />} onClick={open} disabled={!app.app_secret_set || app.app_id === ""}>
          Probar
        </Button>
      )}
    >
      {() => <p className="text-[13px] text-fg-2">{app.simulated ? "Mientras el conector de Meta esté en modo simulado, la prueba revisa el formato de los datos." : "La prueba consulta la app en Meta con su secreto."}</p>}
    </PanelAction>
  );
}

export function WhatsappAppCard({ app }: { app: WhatsappAppSummary }) {
  const status = STATUS[app.status];
  const test = app.last_test;

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      <SectionCard
        index={0}
        icon={MessageCircle}
        tone="ok"
        title="App de Meta de KipuControl"
        updated={app.changed_at}
        action={
          <EditSection section="whatsapp_app" version={0} action={saveWhatsappApp} title="App de Meta de KipuControl" description="Una sola app de KipuControl en Meta conecta los números de todas las agencias. Cada agencia paga sus mensajes a Meta.">
            <AppFields app={app} />
          </EditSection>
        }
      >
        <FieldList
          fields={[
            { label: "Estado", value: <Badge tone={status.tone}>{status.label}</Badge> },
            { label: "Conector", value: app.simulated ? <Badge tone="warn">Simulado</Badge> : "Meta Cloud API" },
            { label: "ID de la app", value: app.app_id ? <span className="font-mono text-[12.5px]">{app.app_id}</span> : "—" },
            { label: "Secreto de la app", value: app.app_secret_set ? <span className="font-mono text-[12.5px]">{app.app_secret_hint}</span> : "Sin configurar" },
            { label: "Token de verificación", value: app.verify_token_set ? "Configurado" : "Sin configurar" },
            { label: "Registro guiado", value: app.config_id ? <span className="font-mono text-[12.5px]">{app.config_id}</span> : "Sin configurar" },
            { label: "URL de devolución", value: <span className="break-all font-mono text-[12.5px]">{app.callback_url}</span> },
            { label: "Cabecera de firma", value: <span className="font-mono text-[12.5px]">{app.signature_header}</span> },
            ...(app.previous_secret_until ? [{ label: "Secreto anterior", value: `Sigue valiendo hasta ${formatDateTime(app.previous_secret_until)}` }] : []),
            ...(test ? [{ label: "Última prueba", value: <span className={test.ok ? "text-ok" : "text-bad"}>{`${test.ok ? "Correcta" : "Falló"} · ${formatDateTime(test.at)}`}</span> }] : []),
          ]}
        />
        <div className="mt-3 flex justify-end">
          <TestApp app={app} />
        </div>
      </SectionCard>
      <Card className="lift">
        <TintCardTitle icon={PlugZap} title="Cómo se conecta cada agencia" tone="t2" aside={<InfoTip>Los mensajes de las agencias pasan por KipuControl como encargado de tratamiento y se guardan cifrados. La agencia también puede usar su propia app de Meta desde su bandeja.</InfoTip>} />
        <ol className="mt-1 grid gap-3">
          {STEPS.map((step, index) => (
            <li key={step.title} className="flex items-start gap-3 rounded-xl border border-line-2 p-3 transition hover:border-line hover:bg-surface-2">
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-surface-2 text-accent">
                <step.icon size={16} />
              </span>
              <span className="min-w-0">
                <span className="block text-[13px] font-semibold">{`${index + 1}. ${step.title}`}</span>
                <span className="block text-[12.5px] text-fg-2">{step.text}</span>
              </span>
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}
