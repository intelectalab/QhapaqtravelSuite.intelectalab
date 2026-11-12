"use client";

import { ArrowRightLeft, CircleX, RotateCcw, TriangleAlert, Trophy, UserRoundCog } from "lucide-react";
import { useState } from "react";
import { changeStage, reassignOpportunity, type StageState } from "@/app/(backoffice)/crm/oportunidades/actions";
import { useCan } from "@/components/shell/SessionProvider";
import { ChoiceGroup } from "@/components/ui/ChoiceGroup";
import { PanelAction } from "@/components/ui/PanelAction";
import { SelectField } from "@/components/ui/SelectField";
import { SwitchField } from "@/components/ui/SwitchField";
import { TextArea } from "@/components/ui/TextArea";
import type { CatalogItem } from "@/lib/leads";
import { OPEN_STAGES, type OpportunityDetail, type OpportunityFormOptions } from "@/lib/opportunities";

const initial: StageState = { message: null, done: false };

function Code({ code, stage, version }: { code: string; stage?: string; version?: number }) {
  return (
    <>
      <input type="hidden" name="code" value={code} />
      {version !== undefined && <input type="hidden" name="lock_version" value={version} />}
      {stage && <input type="hidden" name="stage" value={stage} />}
    </>
  );
}

function ReopenFields({ opportunity }: { opportunity: OpportunityDetail }) {
  const [confirmed, setConfirmed] = useState(false);
  const target = opportunity.lost_at_stage && OPEN_STAGES.includes(opportunity.lost_at_stage as never) ? opportunity.lost_at_stage : "negociacion";
  const options = opportunity.stages.filter((stage) => OPEN_STAGES.includes(stage.code)).map((stage) => ({ value: stage.code, label: stage.name }));
  return (
    <>
      <Code code={opportunity.code} version={opportunity.lock_version} />
      <ChoiceGroup label="Volver a la etapa" name="stage" options={options} defaultValue={target} />
      <SwitchField label="Sí, quiero reabrirla" hint="Queda registrado en el historial." name="confirm_reopen" checked={confirmed} onCheckedChange={setConfirmed} />
    </>
  );
}

export function OpportunityActions({ opportunity, lostReasons }: { opportunity: OpportunityDetail; lostReasons: CatalogItem[] }) {
  const [warnings, setWarnings] = useState<string[]>([]);
  const closed = opportunity.stage === "ganada" || opportunity.stage === "perdida";
  const openOptions = opportunity.stages.filter((stage) => OPEN_STAGES.includes(stage.code)).map((stage) => ({ value: stage.code, label: stage.name }));
  const remember = (state: StageState) => setWarnings(state.warnings ?? []);

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap items-center justify-end gap-2">
        {closed ? (
          <>
            {opportunity.stage === "ganada" ? (
              <PanelAction label="Pasar a perdida" icon={<CircleX size={16} />} variant="ghost" title="Pasar a perdida" description="Para un cierre que al final no se concretó." submitLabel="Marcar como perdida" action={changeStage} initial={initial} onDone={remember}>
                {() => (
                  <>
                    <Code code={opportunity.code} version={opportunity.lock_version} stage="perdida" />
                    <input type="hidden" name="confirm_reopen" value="on" />
                    <SelectField label="Motivo" name="lost_reason" options={lostReasons.map((item) => ({ value: item.code, label: item.label }))} placeholder="Elegir" />
                    <TextArea label="Detalle" name="lost_detail" rows={3} hint="Obligatorio si eliges Otro." />
                  </>
                )}
              </PanelAction>
            ) : (
              <PanelAction label="Pasar a ganada" icon={<Trophy size={16} />} variant="ghost" title="Pasar a ganada" description="Se limpia el motivo de pérdida y la probabilidad pasa a 100 %." submitLabel="Marcar como ganada" action={changeStage} initial={initial} onDone={remember}>
                {() => (
                  <>
                    <Code code={opportunity.code} version={opportunity.lock_version} stage="ganada" />
                    <input type="hidden" name="confirm_reopen" value="on" />
                    <p className="text-[13.5px] text-fg-2">
                      Confirma que <b className="text-fg">{opportunity.client.name}</b> aceptó la propuesta.
                    </p>
                  </>
                )}
              </PanelAction>
            )}
            <PanelAction label="Reabrir" icon={<RotateCcw size={16} />} title="Reabrir oportunidad" description="Vuelve al embudo y se limpia el motivo de cierre." submitLabel="Reabrir" action={changeStage} initial={initial} onDone={remember}>
              {() => <ReopenFields opportunity={opportunity} />}
            </PanelAction>
          </>
        ) : (
          <>
            <PanelAction label="Mover" icon={<ArrowRightLeft size={16} />} title="Mover de etapa" description="La probabilidad se ajusta sola según la etapa." submitLabel="Mover" action={changeStage} initial={initial} onDone={remember}>
              {() => (
                <>
                  <Code code={opportunity.code} version={opportunity.lock_version} />
                  <ChoiceGroup label="Etapa" name="stage" options={openOptions} defaultValue={opportunity.stage} />
                </>
              )}
            </PanelAction>
            <PanelAction label="Perder" icon={<CircleX size={16} />} variant="ghost" title="Marcar como perdida" description="Saber por qué se pierde ayuda a vender mejor." submitLabel="Marcar como perdida" action={changeStage} initial={initial} onDone={remember}>
              {() => (
                <>
                  <Code code={opportunity.code} version={opportunity.lock_version} stage="perdida" />
                  <SelectField label="Motivo" name="lost_reason" options={lostReasons.map((item) => ({ value: item.code, label: item.label }))} placeholder="Elegir" />
                  <TextArea label="Detalle" name="lost_detail" rows={3} hint="Obligatorio si eliges Otro." />
                </>
              )}
            </PanelAction>
            <PanelAction label="Ganar" icon={<Trophy size={16} />} variant="primary" title="Marcar como ganada" description="La probabilidad pasa a 100 % y se registra la fecha de cierre." submitLabel="Marcar como ganada" action={changeStage} initial={initial} onDone={remember}>
              {() => (
                <>
                  <Code code={opportunity.code} version={opportunity.lock_version} stage="ganada" />
                  <p className="text-[13.5px] text-fg-2">
                    Confirma que <b className="text-fg">{opportunity.client.name}</b> aceptó la propuesta. La reserva se crea desde la cotización aprobada.
                  </p>
                </>
              )}
            </PanelAction>
          </>
        )}
      </div>
      {warnings.map((warning) => (
        <p key={warning} role="status" className="flex max-w-md items-start gap-2 rounded-xl bg-warn/10 px-3 py-2 text-[12.5px] text-warn">
          <TriangleAlert size={15} className="mt-0.5 flex-none" />
          {warning}
        </p>
      ))}
    </div>
  );
}

export function OpportunityReassignAction({ opportunity, advisors }: { opportunity: OpportunityDetail; advisors: OpportunityFormOptions["advisors"] }) {
  const canReassign = useCan("crm.records.reassign");
  const closed = opportunity.stage === "ganada" || opportunity.stage === "perdida";
  const choices = advisors.filter((advisor) => advisor.id !== opportunity.owner_id).map((advisor) => ({ value: advisor.id, label: advisor.name }));
  if (!canReassign || closed || choices.length === 0) return null;

  return (
    <PanelAction label="Reasignar" icon={<UserRoundCog size={16} />} title="Reasignar oportunidad" description={`Hoy la lleva ${opportunity.owner.name}. Sus cotizaciones y actividades no cambian de dueño.`} submitLabel="Reasignar" action={reassignOpportunity} initial={initial}>
      {() => (
        <>
          <Code code={opportunity.code} version={opportunity.lock_version} />
          <SelectField label="Nuevo responsable" name="owner_id" options={choices} placeholder="Elegir" searchable />
          <TextArea label="Nota (opcional)" name="note" rows={2} maxLength={300} placeholder="Por ejemplo: pasa a la cartera de corporativos." />
        </>
      )}
    </PanelAction>
  );
}
