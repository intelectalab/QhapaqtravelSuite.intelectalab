"use client";

import { ClipboardCheck, Send } from "lucide-react";
import type { ReactNode } from "react";
import { RowIcon } from "@/components/table/RowActions";
import { Badge } from "@/components/ui/Badge";
import { TintCardTitle } from "@/components/ui/Tinted";
import { EmptyLine, RISE, rise } from "@/features/portal/PortalUi";
import { cn } from "@/lib/cn";
import type { CorporateApproval, CorporateTraveler, CostCenter, PortalUser } from "@/lib/corporate";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import type { StepResult } from "@/lib/server/resource";
import type { Tone } from "@/lib/tone";
import { CorporateStep, TravelerFields } from "./CorporateForms";
import { PortalUsersTable, TravelersTable, type TeamActions } from "./CorporateTeamView";

const STATUS_TONE: Record<CorporateApproval["status"], Tone> = { pendiente: "warn", aprobada: "ok", rechazada: "bad", vencida: "mute", cancelada: "mute" };

export function AccountApprovals({ approvals }: { approvals: CorporateApproval[] }) {
  return (
    <div>
      <TintCardTitle icon={ClipboardCheck} title="Solicitudes de aprobación" aside={approvals.length} />
      {approvals.length === 0 ? (
        <EmptyLine>Aún no hay solicitudes. Se piden desde la cotización con «Pedir aprobación a la empresa».</EmptyLine>
      ) : (
        <ul className="flex flex-col gap-2">
          {approvals.slice(0, 12).map((row, index) => (
            <li key={row.code} style={rise(index)} className={cn("lift grid gap-2 rounded-tile border border-line px-3.5 py-2.5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center", RISE)}>
              <span className="min-w-0">
                <b className="block truncate text-[13.5px] font-semibold">{row.title}</b>
                <span className="block text-[12px] text-fg-3">
                  <span className="font-mono">
                    {row.code} · {row.reference}
                  </span>{" "}
                  · {row.cost_center?.code ?? "—"} · {formatDateTime(row.requested_at)}
                  {row.status === "pendiente" ? ` · vence ${formatDate(row.expires_at)}` : row.approver ? ` · ${row.approver}` : ""}
                </span>
                {row.reason && <span className="block text-[12px] text-fg-2">{row.reason}</span>}
              </span>
              <span className="flex items-center gap-2 sm:justify-end">
                <b className="font-mono text-[13px]">{formatMoney(row.amount, row.currency)}</b>
                <Badge tone={STATUS_TONE[row.status]}>{row.status_label}</Badge>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function AccountTravelers({ travelers, centers, actions, importAction }: { travelers: CorporateTraveler[]; centers: CostCenter[]; actions: TeamActions; importAction: ReactNode }) {
  return (
    <TravelersTable
      travelers={travelers}
      centers={centers}
      actions={actions}
      toolbarExtra={importAction}
      editAction={(row) => (
        <CorporateStep id={`viajero-${row.id}`} label="Editar" title={`Editar a ${row.full_name}`} submitLabel="Guardar" action={actions.saveTraveler} trigger={(open) => <RowIcon tone="edit" label="Editar" onClick={open} />}>
          <TravelerFields traveler={row} centers={centers} />
        </CorporateStep>
      )}
    />
  );
}

export function AccountUsers({ users, centers, travelers, actions, resend }: { users: PortalUser[]; centers: CostCenter[]; travelers: CorporateTraveler[]; actions: TeamActions; resend: (state: StepResult, form: FormData) => Promise<StepResult> }) {
  return (
    <PortalUsersTable
      users={users}
      centers={centers}
      travelers={travelers}
      actions={actions}
      extraActions={(row) =>
        row.status === "invitado" ? (
          <CorporateStep id={`reenviar-${row.id}`} label="Reenviar invitación" title="Reenviar invitación" description={`Le llega a ${row.email} un enlace nuevo para crear su contraseña. El anterior deja de funcionar.`} submitLabel="Reenviar" action={resend} trigger={(open) => <RowIcon tone="neutral" label="Reenviar invitación" icon={<Send size={15} />} onClick={open} />}>
            <input type="hidden" name="id" value={row.id} />
          </CorporateStep>
        ) : null
      }
    />
  );
}
