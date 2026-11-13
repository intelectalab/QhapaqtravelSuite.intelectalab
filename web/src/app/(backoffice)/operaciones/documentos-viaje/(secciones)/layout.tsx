import { Lock, UserRoundSearch } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { PageHeader } from "@/components/shell/PageHeader";
import { InfoTip } from "@/components/ui/InfoTip";
import { TabbedCard } from "@/components/ui/RouteTabs";
import { Notice } from "@/features/operations/OpsBits";
import { TravelDocTiles } from "@/features/operations/TravelDocSections";
import type { TravelDocList } from "@/lib/operations";
import { getCachedResource } from "@/lib/server/resource";

export default async function TravelDocsLayout({ children }: { children: ReactNode }) {
  const data = await getCachedResource<TravelDocList>("/ops/travel-docs", "No pudimos cargar los documentos de viaje.");

  if (!data) {
    return <PageHeader title="Documentos de viaje" subtitle="Tu rol no tiene acceso a esta sección." />;
  }

  const blocked = data.items.filter((row) => row.mapi && row.mapi.blocked && !row.mapi.used);

  return (
    <>
      <PageHeader
        title="Documentos de viaje"
        subtitle={data.can.manage ? "Pasaportes, seguros y permisos de cada pasajero antes de salir." : "El avance documental de tus reservas."}
        info={<InfoTip>Un documento que vence antes del regreso queda marcado. Las entradas nominativas se emiten con el checklist completo.</InfoTip>}
      />
      {!data.can.manage && (
        <Notice tone="info" icon={<UserRoundSearch size={16} />}>
          <b className="font-semibold">Ves solo tus reservas.</b> Puedes revisar el checklist y solicitar documentos al cliente; cargar, validar y observar los documentos corresponde a Operaciones.
        </Notice>
      )}
      {blocked.length > 0 && (
        <Notice tone="bad" icon={<Lock size={16} />} action={<Link href="/operaciones/documentos-viaje/entradas-mapi" className="text-[13px] font-semibold text-[var(--tint)] hover:underline">Ver bloqueos</Link>}>
          <b className="font-semibold">Emisión de entradas nominativas bloqueada en {blocked.length === 1 ? "1 reserva" : `${blocked.length} reservas`}:</b>{" "}
          {blocked.map((row, index) => (
            <span key={row.code}>
              {index > 0 && ", "}
              <Link href={`/operaciones/documentos-viaje/${encodeURIComponent(row.code)}`} className="font-mono hover:underline">
                {row.code}
              </Link>
            </span>
          ))}
          . No se emiten entradas a Machu Picchu sin el documento validado de cada pasajero.
        </Notice>
      )}
      <TravelDocTiles data={data} />
      <TabbedCard
        tabs={[
          { href: "/operaciones/documentos-viaje", label: "Por reserva", count: data.items.length },
          { href: "/operaciones/documentos-viaje/pasajeros", label: "Por pasajero", count: data.passengers.length },
          { href: "/operaciones/documentos-viaje/entradas-mapi", label: "Bloqueo de entradas MAPI", count: data.items.filter((row) => row.mapi !== null).length },
          { href: "/operaciones/documentos-viaje/reglas", label: "Reglas y recordatorios" },
        ]}
      >
        {children}
      </TabbedCard>
    </>
  );
}
