import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/PageHeader";
import { InfoTip } from "@/components/ui/InfoTip";
import { PreviewPicker } from "@/features/channels/ChannelUi";
import { OperatorPhone, OperatorSide } from "@/features/mobile/OperatorApp";
import type { OperatorPreview } from "@/lib/mobile";
import { getResource } from "@/lib/server/resource";

export const metadata: Metadata = { title: "App operador" };

export default async function OperatorAppPage({ searchParams }: PageProps<"/mobile/operador">) {
  const { fecha, persona } = await searchParams;
  const query = new URLSearchParams();
  if (typeof fecha === "string") query.set("date", fecha);
  if (typeof persona === "string") query.set("staff", persona);
  const preview = await getResource<OperatorPreview>(`/mobile/operator${query.size ? `?${query.toString()}` : ""}`, "No pudimos cargar la app del operador.");

  if (!preview) {
    return <PageHeader title="App operador" subtitle="Tu rol no tiene acceso a esta sección." />;
  }

  return (
    <>
      <PageHeader
        title="App operador"
        subtitle="Lo que ven guías y conductores en su teléfono: los servicios del día, con pasajeros y punto de contacto."
        info={<InfoTip>La app funciona sin conexión y sincroniza confirmaciones, check-in y evidencias al recuperar señal. Esta vista usa los servicios y asignaciones reales.</InfoTip>}
        actions={<PreviewPicker label="Ver como" param="persona" value={preview.selected_staff?.code ?? ""} options={[{ value: "", label: "Todo el equipo" }, ...preview.staff.map((person) => ({ value: person.code, label: `${person.name} · ${person.role === "guia" ? "guía" : "conductor"}` }))]} />}
      />
      <div className="grid items-start gap-6 lg:grid-cols-[380px_minmax(0,1fr)]">
        <OperatorPhone preview={preview} />
        <OperatorSide preview={preview} />
      </div>
    </>
  );
}
