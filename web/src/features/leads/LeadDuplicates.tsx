"use client";

import { CopyX, Mail, Merge, Phone, UsersRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { markLeadDuplicate, mergeLead, type LeadActionState } from "@/app/(backoffice)/crm/leads/actions";
import { useCan } from "@/components/shell/SessionProvider";
import { StatusBadge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { PanelAction } from "@/components/ui/PanelAction";
import { TintCardTitle } from "@/components/ui/Tinted";
import type { LeadDetail, LeadMatch } from "@/lib/leads";

const initial: LeadActionState = { message: null, done: false };

const matchHref = (match: LeadMatch) => (match.type === "client" ? `/crm/clientes/${match.code}` : `/crm/leads/${match.code}`);

function MergeAction({ lead, match }: { lead: LeadDetail; match: LeadMatch }) {
  const router = useRouter();
  return (
    <PanelAction
      label="Fusionar aquí"
      icon={<Merge size={15} />}
      size="sm"
      formId={`fusionar-${match.code}`}
      title="Fusionar en este lead"
      description={`${match.name} (${match.code}) pasa a ser duplicado de ${lead.code}.`}
      submitLabel="Fusionar"
      action={mergeLead}
      initial={initial}
      onDone={() => router.refresh()}
    >
      {() => (
        <>
          <input type="hidden" name="code" value={lead.code} />
          <input type="hidden" name="source_lead_id" value={match.id} />
          <ul className="flex flex-col gap-2 rounded-xl bg-surface-2 p-3.5 text-[13px] text-fg-2">
            <li>Se conservan los datos de este lead y se completan los que estén vacíos con los de {match.code}.</li>
            <li>Sus actividades pasan a este lead y quedan marcadas como fusionadas.</li>
            <li>Se queda el puntaje más alto. La calificación BANT de este lead no cambia.</li>
          </ul>
          <p className="text-[12.5px] text-fg-3">La fusión no se deshace. Si te equivocas, puedes reabrir {match.code}, pero sus actividades se quedan aquí.</p>
        </>
      )}
    </PanelAction>
  );
}

function MarkAction({ lead, match }: { lead: LeadDetail; match: LeadMatch }) {
  const router = useRouter();
  return (
    <PanelAction
      label="Es duplicado"
      icon={<CopyX size={15} />}
      variant="ghost"
      size="sm"
      formId={`duplicado-${match.code}`}
      title="Marcar como duplicado"
      description={`${lead.name} queda como duplicado de ${match.name} (${match.code}) y sale de la cola comercial.`}
      submitLabel="Marcar como duplicado"
      action={markLeadDuplicate}
      initial={initial}
      onDone={() => router.refresh()}
    >
      {() => (
        <>
          <input type="hidden" name="code" value={lead.code} />
          <input type="hidden" name="lock_version" value={lead.lock_version} />
          <input type="hidden" name="duplicate_of_type" value={match.type} />
          <input type="hidden" name="duplicate_of_id" value={match.id} />
          <p className="text-[13.5px] text-fg-2">Úsalo cuando es la misma persona y no hace falta fusionar datos. Puedes reabrirlo después.</p>
        </>
      )}
    </PanelAction>
  );
}

export function LeadDuplicates({ lead, canAct }: { lead: LeadDetail; canAct: boolean }) {
  const canManage = useCan("crm.leads.manage") && canAct;
  if (lead.duplicates.length === 0) return null;

  return (
    <Card className="mb-5 border-warn/30">
      <TintCardTitle icon={UsersRound} title="Posibles duplicados" tone="warn" aside={<span className="text-[12.5px] text-fg-3">Coinciden por correo o teléfono</span>} />
      <ul className="flex flex-col">
        {lead.duplicates.map((match) => (
          <li key={`${match.type}-${match.code}`} className="flex flex-wrap items-center gap-3 border-t border-line-2 py-2.5 first:border-t-0">
            <span className="min-w-[200px] flex-1">
              <Link href={matchHref(match)} className="text-[13.5px] font-semibold hover:underline">
                {match.name}
              </Link>
              <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[12px] text-fg-3">
                {match.type === "client" ? "Cliente" : "Lead"} · {match.code}
                {match.by.includes("email") && (
                  <span className="inline-flex items-center gap-1">
                    <Mail size={12} />
                    mismo correo
                  </span>
                )}
                {match.by.includes("phone") && (
                  <span className="inline-flex items-center gap-1">
                    <Phone size={12} />
                    mismo teléfono
                  </span>
                )}
              </span>
            </span>
            {match.type === "lead" && <StatusBadge status={match.status} />}
            {canManage && (
              <span className="flex gap-1.5">
                <MarkAction lead={lead} match={match} />
                {match.mergeable && <MergeAction lead={lead} match={match} />}
              </span>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}
