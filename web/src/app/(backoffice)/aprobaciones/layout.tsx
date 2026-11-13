import type { ReactNode } from "react";
import { PathSectionNav } from "@/components/ui/PathSectionNav";
import { SectionLayout } from "@/components/ui/SectionNav";
import { AlarmClock, CircleCheckBig, Clock, History, MessageSquareReply, Send, Settings2, User, UserCheck, Users } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/shell/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { InfoTip } from "@/components/ui/InfoTip";
import { TintTile } from "@/components/ui/Tinted";
import { NewApprovalAction } from "@/features/approvals/ApprovalsWorkspace";
import { APPROVAL_ROLE_NOTES, approvalHref, type ApprovalsOverview } from "@/lib/approvals";
import { getCachedResource } from "@/lib/server/resource";

export default async function AprobacionesLayout({ children }: { children: ReactNode }) {
  const overview = await getCachedResource<ApprovalsOverview>("/approvals", "No pudimos cargar la bandeja de aprobaciones.");

  if (!overview) {
    return <PageHeader title="Bandeja de aprobaciones" subtitle="Tu rol no tiene acceso a esta sección." />;
  }

  const { kpis } = overview;
  const scopeAll = overview.viewer?.scope === "all";
  const roleNote = APPROVAL_ROLE_NOTES[overview.viewer?.role ?? ""] ?? "";
  const waiting = overview.items.filter((item) => item.mine && item.status === "info" && item.can_answer);

  return (
    <>
      <PageHeader
        title="Bandeja de aprobaciones"
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            Excepciones de ventas, reservas, finanzas, agencias y proveedores en un solo lugar.
            <span title={roleNote} className="inline-flex">
              <Badge tone="info" dot={false}>
                {scopeAll ? <Users size={12} className="mr-1 inline" /> : <User size={12} className="mr-1 inline" />}
                {scopeAll ? "Todo el tenant" : "Según mi rol"}
              </Badge>
            </span>
          </span>
        }
        info={<InfoTip>Aprobar o rechazar aquí ejecuta el mismo efecto que en el módulo de origen. Quien pide una aprobación nunca la decide.{roleNote ? ` ${roleNote}` : ""}</InfoTip>}
        actions={overview.can.create ? <NewApprovalAction overview={overview} /> : undefined}
      />
      <section className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <TintTile icon={AlarmClock} tone="bad" label="Fuera de plazo" value={kpis.overdue} note="Plazo de respuesta vencido" info={<p>Solicitudes pendientes cuyo plazo de respuesta (SLA de la regla de aprobación) ya venció.</p>} />
        <TintTile icon={CircleCheckBig} tone="ok" label="Resueltas en 7 días" info={<p>Solicitudes aprobadas o rechazadas en los últimos 7 días; la nota es el tiempo promedio desde que se pidieron hasta que se decidieron.</p>} value={kpis.resolved_week} note={kpis.avg_hours !== null ? `${kpis.avg_hours} h en promedio` : "Sin decisiones recientes"} />
      </section>
      {waiting.length > 0 && (
        <p className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-warn/40 bg-[color-mix(in_srgb,var(--warn)_9%,var(--surface))] px-4 py-2.5 text-[13px]">
          <MessageSquareReply size={15} className="text-warn" />
          <b>Te preguntaron algo.</b> El plazo está en pausa hasta que respondas:
          {waiting.map((item) => (
            <Link key={item.key} href={approvalHref(item)} className="font-mono text-[12.5px] text-accent hover:underline">
              {item.code}
            </Link>
          ))}
        </p>
      )}
      <SectionLayout
        nav={
          <PathSectionNav
            label="Secciones de aprobaciones"
            testId="approvals-nav"
            groups={[
              {
                title: "Bandeja",
                items: [
                  { href: "/aprobaciones", label: "Para mí", count: kpis.for_me, icon: <UserCheck size={16} /> },
                  { href: "/aprobaciones/enviadas", label: "Enviadas por mí", count: overview.items.filter((item) => item.mine).length, icon: <Send size={16} /> },
                  { href: "/aprobaciones/pendientes", label: "Pendientes", count: overview.items.filter((item) => item.status === "pendiente" || item.status === "info").length, icon: <Clock size={16} /> },
                  { href: "/aprobaciones/historial", label: "Historial", icon: <History size={16} /> },
                  { href: "/aprobaciones/reglas", label: "Reglas", count: overview.rules.length, icon: <Settings2 size={16} /> },
                ],
              },
            ]}
          />
        }
      >
        {children}
      </SectionLayout>
    </>
  );
}
