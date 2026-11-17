"use client";

import { CalendarCheck, FileSearch, FileText, Mail, Megaphone, MessageSquareWarning, ReceiptText, ScanSearch, ShieldCheck, ShoppingCart, Sparkles, type LucideIcon } from "lucide-react";
import { useState } from "react";
import { saveFormProtection } from "@/app/plataforma/(consola)/configuracion/actions";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { FieldList } from "@/components/ui/Details";
import { SwitchField } from "@/components/ui/SwitchField";
import { TextField } from "@/components/ui/TextField";
import { TintCardTitle } from "@/components/ui/Tinted";
import { EditSection, SectionCard } from "@/features/admin/Settings";
import { formatDateTime } from "@/lib/format";
import type { PlatformSettingsOverview } from "@/lib/platform";
import type { Tone } from "@/lib/tone";

type Sections = PlatformSettingsOverview["sections"];

const CAPTCHA_STATUS: Record<Sections["form_protection"]["status"], { label: string; tone: Tone }> = {
  activa: { label: "Activa", tone: "ok" },
  incompleta: { label: "Faltan claves", tone: "warn" },
  apagada: { label: "Apagada", tone: "mute" },
};

const PROTECTED_FORMS: { icon: LucideIcon; label: string }[] = [
  { icon: Mail, label: "Contacto" },
  { icon: Sparkles, label: "Viajes a medida" },
  { icon: Megaphone, label: "Boletín" },
  { icon: MessageSquareWarning, label: "Libro de reclamaciones" },
  { icon: ShoppingCart, label: "Checkout" },
  { icon: CalendarCheck, label: "Pedido de demo" },
];

const SCANNED_FILES: { icon: LucideIcon; label: string; text: string }[] = [
  { icon: FileSearch, label: "Evidencias y documentos de viaje", text: "Lo que se sube al cerrar un servicio y los documentos de cada pasajero." },
  { icon: ReceiptText, label: "Facturas y gastos", text: "Facturas que suben los proveedores en la extranet y comprobantes de gastos." },
  { icon: FileText, label: "Constancias y adjuntos", text: "Constancias de transferencia del sitio, adjuntos de la bandeja e importaciones de catálogo." },
];

function FormProtectionFields({ protection }: { protection: Sections["form_protection"] }) {
  const [enabled, setEnabled] = useState(protection.enabled);
  return (
    <>
      <SwitchField label="Activar la protección" name="enabled" checked={enabled} onCheckedChange={setEnabled} hint="Los formularios públicos piden la verificación invisible de Cloudflare." />
      <TextField label="Clave del sitio" name="site_key" defaultValue={protection.site_key} maxLength={120} autoComplete="off" spellCheck={false} hint="En Cloudflare: Turnstile → tu sitio → Site Key." />
      <TextField
        label="Clave secreta"
        name="secret"
        type="password"
        revealable
        maxLength={200}
        autoComplete="new-password"
        placeholder={protection.secret_set ? `Guardada (${protection.secret_hint}). Déjala vacía para mantenerla.` : "Pega la Secret Key"}
        hint="Se guarda cifrada y no se vuelve a mostrar. Al guardar la probamos con Cloudflare."
      />
    </>
  );
}

export function FormProtectionCard({ protection, version }: { protection: Sections["form_protection"]; version: number }) {
  const captcha = CAPTCHA_STATUS[protection.status];

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      <SectionCard
        index={0}
        icon={ShieldCheck}
        tone="t2"
        title="Cloudflare Turnstile"
        action={
          <EditSection section="form_protection" version={version} action={saveFormProtection} title="Protección de formularios" description="Cloudflare Turnstile verifica, sin molestar a la persona, que los formularios públicos los envía alguien real. Una sola cuenta protege los sitios de todas las agencias.">
            <FormProtectionFields protection={protection} />
          </EditSection>
        }
      >
        <FieldList
          fields={[
            { label: "Estado", value: <Badge tone={captcha.tone}>{captcha.label}</Badge> },
            { label: "Proveedor", value: "Cloudflare Turnstile" },
            { label: "Clave del sitio", value: protection.site_key ? <span className="font-mono text-[12.5px]">{protection.site_key}</span> : "—" },
            { label: "Clave secreta", value: protection.secret_set ? <span className="font-mono text-[12.5px]">{protection.secret_hint}</span> : "Sin configurar" },
            { label: "Última prueba", value: protection.verified_at ? formatDateTime(protection.verified_at) : "—" },
          ]}
        />
        {protection.status !== "activa" && <p className="mt-3 rounded-xl bg-surface-2 px-3.5 py-2.5 text-[12.5px] text-fg-2">Mientras esté apagada, los formularios públicos funcionan sin esta verificación.</p>}
      </SectionCard>
      <Card className="lift">
        <TintCardTitle icon={ShieldCheck} title="Formularios protegidos" tone={protection.status === "activa" ? "ok" : "mute"} aside={<Badge tone={captcha.tone}>{captcha.label}</Badge>} />
        <ul className="mt-1 grid grid-cols-2 gap-2">
          {PROTECTED_FORMS.map((form) => (
            <li key={form.label} className="group flex items-center gap-2.5 rounded-xl border border-line-2 px-3 py-2.5 text-[12.5px] font-medium transition hover:border-line hover:bg-surface-2">
              <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-surface-2 text-accent transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110">
                <form.icon size={14} />
              </span>
              {form.label}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[12px] text-fg-3">En los sitios de todas las agencias y en la página comercial de KipuControl.</p>
      </Card>
    </div>
  );
}

export function AntivirusCard({ antivirus }: { antivirus: Sections["antivirus"] }) {
  const tone: Tone = antivirus.simulated ? "warn" : antivirus.ok ? "ok" : "bad";

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      <SectionCard index={0} icon={ScanSearch} tone={antivirus.ok && !antivirus.simulated ? "ok" : "sun"} title="Antivirus de adjuntos">
        <FieldList
          fields={[
            { label: "Estado", value: <Badge tone={tone}>{antivirus.simulated ? "Simulado" : antivirus.ok ? "Conectado" : "No responde"}</Badge> },
            { label: "Motor", value: antivirus.simulated ? "Simulador de pruebas" : "ClamAV" },
            ...(antivirus.message && !antivirus.ok ? [{ label: "Detalle", value: antivirus.message }] : []),
          ]}
        />
        <p className="mt-3 text-[12.5px] text-fg-3">El motor es parte de la instalación del servidor, por eso aquí solo se ve su estado. Si dice «No responde», avisa a quien administra el servidor.</p>
      </SectionCard>
      <Card className="lift">
        <TintCardTitle icon={FileSearch} title="Qué se revisa antes de guardar" tone="t1" />
        <ul className="mt-1 grid gap-2">
          {SCANNED_FILES.map((item) => (
            <li key={item.label} className="group flex items-start gap-3 rounded-xl border border-line-2 p-3 transition hover:border-line hover:bg-surface-2">
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-surface-2 text-accent transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110">
                <item.icon size={16} />
              </span>
              <span className="min-w-0">
                <span className="block text-[13px] font-semibold">{item.label}</span>
                <span className="block text-[12.5px] text-fg-2">{item.text}</span>
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
