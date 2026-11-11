import type { Metadata } from "next";
import { ErrorsTable } from "@/features/platform/OperationsBoard";
import { getOperations } from "@/lib/server/platformConsole";

export const metadata: Metadata = { title: "Errores de integración" };

export default async function ErroresPage() {
  const overview = await getOperations();

  return <ErrorsTable errors={overview.errors} />;
}
