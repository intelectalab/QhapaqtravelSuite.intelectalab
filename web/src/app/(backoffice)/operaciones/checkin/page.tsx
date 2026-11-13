import { CalendarDays, ScanLine, UsersRound, UserCheck } from "lucide-react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card } from "@/components/ui/Card";
import { InfoTip } from "@/components/ui/InfoTip";
import { TabbedCard } from "@/components/ui/RouteTabs";
import { TintCardTitle, TintTile } from "@/components/ui/Tinted";
import { DayServices, ManifestView, WaiverFormAction, WaiverList } from "@/features/growth-ops/Checkin";
import type { CheckinDay, Manifest, WaiverTemplates } from "@/lib/growth-ops";
import { formatDate } from "@/lib/format";
import { growthRead } from "@/lib/server/growth-ops";

export const metadata: Metadata = { title: "Check-in con QR" };

const BASE = "/operaciones/checkin";

export default async function CheckinPage({ searchParams }: { searchParams: Promise<{ servicio?: string; fecha?: string; tab?: string }> }) {
  const { servicio, fecha, tab } = await searchParams;
  const dayKey = fecha && /^\d{4}-\d{2}-\d{2}$/.test(fecha) ? fecha : "hoy";
  const [day, templates] = await Promise.all([
    growthRead<CheckinDay>(`/ops/checkin/manifest/${dayKey}`, "No pudimos cargar los servicios del día."),
    growthRead<WaiverTemplates>("/ops/waiver-templates", "No pudimos cargar los deslindes."),
  ]);

  if (!day.data || !templates.data) return <PageHeader title="Check-in con QR" subtitle={day.blocked ?? templates.blocked ?? "Tu rol no tiene acceso a esta sección."} />;

  const selected = servicio ?? day.data.services[0]?.code;
  const manifest = selected ? await growthRead<Manifest>(`/ops/checkin/manifest/${encodeURIComponent(selected)}`, "No pudimos cargar el manifiesto.") : null;
  const { totals } = day.data;
  const waivers = tab === "deslindes";

  return (
    <>
      <PageHeader
        title="Check-in con QR"
        subtitle={`Manifiesto en vivo y registro de ingreso · ${formatDate(day.data.date, "long")}`}
        info={<InfoTip>Cada pasajero recibe un pase QR por servicio en su portal. El pase se usa una sola vez, solo el día del servicio y lo escanea el guía o conductor asignado. Si hay un deslinde vigente, el ingreso exige la firma.</InfoTip>}
        actions={waivers ? <WaiverFormAction langs={templates.data.langs} /> : undefined}
      />
      <section className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <TintTile icon={CalendarDays} tone="info" label="Servicios del día" value={totals.services} info={<p>Tours, traslados y actividades del día con pasajeros confirmados. Guías y conductores ven solo los suyos.</p>} />
        <TintTile icon={UsersRound} tone="violet" label="Pasajeros con pase" value={totals.passengers} info={<p>Pases QR emitidos para los servicios del día, uno por pasajero y servicio.</p>} />
        <TintTile icon={UserCheck} tone="ok" label="Ingresaron" value={totals.checked_in} note={totals.passengers ? `${Math.round((totals.checked_in / totals.passengers) * 100)} % del día` : undefined} info={<p>Pases escaneados hoy: cada escaneo marca el pase como usado.</p>} />
        <TintTile icon={ScanLine} tone="sun" label="Deslindes vigentes" value={templates.data.templates.filter((item) => item.active).length} info={<p>Textos de deslinde activos. Con al menos uno vigente, el check-in pide la firma del pasajero.</p>} />
      </section>
      <TabbedCard tabs={[{ href: BASE, label: "Check-in del día" }, { href: `${BASE}?tab=deslindes`, label: "Deslindes", count: templates.data.templates.length }]} active={waivers ? `${BASE}?tab=deslindes` : BASE}>
        {waivers ? (
          <WaiverList data={templates.data} />
        ) : (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
            <Card>
              <TintCardTitle icon={CalendarDays} title="Servicios" aside={formatDate(day.data.date)} />
              <DayServices day={day.data} selected={selected} />
            </Card>
            <Card>{manifest?.data ? <ManifestView manifest={manifest.data} /> : <p className="py-10 text-center text-[13px] text-fg-3">{manifest?.blocked ?? "Elige un servicio para ver su manifiesto."}</p>}</Card>
          </div>
        )}
      </TabbedCard>
    </>
  );
}
