import { ArrowRight, CalendarDays, Check, CircleSlash, Mail, MapPin, MessageSquareText, Phone, Route, Target, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/shell/PageHeader";
import { StatusBadge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { FieldList } from "@/components/ui/Details";
import { HeroBand, HeroChip, HeroPanel, Journey, SOFT_TINT, TintCardTitle, TintTile, ToneScope } from "@/components/ui/Tinted";
import { cn } from "@/lib/cn";
import { formatDate, formatDateTime, formatMoney, initials, shortName } from "@/lib/format";
import type { LeadDetail } from "@/lib/leads";
import { LeadActions } from "@/features/leads/LeadActions";
import { getAdvisors, getCatalogs, getLead } from "@/lib/server/leads";
import { currentUser } from "@/lib/server/me";
import { statusLabel, statusTone } from "@/lib/tone";

export async function generateMetadata({ params }: PageProps<"/crm/leads/[code]">): Promise<Metadata> {
  const { code } = await params;
  return { title: (await getLead(code)).name };
}

function journey(lead: LeadDetail) {
  const order = ["nuevo", "contactado", "calificado", "convertido"];
  const reached = order.indexOf(lead.status);
  return [
    { label: "Recibido", at: lead.validated_at ?? lead.created_at, done: true },
    { label: "Asignado", at: lead.assigned_at, done: lead.assigned_at !== null },
    { label: "Contactado", at: lead.first_contact_at, done: reached >= 1 },
    { label: "Calificado", at: lead.bant?.qualified_at ?? null, done: reached >= 2 },
    { label: "Convertido", at: lead.converted?.at ?? null, done: reached >= 3 },
  ];
}

export default async function LeadPage({ params, searchParams }: PageProps<"/crm/leads/[code]">) {
  const { code } = await params;
  const { editar } = await searchParams;
  const [lead, catalogs, me, advisors] = await Promise.all([getLead(code), getCatalogs(), currentUser(), getAdvisors()]);
  const closed = lead.status === "descartado" || lead.status === "duplicado";
  const steps = journey(lead);

  return (
    <ToneScope tone={closed ? "mute" : statusTone(lead.status)}>
      <PageHeader
        back={{ href: "/crm/leads", label: "Leads" }}
        jump={false}
        leading={<span className="grid h-14 w-14 place-items-center rounded-2xl bg-[var(--tint)] text-lg font-bold text-white shadow-[0_10px_24px_-12px_var(--tint)]">{initials(lead.name)}</span>}
        title={lead.name}
        info={
          <span className="ml-2 flex-none">
            <StatusBadge status={lead.status} />
          </span>
        }
        subtitle={[lead.code, lead.company].filter(Boolean).join(" · ")}
        actions={catalogs ? <LeadActions lead={lead} catalogs={catalogs} viewerId={me.id} advisors={advisors} editOpen={editar === "1"} /> : undefined}
      />

      <HeroBand>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
          <div>
            <p className="text-[13px] font-medium text-white/70">Interés</p>
            <p className="mt-1 text-[32px] font-bold leading-tight tracking-[-0.03em]">
              {lead.interest}
              {lead.destination ? ` · ${lead.destination}` : ""}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {lead.travel_date && <HeroChip icon={<CalendarDays size={14} />}>Viaja el {formatDate(lead.travel_date)}</HeroChip>}
              {lead.pax > 0 && <HeroChip icon={<Users size={14} />}>{lead.pax} {lead.pax === 1 ? "pasajero" : "pasajeros"}</HeroChip>}
              <HeroChip icon={<Route size={14} />}>
                {lead.source} · {lead.channel}
              </HeroChip>
            </div>
          </div>
          <HeroPanel solid>
            <p className="mb-3.5 text-[13.5px] font-semibold text-fg">{closed ? statusLabel(lead.status) : "Recorrido del lead"}</p>
            {closed ? (
              <p className="flex items-start gap-2 text-[13.5px] text-fg-2">
                <CircleSlash size={16} className="mt-0.5 flex-none" />
                {lead.status === "duplicado" && lead.duplicate_of ? `Ya existe como cliente: ${lead.duplicate_of.name} (${lead.duplicate_of.code}).` : lead.discard_detail ?? "Se descartó."}
              </p>
            ) : (
              <Journey steps={steps} formatAt={(iso) => formatDateTime(iso, false)} />
            )}
          </HeroPanel>
        </div>
      </HeroBand>

      <section className="mb-5 grid grid-cols-2 gap-3">
        <TintTile icon={Target} tone={lead.score >= 70 ? "ok" : lead.score >= 40 ? "sun" : "mute"} label={lead.bant ? "Puntaje BANT" : "Puntaje"} value={`${lead.score} / 100`} note={lead.bant ? `Pr ${lead.bant.budget} · De ${lead.bant.authority} · Ne ${lead.bant.need} · Pl ${lead.bant.timeline}` : lead.score >= 70 ? "Muy probable" : lead.score >= 40 ? "Interés medio" : "Interés bajo"} />
        <TintTile icon={Users} tone="t1" label="Responsable" value={<span className="text-[16px]">{lead.owner ? shortName(lead.owner.name) : "Sin asignar"}</span>} note={lead.owner ? undefined : "En la cola comercial"} />
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <TintCardTitle icon={Phone} title="Contacto" />
          <FieldList
            fields={[
              { label: "Correo", value: lead.email ? <a href={`mailto:${lead.email}`} className="hover:underline">{lead.email}</a> : "—" },
              { label: "Teléfono", value: lead.phone ?? "—" },
              ...(lead.company ? [{ label: "Empresa", value: lead.company }] : []),
            ]}
          />
          <div className="mt-3 flex flex-wrap gap-2">
            {lead.email && (
              <a href={`mailto:${lead.email}`} className={cn("inline-flex items-center gap-1.5 rounded-[10px] px-3 py-2 text-[13px] font-semibold text-[var(--tint)]", SOFT_TINT)}>
                <Mail size={15} />
                Escribir
              </a>
            )}
          </div>
        </Card>

        <Card>
          {lead.converted ? (
            <>
              <TintCardTitle icon={Check} title="Se convirtió en" />
              <ul className="flex flex-col gap-2">
                <ResultRow href={`/crm/clientes/${lead.converted.client.code}`} label="Cliente" title={lead.converted.client.name} detail={lead.converted.client.code} />
                {lead.converted.opportunity && (
                  <ResultRow
                    href={`/crm/oportunidades/${lead.converted.opportunity.code}`}
                    label="Oportunidad"
                    title={lead.converted.opportunity.title}
                    detail={`${lead.converted.opportunity.code} · ${formatMoney(lead.converted.opportunity.amount, lead.converted.opportunity.currency)}`}
                  />
                )}
              </ul>
            </>
          ) : (
            <>
              <TintCardTitle icon={MessageSquareText} title="Notas" />
              <p className="whitespace-pre-line text-[13.5px] text-fg-2">{lead.notes ?? "Sin notas todavía."}</p>
              {lead.destination && (
                <p className="mt-3 flex items-center gap-2 text-[13px] text-fg-3">
                  <MapPin size={14} />
                  {lead.destination}
                </p>
              )}
            </>
          )}
        </Card>
      </div>
    </ToneScope>
  );
}

function ResultRow({ href, label, title, detail }: { href: string; label: string; title: string; detail: string }) {
  return (
    <li>
      <Link href={href} className={cn("flex items-center gap-3 rounded-[12px] px-3.5 py-3 transition hover:brightness-[0.98]", SOFT_TINT)}>
        <span className="min-w-0 flex-1">
          <span className="block text-[11.5px] font-semibold text-[var(--tint)]">{label}</span>
          <b className="block truncate text-[13.5px] font-semibold">{title}</b>
          <span className="block text-xs text-fg-3">{detail}</span>
        </span>
        <ArrowRight size={16} className="flex-none text-[var(--tint)]" />
      </Link>
    </li>
  );
}
