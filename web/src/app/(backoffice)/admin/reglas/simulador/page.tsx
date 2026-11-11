import type { Metadata } from "next";
import { RuleSimulator } from "@/features/admin/RuleSimulator";
import type { SimulatorOptions } from "@/lib/admin";
import { getResource } from "@/lib/server/resource";

export const metadata: Metadata = { title: "Simulador de reglas" };

export default async function ReglasSimuladorPage() {
  const options = await getResource<SimulatorOptions>("/admin/booking-rules/simulator", "No pudimos cargar el simulador.");
  if (!options) return null;
  return <RuleSimulator options={options} />;
}
