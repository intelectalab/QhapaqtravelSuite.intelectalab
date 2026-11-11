"use client";

import { Copy, UserRoundCog } from "lucide-react";
import { useRouter } from "next/navigation";
import { duplicateQuote, reassignQuote, type QuoteDuplicateState, type QuoteStepState } from "@/app/(backoffice)/cotizaciones/actions";
import { Button } from "@/components/ui/Button";
import { PanelAction } from "@/components/ui/PanelAction";
import { SelectField } from "@/components/ui/SelectField";
import { TextArea } from "@/components/ui/TextArea";
import type { Advisor } from "@/lib/leads";
import type { QuoteDetail } from "@/lib/quotes";

const DUPLICATE_INITIAL: QuoteDuplicateState = { message: null, done: false };
const REASSIGN_INITIAL: QuoteStepState = { message: null, done: false };

export function QuoteDuplicateAction({ quote }: { quote: Pick<QuoteDetail, "code" | "title" | "version"> }) {
  const router = useRouter();
  return (
    <PanelAction<QuoteDuplicateState>
      label="Duplicar"
      icon={<Copy size={16} />}
      formId={`quote-duplicate-${quote.code}`}
      title="Duplicar cotización"
      description={`Se crea una cotización nueva en borrador a tu nombre, con los ítems de la versión ${quote.version} y la vigencia renovada. La original no cambia.`}
      submitLabel="Duplicar"
      action={duplicateQuote}
      initial={DUPLICATE_INITIAL}
      trigger={(open) => <Button iconOnly icon={<Copy size={16} />} label="Duplicar" onClick={open} data-testid="action:duplicate" className="transition-transform duration-300 hover:-translate-y-0.5" />}
      onDone={(state) => state.code && router.push(`/cotizaciones/${state.code}`)}
    >
      {() => (
        <>
          <input type="hidden" name="code" value={quote.code} />
          <TextArea label="Nota (opcional)" name="note" rows={2} maxLength={300} placeholder="Por ejemplo: misma ruta para otro grupo." />
        </>
      )}
    </PanelAction>
  );
}

export function QuoteReassignAction({ quote, advisors }: { quote: Pick<QuoteDetail, "code" | "owner" | "owner_id" | "lock_version">; advisors: Advisor[] }) {
  const router = useRouter();
  const choices = advisors.filter((advisor) => advisor.id !== quote.owner_id).map((advisor) => ({ value: advisor.id, label: advisor.name }));
  return (
    <PanelAction<QuoteStepState>
      label="Reasignar"
      icon={<UserRoundCog size={16} />}
      formId={`quote-reassign-${quote.code}`}
      title="Reasignar cotización"
      description={`Hoy la atiende ${quote.owner.name}. El nuevo asesor la verá en su cartera y podrá seguir su ciclo.`}
      submitLabel="Reasignar"
      action={reassignQuote}
      initial={REASSIGN_INITIAL}
      trigger={(open) => <Button iconOnly icon={<UserRoundCog size={16} />} label="Reasignar" onClick={open} data-testid="quote-reassign" className="transition-transform duration-300 hover:-translate-y-0.5" />}
      onDone={() => router.refresh()}
    >
      {() => (
        <>
          <input type="hidden" name="code" value={quote.code} />
          <input type="hidden" name="lock_version" value={quote.lock_version} />
          <SelectField label="Nuevo asesor" name="owner_id" options={choices} placeholder="Elegir" />
          <TextArea label="Motivo (opcional)" name="note" rows={2} maxLength={300} placeholder="Por ejemplo: vacaciones del asesor." />
        </>
      )}
    </PanelAction>
  );
}
