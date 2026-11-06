import { AlarmClock, BookOpen, CalendarRange, Hourglass, MapPin, ShieldCheck, Tags, Timer } from "lucide-react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card } from "@/components/ui/Card";
import { BarChart } from "@/components/ui/Charts";
import { InfoTip } from "@/components/ui/InfoTip";
import { TintCardTitle, TintTile } from "@/components/ui/Tinted";
import { ClaimFormAction } from "@/features/claims/ClaimForms";
import { ClaimsTable } from "@/features/claims/ClaimsTable";
import type { ClaimsOverview } from "@/lib/claims";
import { getResource } from "@/lib/server/resource";

export const metadata: Metadata = { title: "Libro de reclamaciones" };

export default async function ReclamacionesPage() {
  const overview = await getResource<ClaimsOverview>("/crm/claims", "No pudimos cargar el libro de reclamaciones.");

  if (!overview) {
    return <PageHeader title="Libro de reclamaciones" subtitle="Tu rol no tiene acceso a esta sección." />;
  }

  const { kpis, settings } = overview;

  return (
    <>
      <PageHeader
        title="Libro de reclamaciones"
        subtitle={`Hojas de reclamación y queja con plazo de respuesta de ${settings.response_days} días hábiles.`}
        info={<InfoTip>Cada hoja lleva un correlativo por sede y se conserva {settings.retention_years} años. Las alertas se activan {settings.alert_days} días hábiles antes del vencimiento. Valida los plazos vigentes con asesoría legal.</InfoTip>}
        actions={overview.can.manage ? <ClaimFormAction overview={overview} /> : undefined}
      />
      <section className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <TintTile icon={CalendarRange} tone="t1" label="Este mes" value={kpis.month} />
        <TintTile icon={BookOpen} tone="info" label="Sin respuesta" value={kpis.open} />
        <TintTile icon={Hourglass} tone="warn" label="Por vencer" value={kpis.due_soon} note={`${settings.alert_days} días hábiles o menos`} />
        <TintTile icon={AlarmClock} tone="bad" label="Vencidas" value={kpis.overdue} note="Fuera del plazo legal" />
        <TintTile icon={Timer} tone="ok" label="Tiempo de respuesta" value={kpis.avg_days !== null ? `${kpis.avg_days} días` : "Sin datos"} note={kpis.on_time_pct !== null ? `${kpis.on_time_pct} % a tiempo` : undefined} />
      </section>
      <section className="mb-5 grid gap-4 lg:grid-cols-2">
        <Card>
          <TintCardTitle icon={Tags} title="Por tipo" tone="violet" />
          <BarChart data={overview.by_type.map((item) => ({ label: item.label, value: item.count, caption: String(item.count), detail: `${item.count} ${item.count === 1 ? "hoja" : "hojas"}` }))} height={100} />
        </Card>
        <Card>
          <TintCardTitle icon={MapPin} title="Por sede" tone="t3" />
          <BarChart data={overview.by_sede.map((item) => ({ label: item.label.split(" — ")[0], value: item.count, caption: String(item.count), detail: `${item.label}: ${item.count}` }))} height={100} />
        </Card>
      </section>
      <Card>
        <TintCardTitle icon={ShieldCheck} title="Hojas registradas" aside={`${overview.claims.length} en el libro`} />
        <ClaimsTable overview={overview} />
      </Card>
    </>
  );
}
