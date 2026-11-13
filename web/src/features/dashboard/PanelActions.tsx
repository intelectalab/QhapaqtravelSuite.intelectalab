"use client";

import { Check, Hand } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { completeActivity, type ActivityState } from "@/app/(backoffice)/crm/actividades/actions";
import { takeLead } from "@/app/(backoffice)/crm/leads/actions";
import { Button } from "@/components/ui/Button";
import { PanelAction } from "@/components/ui/PanelAction";
import { TextArea } from "@/components/ui/TextArea";
import { ApprovalDetailAction } from "@/features/approvals/ApprovalForms";
import type { ApprovalItem } from "@/lib/approvals";

export function TakeLeadButton({ code }: { code: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="flex flex-col items-end gap-0.5">
      <Button
        size="sm"
        variant="secondary"
        icon={<Hand size={14} />}
        disabled={pending}
        data-testid={`panel-take:${code}`}
        onClick={() =>
          start(async () => {
            const result = await takeLead(code);
            setError(result.done ? null : result.message);
            router.refresh();
          })
        }
      >
        {pending ? "Un momento…" : "Tomar"}
      </Button>
      {error && <span className="max-w-[180px] text-right text-[11.5px] text-bad">{error}</span>}
    </span>
  );
}

const initial: ActivityState = { message: null, done: false };

export function CompleteActivityAction({ code, subject }: { code: string; subject: string }) {
  const router = useRouter();
  return (
    <PanelAction<ActivityState>
      label="Hecha"
      formId={`panel-complete-${code}`}
      title="Completar actividad"
      description={subject}
      submitLabel="Completar"
      action={completeActivity}
      initial={initial}
      onDone={() => router.refresh()}
      trigger={(open) => (
        <Button size="sm" variant="secondary" icon={<Check size={14} />} onClick={open} data-testid={`panel-complete:${code}`}>
          Hecha
        </Button>
      )}
    >
      {() => (
        <>
          <input type="hidden" name="code" value={code} />
          <TextArea label="Resultado" name="result" rows={3} required minLength={3} maxLength={2000} placeholder="Qué se habló o qué se hizo." />
        </>
      )}
    </PanelAction>
  );
}

export function ApproveQuoteAction({ item }: { item: ApprovalItem }) {
  return (
    <ApprovalDetailAction
      item={item}
      trigger={(open) => (
        <Button size="sm" variant="primary" icon={<Check size={14} />} onClick={open} data-testid={`panel-approve:${item.target}`}>
          Aprobar
        </Button>
      )}
    />
  );
}
