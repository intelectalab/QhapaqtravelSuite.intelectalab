"use client";

import { Check, MessageSquareReply } from "lucide-react";
import { useRouter } from "next/navigation";
import { markPaxFeedback, replyPaxFeedback } from "@/app/(backoffice)/reservas/actions";
import { Button } from "@/components/ui/Button";
import { PanelAction } from "@/components/ui/PanelAction";
import { TextArea } from "@/components/ui/TextArea";
import type { StepResult } from "@/lib/server/resource";

const initial: StepResult = { message: null, done: false };

export function FeedbackReplyActions({ feedback }: { feedback: { code: string; status: string; text: string; reply: string | null; passenger_name: string | null } }) {
  const router = useRouter();
  const excerpt = feedback.text.length > 90 ? `${feedback.text.slice(0, 90)}…` : feedback.text;
  return (
    <>
      {!feedback.reply && feedback.status !== "derivado" && (
        <PanelAction<StepResult>
          label="Responder"
          formId={`feedback-reply-${feedback.code}`}
          title="Responder al pasajero"
          description={`${feedback.passenger_name ?? "Pasajero"} · «${excerpt}»`}
          submitLabel="Enviar respuesta"
          action={replyPaxFeedback}
          initial={initial}
          onDone={() => router.refresh()}
          trigger={(open) => (
            <Button size="sm" variant="ghost" icon={<MessageSquareReply size={14} />} onClick={open} data-testid={`feedback-reply:${feedback.code}`}>
              Responder
            </Button>
          )}
        >
          {() => (
            <>
              <input type="hidden" name="code" value={feedback.code} />
              <TextArea label="Respuesta" name="text" rows={5} required minLength={5} maxLength={1000} hint="El pasajero la ve en su portal. Queda registrada en la trazabilidad." />
            </>
          )}
        </PanelAction>
      )}
      {feedback.status === "nuevo" && (
        <PanelAction<StepResult>
          label="Marcar leído"
          formId={`feedback-read-${feedback.code}`}
          title="Marcar como leído"
          description="El comentario deja de contar como pendiente en la reserva y en la bandeja del portal."
          submitLabel="Marcar leído"
          action={markPaxFeedback}
          initial={initial}
          onDone={() => router.refresh()}
          trigger={(open) => (
            <Button size="sm" variant="ghost" icon={<Check size={14} />} onClick={open} data-testid={`feedback-read:${feedback.code}`}>
              Marcar leído
            </Button>
          )}
        >
          {() => <input type="hidden" name="code" value={feedback.code} />}
        </PanelAction>
      )}
    </>
  );
}
