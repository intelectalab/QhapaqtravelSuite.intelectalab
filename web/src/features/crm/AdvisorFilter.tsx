"use client";

import { Select } from "@/components/ui/Select";
import { InfoTip } from "@/components/ui/InfoTip";
import { useAdvisorFilter } from "@/lib/useAdvisorFilter";

export function AdvisorFilter({ advisors, value, onChange }: { advisors: { id: string; name: string }[]; value: string; onChange: (advisor: string) => void }) {
  if (advisors.length < 2) return null;
  const options = [{ value: "", label: "Asesor: todos" }, ...[...advisors].sort((a, b) => a.name.localeCompare(b.name, "es")).map((advisor) => ({ value: advisor.id, label: advisor.name }))];

  return (
    <span className="inline-flex items-center gap-1.5">
      <Select variant="chip" value={advisors.some((advisor) => advisor.id === value) ? value : ""} onChange={onChange} options={options} ariaLabel="Filtrar por asesor" testId="filter:advisor" />
      <InfoTip label="Filtro compartido">El asesor que elijas se mantiene mientras dure tu sesión en Actividades y Postventa.</InfoTip>
    </span>
  );
}

export const advisorsOf = <T,>(rows: T[], owner: (row: T) => { id: string; name: string } | null | undefined) => [...new Map(rows.flatMap((row) => { const item = owner(row); return item ? [[item.id, item] as const] : []; })).values()];

export function SharedAdvisorFilter({ advisors }: { advisors: { id: string; name: string }[] }) {
  const [advisor, setAdvisor] = useAdvisorFilter();
  return <AdvisorFilter advisors={advisors} value={advisor} onChange={setAdvisor} />;
}

export function useAdvisorRows<T>(rows: T[], advisors: { id: string }[], owner: (row: T) => string | null | undefined): T[] {
  const [advisor] = useAdvisorFilter();
  if (!advisor || advisors.length < 2 || !advisors.some((item) => item.id === advisor)) return rows;
  return rows.filter((row) => owner(row) === advisor);
}
