"use client";

import { Plus } from "lucide-react";
import { PanelAction, type PanelActionState } from "@/components/ui/PanelAction";
import { TextField } from "@/components/ui/TextField";
import { cn } from "@/lib/cn";
import type { ConversionMatrix } from "@/lib/tracking";
import { FormSwitch, Hidden, ProviderChip } from "./TrackingUi";

type Action<S extends PanelActionState> = (state: S, form: FormData) => Promise<S>;

export function ConversionsMatrix<S extends PanelActionState>({ matrix, canManage, save, remove, initial }: { matrix: ConversionMatrix; canManage: boolean; save: Action<S>; remove?: Action<S>; initial: S }) {
  if (matrix.tags.length === 0) {
    return <p className="rounded-tile border border-dashed border-line px-4 py-8 text-center text-[13.5px] text-fg-3">Crea una etiqueta de GA4, Google Ads, Meta, TikTok, Clarity o LinkedIn para decidir qué conversiones recibe.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-x-auto rounded-card border border-line">
        <table className="w-full min-w-[640px] border-collapse text-[13px]">
          <thead>
            <tr className="bg-surface-2/60">
              <th className="px-3 py-2.5 text-left text-[12px] font-semibold text-fg-3">Evento del sitio</th>
              {matrix.tags.map((tag) => (
                <th key={tag.code} className="px-3 py-2.5 text-center">
                  <ProviderChip provider={tag.provider} label={tag.provider_name} />
                  <span className="mt-1 block text-[11.5px] font-medium text-fg-3">{tag.name}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.events.map((event) => (
              <tr key={event.code} className="border-t border-line">
                <td className="px-3 py-2.5">
                  <b className="font-semibold">{event.label}</b>
                  <span className="block font-mono text-[11.5px] text-fg-3">
                    {event.ga4}
                    {event.value ? " · con valor" : ""}
                  </span>
                </td>
                {matrix.tags.map((tag) => {
                  const mapping = tag.mappings[event.code];
                  const cell = (
                    <span className={cn("inline-flex min-w-[104px] flex-col items-center gap-0.5 rounded-[9px] border px-2.5 py-1.5 transition duration-200 hover:-translate-y-0.5", mapping ? "border-[color-mix(in_srgb,var(--ok)_45%,var(--line))] bg-[color-mix(in_srgb,var(--ok)_8%,transparent)]" : "border-dashed border-line text-fg-3 hover:border-accent hover:text-accent")}>
                      {mapping ? (
                        <>
                          <b className="text-[12.5px]">{mapping.provider_event}</b>
                          <span className="text-[11px] text-fg-3">
                            {mapping.server_side ? "navegador + servidor" : "navegador"}
                            {mapping.send_value ? " · valor" : ""}
                          </span>
                        </>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[12px]">
                          <Plus size={12} /> Enviar
                        </span>
                      )}
                    </span>
                  );
                  return (
                    <td key={tag.code} className="px-3 py-2 text-center">
                      {canManage ? (
                        <PanelAction<S>
                          label="Configurar"
                          formId={`map-${tag.code}-${event.code}`}
                          title={`${event.label} → ${tag.provider_name}`}
                          description="Cada conversión lleva un event_id único para que el proveedor la cuente una sola vez."
                          submitLabel="Guardar"
                          action={save}
                          initial={initial}
                          trigger={(open) => (
                            <button type="button" onClick={open} className="cursor-pointer">
                              {cell}
                            </button>
                          )}
                          footerExtra={
                            mapping && remove
                              ? () => (
                                  <button type="submit" form={`map-${tag.code}-${event.code}`} name="remove" value="1" className="mr-auto text-[13px] font-semibold text-bad hover:underline">
                                    Quitar envío
                                  </button>
                                )
                              : undefined
                          }
                        >
                          {() => (
                            <>
                              <Hidden values={{ tag: tag.code, event: event.code }} />
                              <TextField label={`Nombre del evento en ${tag.provider_name}`} name="provider_event" required defaultValue={mapping?.provider_event ?? tag.defaults[event.code]} />
                              {tag.provider === "google_ads" && <TextField label="Etiqueta de conversión" name="conversion_label" required defaultValue={mapping?.conversion_label ?? ""} placeholder="AbC-dEf_123" hint="Google Ads › Objetivos › Conversiones" />}
                              <FormSwitch name="send_value" label="Enviar valor y moneda" defaultChecked={mapping?.send_value ?? event.value} />
                              <FormSwitch name="server_side" label="También desde el servidor" hint={tag.server_capable ? "Necesita el consentimiento de marketing del visitante." : "Activa el envío del servidor en la etiqueta para usarlo."} defaultChecked={mapping?.server_side ?? false} disabled={!tag.server_capable} />
                            </>
                          )}
                        </PanelAction>
                      ) : (
                        cell
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="rounded-tile border border-line bg-surface-2/50 px-4 py-3 text-[12.5px] leading-relaxed text-fg-2">La compra se reporta cuando el pago está confirmado; los pagos pendientes (Yape o transferencia) van como evento aparte. Correo y teléfono solo viajan cifrados con SHA-256.</p>
    </div>
  );
}
