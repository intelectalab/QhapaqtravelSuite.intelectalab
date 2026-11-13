"use client";

import { Crown, Percent, Plus, Trash2, Users } from "lucide-react";
import { saveSalesTeam, saveTargetPolicy } from "@/app/(backoffice)/crm/metas/actions";
import { RowActions, RowIcon } from "@/components/table/RowActions";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PanelAction } from "@/components/ui/PanelAction";
import { SelectField } from "@/components/ui/SelectField";
import { TextField } from "@/components/ui/TextField";
import { TintCardTitle } from "@/components/ui/Tinted";
import { CheckChips, FieldLabel } from "@/features/admin/AdminParts";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/format";
import type { StepResult } from "@/lib/server/resource";
import type { SalesTeam, SalesTeamsOverview } from "@/lib/targets";
import { avatarTone, toneStyle } from "@/lib/tone";

const initial: StepResult = { message: null, done: false };

const snapshot = (teams: SalesTeam[]) => JSON.stringify(teams.map((team) => ({ code: team.code, name: team.name, leader_id: team.leader?.id ?? null, members: team.members.map((member) => member.id) })));

function TeamFormAction({ overview, team }: { overview: SalesTeamsOverview; team?: SalesTeam }) {
  return (
    <PanelAction<StepResult>
      label={team ? "Editar" : "Nuevo equipo"}
      icon={<Plus size={16} strokeWidth={2.4} />}
      variant={team ? "secondary" : "primary"}
      formId={team ? `team-${team.code}` : "team-new"}
      title={team ? `Editar ${team.name}` : "Nuevo equipo comercial"}
      description="Un asesor pertenece a un solo equipo a la vez. Los cambios rigen desde hoy; el historial de metas anteriores no cambia."
      submitLabel={team ? "Guardar equipo" : "Crear equipo"}
      action={saveSalesTeam}
      initial={initial}
      trigger={team ? (open) => <RowIcon tone="edit" label={`Editar ${team.name}`} onClick={open} /> : undefined}
    >
      {() => (
        <>
          <input type="hidden" name="current" value={snapshot(overview.teams)} />
          {team && <input type="hidden" name="code" value={team.code} />}
          <TextField label="Nombre" name="name" required minLength={3} maxLength={120} defaultValue={team?.name} placeholder="Ej.: Cuentas corporativas" />
          <SelectField label="Líder" name="leader_id" options={overview.advisors} defaultValue={team?.leader?.id ?? ""} placeholder="Sin líder" clearable searchable />
          <div>
            <FieldLabel hint="Si eliges a alguien de otro equipo, pasa a este desde hoy.">Integrantes</FieldLabel>
            <CheckChips name="members" options={overview.advisors} defaultValues={team?.members.map((member) => member.id) ?? []} />
          </div>
        </>
      )}
    </PanelAction>
  );
}

function TeamDeleteAction({ overview, team }: { overview: SalesTeamsOverview; team: SalesTeam }) {
  if (team.targets > 0) return <RowIcon tone="delete" label="Quitar" disabledHint={`Tiene ${team.targets} metas: anúlalas antes de quitarlo`} />;
  return (
    <PanelAction<StepResult>
      label="Quitar"
      formId={`team-del-${team.code}`}
      title={`Quitar ${team.name}`}
      description="Sus integrantes quedan sin equipo. No afecta reservas ni metas individuales."
      submitLabel="Quitar equipo"
      action={saveSalesTeam}
      initial={initial}
      trigger={(open) => <RowIcon tone="delete" label={`Quitar ${team.name}`} icon={<Trash2 size={15} />} onClick={open} />}
    >
      {() => (
        <>
          <input type="hidden" name="current" value={snapshot(overview.teams)} />
          <input type="hidden" name="code" value={team.code} />
          <input type="hidden" name="mode" value="delete" />
        </>
      )}
    </PanelAction>
  );
}

export function SalesTeamsBoard({ overview }: { overview: SalesTeamsOverview }) {
  return (
    <Card>
      <TintCardTitle icon={Users} title="Equipos comerciales" aside={overview.can.manage ? <TeamFormAction overview={overview} /> : undefined} />
      {overview.teams.length === 0 ? (
        <EmptyState icon={<Users size={20} />} title="Sin equipos" description="Agrupa a los asesores para fijar metas de equipo y ver su avance conjunto." />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {overview.teams.map((team, index) => (
            <article key={team.code} style={{ ...toneStyle(avatarTone(team.code)), animationDelay: `${index * 60}ms` }} className="lift group animate-[rise-in_420ms_cubic-bezier(0.22,1,0.36,1)_backwards] rounded-tile border border-[color-mix(in_srgb,var(--tint)_22%,transparent)] bg-[color-mix(in_srgb,var(--tint)_5%,var(--surface))] p-4">
              <div className="flex items-start justify-between gap-3">
                <span className="min-w-0">
                  <b className="block truncate text-[14px] font-semibold">{team.name}</b>
                  <span className="text-[12px] text-fg-3">{team.code} · {team.members.length} integrantes · {team.targets} metas</span>
                </span>
                {overview.can.manage && (
                  <RowActions>
                    <TeamFormAction overview={overview} team={team} />
                    <TeamDeleteAction overview={overview} team={team} />
                  </RowActions>
                )}
              </div>
              {team.leader && (
                <p className="mt-2 flex items-center gap-1.5 text-[12.5px] text-fg-2">
                  <Crown size={13} className="text-[var(--tint)]" /> {team.leader.name}
                </p>
              )}
              <ul className="mt-3 flex flex-wrap gap-1.5">
                {team.members.length === 0 && <li className="text-[12.5px] text-fg-3">Sin integrantes</li>}
                {team.members.map((member) => (
                  <li key={member.id} title={`Desde ${formatDate(member.since)}`} className="rounded-full bg-surface px-2.5 py-1 text-[12px] shadow-[0_0_0_1px_var(--line)] transition-transform duration-200 hover:-translate-y-0.5">
                    {member.name}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      )}
    </Card>
  );
}

function PolicyAction({ overview }: { overview: SalesTeamsOverview }) {
  const tiers = [...overview.policy.tiers, ...Array.from({ length: Math.max(0, 5 - overview.policy.tiers.length) }, () => null)];
  return (
    <PanelAction<StepResult>
      label="Editar política"
      formId="target-policy"
      title="Política de bonos por cumplimiento"
      description="Cada tramo indica desde qué cumplimiento se paga y qué parte del bono base se paga. Deja vacíos los tramos que no uses."
      submitLabel="Guardar política"
      action={saveTargetPolicy}
      initial={initial}
    >
      {() => (
        <>
          {tiers.map((tier, index) => (
            <div key={index} className="grid grid-cols-2 gap-3">
              <TextField label={`Tramo ${index + 1}: desde (% de la meta)`} name={`min_${index + 1}`} type="number" min={1} max={200} defaultValue={tier?.min} />
              <TextField label="Paga (% del bono)" name={`pay_${index + 1}`} type="number" min={0} max={200} defaultValue={tier?.pay} />
            </div>
          ))}
          <TextField label="Reducir una meta vigente solo hasta el (% del período)" name="lock_decrease_after_pct" type="number" min={0} max={100} defaultValue={overview.policy.lock_decrease_after_pct} hint="Después, solo la administración puede reducirla." />
          <TextField label="Ventana de atribución (días)" name="attribution_window_days" type="number" min={1} max={90} defaultValue={overview.policy.attribution_window_days} />
        </>
      )}
    </PanelAction>
  );
}

export function TargetPolicyCard({ overview }: { overview: SalesTeamsOverview }) {
  const { policy } = overview;
  const top = Math.max(...policy.tiers.map((tier) => tier.pay), 100);
  return (
    <Card>
      <TintCardTitle icon={Percent} title="Política de bonos" tone="sun" aside={overview.can.policy ? <PolicyAction overview={overview} /> : undefined} />
      <ul className="flex flex-col gap-2.5">
        {policy.tiers.map((tier, index) => (
          <li key={tier.min} style={{ animationDelay: `${index * 50}ms` }} className="group animate-[rise-in_420ms_cubic-bezier(0.22,1,0.36,1)_backwards]">
            <span className="mb-1 flex items-center justify-between text-[12.5px]">
              <span>Desde {tier.min} % de la meta</span>
              <b className="font-mono">paga {tier.pay} %</b>
            </span>
            <span className="block h-2 overflow-hidden rounded-full bg-surface-2">
              <span className={cn("block h-full origin-left rounded-full bg-[var(--sun)] transition-[filter] group-hover:brightness-110 motion-safe:animate-[fill-x_700ms_cubic-bezier(0.4,0,0.2,1)_backwards]")} style={{ width: `${(tier.pay / top) * 100}%` }} />
            </span>
          </li>
        ))}
      </ul>
      <dl className="mt-4 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1.5 border-t border-line pt-3 text-[12.5px]">
        <dt className="text-fg-3">Reducir metas vigentes</dt>
        <dd>Hasta el {policy.lock_decrease_after_pct} % del período</dd>
        <dt className="text-fg-3">Atribución</dt>
        <dd>{policy.attribution_window_days} días</dd>
      </dl>
      {!overview.can.policy && <p className="mt-3 text-[12px] text-fg-3">Solo la administración de la agencia cambia la política de bonos.</p>}
    </Card>
  );
}
