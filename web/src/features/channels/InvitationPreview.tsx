"use client";

import { Eye, Mail, MessageCircle } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { SidePanel } from "@/components/ui/SidePanel";
import type { OwnReviewSettings, OwnReviewSettingsValues } from "@/lib/channels";
import { cn } from "@/lib/cn";

type Invite = OwnReviewSettingsValues["invite"];
type Sample = OwnReviewSettings["preview"];

function fill(text: string, sample: Sample): string {
  return text.replaceAll("{nombre}", sample.nombre).replaceAll("{tour}", sample.tour).replaceAll("{agencia}", sample.agencia).replaceAll("{enlace}", sample.enlace);
}

export function InvitationPreview({ invite, sample, className }: { invite: Invite; sample: Sample; className?: string }) {
  const whatsapp = invite.channel === "whatsapp";
  const body = invite.body.includes("{enlace}") ? fill(invite.body, sample) : `${fill(invite.body, sample)}\n\n${sample.enlace}`;
  const Icon = whatsapp ? MessageCircle : Mail;
  return (
    <figure className={cn("lift overflow-hidden rounded-tile border border-line bg-surface", className)}>
      <figcaption className="flex items-center justify-between gap-3 border-b border-line bg-surface-2 px-4 py-2.5 text-[12px] text-fg-3">
        <span className="flex items-center gap-1.5 font-semibold text-fg-2">
          <Icon size={14} /> {whatsapp ? "WhatsApp" : "Correo"} de {sample.agencia}
        </span>
        <span>{sample.reservation ? `Con los datos de ${sample.reservation}` : "Con datos de ejemplo"}</span>
      </figcaption>
      <div className="flex flex-col gap-2.5 px-4 py-3.5">
        {!whatsapp && (
          <p className="text-[13px]">
            <span className="text-fg-3">Asunto: </span>
            <b className="font-semibold">{fill(invite.subject, sample)}</b>
          </p>
        )}
        <p className={cn("whitespace-pre-wrap break-words text-[13px] leading-relaxed text-fg-2", whatsapp && "max-w-[85%] rounded-2xl rounded-tl-sm bg-[color-mix(in_srgb,var(--ok)_10%,var(--surface))] px-3.5 py-2.5")}>{body}</p>
        <p className="text-[11.5px] text-fg-3">El enlace de cada invitación es personal y vence a los {invite.expire_days} días{invite.reminder_days > 0 ? `; se recuerda a los ${invite.reminder_days} días si no responde` : ""}.</p>
      </div>
    </figure>
  );
}

export function InvitationPreviewButton({ invite, sample }: { invite: Invite; sample: Sample }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button icon={<Eye size={16} />} onClick={() => setOpen(true)}>
        Vista previa de la invitación
      </Button>
      <SidePanel open={open} onOpenChange={setOpen} title="Vista previa de la invitación" description="Así la recibe el viajero. El texto se edita en Ajustes.">
        <InvitationPreview invite={invite} sample={sample} />
      </SidePanel>
    </>
  );
}
