export const REPORT_FREQUENCIES = [
  { value: "weekly", label: "Semanal (lunes)" },
  { value: "friday", label: "Semanal (viernes)" },
  { value: "daily", label: "Diaria" },
  { value: "monthly", label: "Mensual (día 1)" },
];

export function frequencyFromLabel(label: string): string {
  const lower = label.toLowerCase();
  if (lower.startsWith("diar")) return "daily";
  if (lower.startsWith("mens")) return "monthly";
  return lower.includes("viernes") ? "friday" : "weekly";
}
