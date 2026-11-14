"use client";

import { Apple, ExternalLink, Smartphone } from "lucide-react";
import { useRouter } from "next/navigation";
import { saveMobileAppVersions } from "@/app/plataforma/(consola)/integraciones/actions";
import { RowIcon } from "@/components/table/RowActions";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { InfoTip } from "@/components/ui/InfoTip";
import { PanelAction } from "@/components/ui/PanelAction";
import { TextField } from "@/components/ui/TextField";
import { TintCardTitle } from "@/components/ui/Tinted";
import { formatDateTime } from "@/lib/format";
import type { ConsoleResult } from "@/lib/server/platformConsole";

export interface MobileAppPlatform {
  platform: "ios" | "android";
  label: string;
  min_version: string | null;
  store_url: string | null;
}

export interface MobileAppVersionsSummary {
  platforms: MobileAppPlatform[];
  updated_at: string | null;
  lock_version: number;
}

const INITIAL: ConsoleResult = { message: null, done: false };

const STORE_HINT: Record<MobileAppPlatform["platform"], string> = {
  ios: "https://apps.apple.com/…",
  android: "https://play.google.com/store/apps/details?id=…",
};

function EditVersions({ summary }: { summary: MobileAppVersionsSummary }) {
  const router = useRouter();
  return (
    <PanelAction<ConsoleResult>
      label="Editar"
      variant="ghost"
      size="sm"
      formId="mobile-app-versions"
      trigger={(open) => <RowIcon tone="edit" label="Editar versión mínima" onClick={open} />}
      title="Versión mínima de la app"
      description="La app con una versión menor deja de funcionar y muestra «Actualiza la app» con el enlace a la tienda. Deja la versión vacía para no exigir ninguna."
      submitLabel="Guardar cambios"
      action={saveMobileAppVersions}
      initial={INITIAL}
      onDone={() => router.refresh()}
    >
      {() => (
        <div className="flex flex-col gap-5">
          {summary.platforms.map((item) => (
            <fieldset key={item.platform} className="flex flex-col gap-3">
              <legend className="mb-1 text-[13px] font-semibold text-fg">{item.label}</legend>
              <TextField label="Versión mínima" name={`${item.platform}_min_version`} defaultValue={item.min_version ?? ""} placeholder="1.4.0" pattern="\d{1,3}(\.\d{1,3}){0,2}" maxLength={20} />
              <TextField label="Enlace a la tienda" name={`${item.platform}_store_url`} type="url" defaultValue={item.store_url ?? ""} placeholder={STORE_HINT[item.platform]} maxLength={300} hint="Obligatorio si fijas una versión mínima." />
            </fieldset>
          ))}
        </div>
      )}
    </PanelAction>
  );
}

export function MobileAppVersionsBoard({ summary, canEdit }: { summary: MobileAppVersionsSummary; canEdit: boolean }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-1.5 text-[13px] text-fg-2">
          La app del operador y del pasajero envía su versión en cada pedido. Si es menor a la mínima, la API responde 426.
          <InfoTip>Vale para todas las agencias: la versión depende del binario publicado en cada tienda, no de la agencia.</InfoTip>
        </p>
        {canEdit && <EditVersions summary={summary} />}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {summary.platforms.map((item, index) => (
          <div key={item.platform} style={{ animationDelay: `${index * 60}ms` }} className="animate-[rise-in_420ms_cubic-bezier(0.22,1,0.36,1)_backwards]">
            <Card className="lift h-full">
              <TintCardTitle icon={item.platform === "ios" ? Apple : Smartphone} title={item.label} tone={item.platform === "ios" ? "t1" : "ok"} aside={<Badge tone={item.min_version ? "warn" : "mute"}>{item.min_version ? "Exige versión" : "Sin mínimo"}</Badge>} />
              <p className="text-[28px] font-semibold tabular-nums leading-none">{item.min_version ?? "—"}</p>
              <p className="mt-1 text-[12.5px] text-fg-3">{item.min_version ? "Versión mínima para usar la app" : "Cualquier versión puede conectarse"}</p>
              {item.store_url ? (
                <a href={item.store_url} target="_blank" rel="noreferrer" className="mt-4 inline-flex max-w-full items-center gap-1.5 truncate text-[13px] text-accent hover:underline">
                  <ExternalLink size={14} className="flex-none" />
                  <span className="truncate">{item.store_url}</span>
                </a>
              ) : (
                <p className="mt-4 text-[13px] text-fg-3">Sin enlace a la tienda</p>
              )}
            </Card>
          </div>
        ))}
      </div>
      {summary.updated_at && <p className="text-[11.5px] text-fg-3">Actualizado el {formatDateTime(summary.updated_at)}</p>}
    </div>
  );
}
