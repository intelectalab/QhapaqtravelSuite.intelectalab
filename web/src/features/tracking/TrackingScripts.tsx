"use client";

import { Check, Code2, Lock, Pause, Play, Plus, ShieldAlert, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { PanelAction } from "@/components/ui/PanelAction";
import { TextArea } from "@/components/ui/TextArea";
import { createScript, tagAction, updateScript } from "@/app/(backoffice)/canales/seguimiento/actions";
import { CONSENT_LABEL, type TrackingTag } from "@/lib/tracking";
import type { StepResult } from "@/lib/server/resource";
import { Hidden, initialStep, ScriptFields, TagStatusBadge, WhenLabel } from "./TrackingUi";

function Decide({ tag, decision }: { tag: TrackingTag; decision: "aprobar" | "rechazar" }) {
  const approve = decision === "aprobar";
  return (
    <PanelAction<StepResult>
      label={approve ? "Aprobar" : "Rechazar"}
      icon={approve ? <Check size={15} /> : <X size={15} />}
      variant={approve ? "primary" : "secondary"}
      size="sm"
      formId={`script-${decision}-${tag.code}`}
      title={approve ? "Aprobar script" : "Rechazar script"}
      description={approve ? (tag.pending_revision ? "El cambio reemplaza la versión activa en menos de 1 minuto." : "El script empieza a cargar en menos de 1 minuto, nunca en el pago.") : "Quien lo envió verá el motivo y podrá corregirlo."}
      submitLabel={approve ? "Aprobar" : "Rechazar"}
      action={tagAction}
      initial={initialStep}
    >
      {() => (
        <>
          <Hidden values={{ code: tag.code, action: "decision", decision }} />
          {!approve && <TextArea label="Motivo" name="reason" required minLength={10} rows={3} placeholder="Explica qué debe corregirse (10 caracteres o más)." />}
        </>
      )}
    </PanelAction>
  );
}

function ScriptCard({ tag, canManage, canApprove, own }: { tag: TrackingTag; canManage: boolean; canApprove: boolean; own: boolean }) {
  const reviewable = tag.status === "en_revision" || tag.pending_revision !== null;
  return (
    <article className="lift rounded-card border border-line bg-surface p-4">
      <header className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-[15px] font-semibold">{tag.name}</h3>
          <p className="text-[12.5px] text-fg-3">
            {tag.code} · cookies de {CONSENT_LABEL[tag.consent_category].toLowerCase()} · {tag.created_by_name ?? "Equipo"}
          </p>
        </div>
        <TagStatusBadge status={tag.status} pending={tag.pending_revision !== null} />
      </header>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="min-w-0">
          <p className="mb-1 flex items-center gap-1.5 text-[12px] font-semibold text-fg-3">
            <Code2 size={13} /> Fuente
          </p>
          <pre className="max-h-36 overflow-auto whitespace-pre-wrap break-all rounded-tile border border-line bg-surface-2/60 px-3 py-2 font-mono text-[12px]">{tag.script_src ?? tag.script_body}</pre>
          {tag.sri_hash && <p className="mt-1 truncate font-mono text-[11.5px] text-fg-3">SRI {tag.sri_hash}</p>}
          {tag.pending_revision?.script_src && <p className="mt-2 rounded-tile bg-[color-mix(in_srgb,var(--warn)_10%,transparent)] px-3 py-2 text-[12.5px]">Cambio propuesto por {tag.pending_revision.author_name ?? "el equipo"}: <span className="font-mono">{tag.pending_revision.script_src}</span></p>}
        </div>
        <ul className="flex flex-col gap-1.5 text-[13px] text-fg-2">
          <li>
            Páginas <span className="font-mono">{tag.pages}</span>
          </li>
          <li className="inline-flex items-center gap-1">
            <Lock size={13} /> Nunca en <span className="font-mono">/checkout</span>
          </li>
          <li>Dominios en la CSP: {tag.csp_domains.map((domain) => <span key={domain} className="mr-1 inline-block rounded-full border border-line px-2 py-0.5 font-mono text-[11.5px]">{domain}</span>)}</li>
          {tag.approved_by_name && <li>Aprobado por {tag.approved_by_name}</li>}
          <li><WhenLabel at={tag.submitted_at} prefix="Enviado" /></li>
          {tag.reject_reason && <li className="text-bad">Rechazo: {tag.reject_reason}</li>}
        </ul>
      </div>
      <footer className="mt-4 flex flex-wrap justify-end gap-2">
        {canApprove && reviewable && (own ? <Button variant="ghost" size="sm" disabled title="403 SCRIPT_SELF_APPROVAL">Lo aprueba otra persona</Button> : (
          <>
            <Decide tag={tag} decision="rechazar" />
            <Decide tag={tag} decision="aprobar" />
          </>
        ))}
        {canManage && ["borrador", "rechazado"].includes(tag.status) && (
          <PanelAction<StepResult> label="Enviar a revisión" size="sm" formId={`script-submit-${tag.code}`} title="Enviar a revisión" description="Lo revisa una persona con permiso de aprobación." submitLabel="Enviar" action={tagAction} initial={initialStep}>
            {() => <Hidden values={{ code: tag.code, action: "submit" }} />}
          </PanelAction>
        )}
        {canManage && ["activo", "pausado"].includes(tag.status) && (
          <PanelAction<StepResult> label={tag.status === "activo" ? "Pausar" : "Reanudar"} icon={tag.status === "activo" ? <Pause size={15} /> : <Play size={15} />} size="sm" formId={`script-pause-${tag.code}`} title={tag.status === "activo" ? "Pausar script" : "Reanudar script"} description="El cambio se aplica en menos de 1 minuto." submitLabel="Confirmar" action={tagAction} initial={initialStep}>
            {() => <Hidden values={{ code: tag.code, action: "pause" }} />}
          </PanelAction>
        )}
        {canManage && (
          <PanelAction<StepResult> label="Editar" size="sm" formId={`script-edit-${tag.code}`} title={`Editar ${tag.name}`} description={tag.status === "activo" ? "El cambio queda como revisión; la versión actual sigue activa hasta que se apruebe." : "Guarda los cambios del script."} submitLabel="Guardar" action={updateScript} initial={initialStep}>
            {() => (
              <>
                <Hidden values={{ code: tag.code, lock_version: tag.lock_version }} />
                <ScriptFields tag={tag} />
              </>
            )}
          </PanelAction>
        )}
      </footer>
    </article>
  );
}

export function ScriptsSection({ rows, canManage, canApprove, me, selfApprovalBlocked }: { rows: TrackingTag[]; canManage: boolean; canApprove: boolean; me: string; selfApprovalBlocked: boolean }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-tile border border-line bg-[color-mix(in_srgb,var(--warn)_7%,var(--surface))] px-4 py-3">
        <p className="flex max-w-[640px] items-start gap-2 text-[13px] text-fg-2">
          <ShieldAlert size={16} className="mt-0.5 flex-none text-warn" /> Usa un script propio solo si la herramienta no está entre las etiquetas. Debe declarar sus dominios y, si viene de otro servidor, el hash SRI. Lo aprueba una persona con permiso de aprobación.
        </p>
        {canManage && (
          <PanelAction<StepResult> label="Nuevo script" icon={<Plus size={16} strokeWidth={2.4} />} size="sm" formId="script-new" title="Nuevo script propio" description="Se envía a revisión al guardarlo y nunca carga en la página de pago." submitLabel="Enviar a revisión" action={createScript} initial={initialStep}>
            {() => <ScriptFields />}
          </PanelAction>
        )}
      </div>
      {rows.length === 0 ? <p className="rounded-tile border border-dashed border-line px-4 py-8 text-center text-[13.5px] text-fg-3">Sin scripts propios.</p> : rows.map((tag) => <ScriptCard key={tag.code} tag={tag} canManage={canManage} canApprove={canApprove} own={selfApprovalBlocked && (tag.pending_revision?.author ?? tag.created_by) === me} />)}
    </div>
  );
}
