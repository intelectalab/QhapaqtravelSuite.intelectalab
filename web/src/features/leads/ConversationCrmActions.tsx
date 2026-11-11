"use client";

import { createConversationActivity } from "@/app/(backoffice)/crm/actividades/actions";
import { useCan } from "@/components/shell/SessionProvider";
import { ActivityCreateAction } from "@/features/activities/ActivityForms";
import type { RelatedOptions } from "@/lib/activities";
import type { ConversationThread } from "@/lib/inbox";
import type { Advisor, CrmCatalogs } from "@/lib/leads";
import { ConversationLeadAction } from "./LeadCreateAction";

const LEAD_CHANNEL: Record<string, string> = { whatsapp: "whatsapp", email: "email" };

const LEAD_SOURCE: Record<string, string> = { whatsapp: "whatsapp", email: "email" };

function relationNote(thread: ConversationThread) {
  if (thread.card.lead) return `Queda ligada al lead ${thread.card.lead.name}.`;
  if (thread.card.client) return `Queda ligada al cliente ${thread.card.client.name}.`;
  return "Vincula un cliente o un lead para ligarla; si no, queda solo en la agenda.";
}

export function ConversationCrmActions({ thread, catalogs, advisors, activityOptions }: { thread: ConversationThread; catalogs: CrmCatalogs | null; advisors: Advisor[]; activityOptions: RelatedOptions | null }) {
  const canLead = useCan("crm.leads.manage");
  const canActivity = useCan("crm.activities.manage");
  const leadAction = !thread.card.lead && canLead && catalogs;
  const activityAction = canActivity && activityOptions;

  if (!leadAction && !activityAction) return null;

  return (
    <section className="px-4 pb-4">
      <p className="mb-1.5 text-[12px] font-semibold text-fg-3">Seguimiento comercial</p>
      <div className="flex flex-wrap gap-2">
        {leadAction && (
          <ConversationLeadAction
            conversation={{ code: thread.code, lock_version: thread.lock_version }}
            catalogs={catalogs}
            advisors={advisors}
            defaults={{ name: thread.contact.name, email: thread.contact.email, phone: thread.contact.phone, channel: LEAD_CHANNEL[thread.channel] ?? "web", source: LEAD_SOURCE[thread.channel] ?? "formulario_web" }}
          />
        )}
        {activityAction && (
          <ActivityCreateAction options={activityOptions} action={createConversationActivity} hidden={{ conversation: thread.code }} relationNote={relationNote(thread)} label="Crear actividad" size="sm" variant="secondary" />
        )}
      </div>
    </section>
  );
}
