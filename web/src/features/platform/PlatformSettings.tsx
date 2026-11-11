"use client";

import { BellRing, Building2, Mail, MapPin, Percent, RefreshCcw, ScanSearch, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { saveFormProtection, savePlatformSettings } from "@/app/plataforma/(consola)/configuracion/actions";
import { Badge } from "@/components/ui/Badge";
import { FieldList } from "@/components/ui/Details";
import { SwitchField } from "@/components/ui/SwitchField";
import { TextField } from "@/components/ui/TextField";
import { EditSection, SectionCard } from "@/features/admin/Settings";
import { formatDateTime } from "@/lib/format";
import type { PlatformSettingsOverview } from "@/lib/platform";
import type { Tone } from "@/lib/tone";

const CAPTCHA_STATUS: Record<PlatformSettingsOverview["sections"]["form_protection"]["status"], { label: string; tone: Tone }> = {
  activa: { label: "Activa", tone: "ok" },
  incompleta: { label: "Faltan claves", tone: "warn" },
  apagada: { label: "Apagada", tone: "mute" },
};

function FormProtectionFields({ protection }: { protection: PlatformSettingsOverview["sections"]["form_protection"] }) {
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

const days = (list: number[]) => (list.length === 0 ? "—" : list.map((day) => (day === 0 ? "el mismo día" : `${day} ${day === 1 ? "día" : "días"}`)).join(", "));

export function PlatformSettingsSections({ data }: { data: PlatformSettingsOverview }) {
  const { issuer, taxes, notices, dunning, form_protection: protection, antivirus } = data.sections;
  const captcha = CAPTCHA_STATUS[protection.status];
  const version = data.lock_version;

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <SectionCard
        index={0}
        icon={Building2}
        tone="t1"
        title="Emisor de las facturas"
        updated={data.updated_at}
        action={
          <EditSection section="issuer" version={version} action={savePlatformSettings} title="Emisor de las facturas" description="Son los datos que aparecen como emisor en las facturas FQ01 y notas de crédito NQ01 que la plataforma emite a las agencias.">
            <TextField label="Razón social" name="name" required defaultValue={issuer.name} />
            <TextField label="RUC" name="ruc" required inputMode="numeric" maxLength={11} defaultValue={issuer.ruc} hint="11 dígitos, empieza con 20" />
            <TextField label="Domicilio fiscal" name="address" required defaultValue={issuer.address} icon={<MapPin size={17} />} />
            <div className="grid gap-3 sm:grid-cols-2">
              <TextField label="Correo de facturación" name="email" type="email" required defaultValue={issuer.email} icon={<Mail size={17} />} />
              <TextField label="Sitio web" name="web" defaultValue={issuer.web} />
            </div>
          </EditSection>
        }
      >
        <FieldList
          fields={[
            { label: "Razón social", value: issuer.name || "—" },
            { label: "RUC", value: issuer.ruc ? <span className="font-mono">{issuer.ruc}</span> : "—" },
            { label: "Domicilio fiscal", value: issuer.address || "—" },
            { label: "Correo", value: issuer.email || "—" },
            { label: "Sitio web", value: issuer.web || "—" },
          ]}
        />
      </SectionCard>

      <SectionCard
        index={1}
        icon={Percent}
        tone="t4"
        title="Impuestos y moneda"
        action={
          <EditSection section="taxes" version={version} action={savePlatformSettings} title="Impuestos" description="El IGV se aplica a las facturas nuevas de suscripción. Las ya emitidas conservan el suyo.">
            <TextField label="IGV" name="igv_pct" type="number" inputMode="decimal" min={0} max={30} step="0.01" required defaultValue={taxes.igv_pct} hint="Porcentaje, de 0 a 30" />
          </EditSection>
        }
      >
        <FieldList
          fields={[
            { label: "IGV", value: `${taxes.igv_pct} %` },
            { label: "Moneda de cobro", value: taxes.currency === "PEN" ? "Soles (PEN)" : taxes.currency },
          ]}
        />
      </SectionCard>

      <SectionCard
        index={2}
        icon={BellRing}
        tone="sun"
        title="Avisos a las agencias"
        action={
          <EditSection section="notices" version={version} action={savePlatformSettings} title="Avisos a las agencias" description="Los procesos automáticos de la plataforma envían estos correos a cada agencia.">
            <TextField label="Fin de la prueba" name="trial_days" required defaultValue={notices.trial_days.join(", ")} hint="Días antes del fin, separados por coma. Por ejemplo: 7, 3, 1" />
            <TextField label="Aviso de uso del plan" name="usage_warn_pct" type="number" inputMode="numeric" min={50} max={99} required defaultValue={notices.usage_warn_pct} hint="Porcentaje del límite, de 50 a 99. Al 100 % siempre se avisa." />
            <TextField label="Vencimiento de llaves de API" name="api_key_days" type="number" inputMode="numeric" min={1} max={30} required defaultValue={notices.api_key_days} hint="Días antes del vencimiento" />
          </EditSection>
        }
      >
        <FieldList
          fields={[
            { label: "Fin de la prueba", value: `A ${days(notices.trial_days)} del fin` },
            { label: "Uso del plan", value: `Al ${notices.usage_warn_pct} % y al 100 % del límite` },
            { label: "Llaves de API", value: `${notices.api_key_days} ${notices.api_key_days === 1 ? "día" : "días"} antes de vencer` },
          ]}
        />
      </SectionCard>

      <SectionCard
        index={3}
        icon={RefreshCcw}
        tone="violet"
        title="Cobranza"
        action={
          <Link href="/plataforma/facturacion/cobranza" className="text-[12.5px] font-semibold text-accent hover:underline">
            Editar en Facturación
          </Link>
        }
      >
        <FieldList
          fields={[
            { label: "Reintentos de cobro", value: `${days(dunning.retry_days)} después del fallo` },
            { label: "Al agotar los reintentos", value: dunning.suspend_after_last ? "Se suspende la agencia" : "La agencia sigue activa" },
          ]}
        />
      </SectionCard>

      <SectionCard
        index={4}
        icon={ShieldCheck}
        tone="t2"
        title="Protección de formularios"
        action={
          <EditSection section="form_protection" version={version} action={saveFormProtection} title="Protección de formularios" description="Cloudflare Turnstile verifica, sin molestar a la persona, que los formularios públicos los envía alguien real: contacto, viajes a medida, boletín, reclamaciones, checkout y pedido de demo. Una sola cuenta protege los sitios de todas las agencias.">
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

      <SectionCard index={5} icon={ScanSearch} tone={antivirus.ok && !antivirus.simulated ? "ok" : "sun"} title="Antivirus de adjuntos">
        <FieldList
          fields={[
            { label: "Estado", value: <Badge tone={antivirus.simulated ? "warn" : antivirus.ok ? "ok" : "bad"}>{antivirus.simulated ? "Simulado" : antivirus.ok ? "Conectado" : "No responde"}</Badge> },
            { label: "Motor", value: antivirus.simulated ? "Simulador de pruebas" : "ClamAV" },
            ...(antivirus.message && !antivirus.ok ? [{ label: "Detalle", value: antivirus.message }] : []),
          ]}
        />
        <p className="mt-3 text-[12.5px] text-fg-3">Revisa las evidencias y las facturas de proveedores antes de guardarlas. El motor es parte de la instalación del servidor, por eso aquí solo se ve su estado.</p>
      </SectionCard>
    </div>
  );
}
