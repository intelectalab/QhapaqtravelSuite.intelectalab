"use client";

import { Plus, Target, TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { createLead, createLeadFromConversation, type LeadActionState } from "@/app/(backoffice)/crm/leads/actions";
import { Button } from "@/components/ui/Button";
import { PanelAction } from "@/components/ui/PanelAction";
import type { Advisor, CrmCatalogs } from "@/lib/leads";
import { LeadFields, type LeadDefaults } from "./LeadFields";

function DuplicateNotice({ state }: { state: LeadActionState }) {
  if (!state.matches || state.matches.length === 0) return null;
  return (
    <div className="rounded-xl border border-warn/30 bg-warn/[0.08] p-3.5 text-[13px]">
      <p className="mb-2 flex items-center gap-2 font-semibold text-warn">
        <TriangleAlert size={16} />
        Ya existe con ese correo o teléfono
      </p>
      <ul className="mb-2 flex flex-col gap-1 text-fg-2">
        {state.matches.map((match) => (
          <li key={match.code}>
            {match.type === "client" ? "Cliente" : "Lead"} <b className="text-fg">{match.name}</b> · {match.code}
          </li>
        ))}
      </ul>
      <p className="text-fg-3">{mergeTarget(state) ? "Si es la misma persona, fusiónalo con el lead abierto: se completan sus datos vacíos sin crear otro registro." : "Si es otra persona, regístralo igual. Si es la misma, márcalo como duplicado."}</p>
      <input type="hidden" name="duplicate_resolution" value="create_new" />
      {mergeTarget(state) && <input type="hidden" name="merge_into" value={mergeTarget(state)} />}
    </div>
  );
}

const OPEN_STATUSES = ["nuevo", "contactado", "calificado"];

const mergeTarget = (state: LeadActionState) => state.matches?.find((match) => match.type === "lead" && OPEN_STATUSES.includes(match.status))?.code;

const duplicateButton = (formId: string, allowMerge = false) =>
  function MarkDuplicate(state: LeadActionState, pending: boolean) {
    if (!state.matches || state.matches.length === 0) return null;
    const target = allowMerge ? mergeTarget(state) : undefined;
    return (
      <>
        <Button type="submit" form={formId} name="duplicate_resolution" value="mark_duplicate" variant="ghost" disabled={pending}>
          Marcar como duplicado
        </Button>
        {target && (
          <Button type="submit" form={formId} name="duplicate_resolution" value="merge" variant="secondary" disabled={pending}>
            Fusionar con {target}
          </Button>
        )}
      </>
    );
  };

export function LeadCreateAction({ catalogs, advisors, defaultOpen = false }: { catalogs: CrmCatalogs; advisors: Advisor[]; defaultOpen?: boolean }) {
  const router = useRouter();

  return (
    <PanelAction<LeadActionState>
      label="Nuevo lead"
      icon={<Plus size={16} strokeWidth={2.4} />}
      variant="primary"
      formId="panel-nuevo-lead"
      title="Nuevo lead"
      description="Registra a la persona interesada. Revisamos si ya existe como lead o cliente antes de guardarla."
      submitLabel="Registrar lead"
      action={createLead}
      initial={{ message: null, done: false }}
      onDone={(state) => state.result?.code && router.push(`/crm/leads/${state.result.code}`)}
      footerExtra={duplicateButton("panel-nuevo-lead", true)}
      defaultOpen={defaultOpen}
    >
      {(state) => (
        <>
          <DuplicateNotice state={state} />
          <LeadFields catalogs={catalogs} advisors={advisors} autoFocus />
        </>
      )}
    </PanelAction>
  );
}

export function ConversationLeadAction({ conversation, catalogs, advisors, defaults }: { conversation: { code: string; lock_version: number }; catalogs: CrmCatalogs; advisors: Advisor[]; defaults: LeadDefaults }) {
  const router = useRouter();
  const formId = `conversation-lead-${conversation.code}`;

  return (
    <PanelAction<LeadActionState>
      label="Crear lead"
      icon={<Target size={15} />}
      size="sm"
      formId={formId}
      title="Crear lead desde la conversación"
      description="Toma los datos del contacto y deja el lead vinculado a esta conversación."
      submitLabel="Crear y vincular"
      action={createLeadFromConversation}
      initial={{ message: null, done: false }}
      onDone={() => router.refresh()}
      footerExtra={duplicateButton(formId)}
    >
      {(state) => (
        <>
          <input type="hidden" name="conversation" value={conversation.code} />
          <input type="hidden" name="lock_version" value={conversation.lock_version} />
          <DuplicateNotice state={state} />
          <LeadFields catalogs={catalogs} advisors={advisors} defaults={defaults} />
        </>
      )}
    </PanelAction>
  );
}
