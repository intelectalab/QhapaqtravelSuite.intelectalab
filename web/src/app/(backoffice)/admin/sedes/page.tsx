import type { Metadata } from "next";
import { NoAccess } from "@/components/shell/NoAccess";
import { PageHeader } from "@/components/shell/PageHeader";
import { SedeCreateAction, SedesGrid } from "@/features/users/SedeForms";
import { listSedes } from "@/lib/server/users";

export const metadata: Metadata = { title: "Sedes" };

export default async function SedesPage() {
  const data = await listSedes();
  if (!data) return <NoAccess home="/dashboard" />;
  const active = data.sedes.filter((sede) => sede.status === "activa").length;
  const full = data.limit !== null && active >= data.limit;

  return (
    <>
      <PageHeader
        title="Sedes"
        subtitle={data.limit === null ? `${active} sedes activas · tu plan no tiene límite` : `${active} de ${data.limit} ${data.limit === 1 ? "sede" : "sedes"} que permite tu plan`}
        actions={<SedeCreateAction managers={data.managers} disabledReason={full ? "Tu plan no permite más sedes activas." : undefined} />}
      />
      <SedesGrid sedes={data.sedes} managers={data.managers} />
      <p className="mt-4 text-[12.5px] text-fg-3">Las sedes con usuarios o reservas no se eliminan: se desactivan para conservar el historial.</p>
    </>
  );
}
