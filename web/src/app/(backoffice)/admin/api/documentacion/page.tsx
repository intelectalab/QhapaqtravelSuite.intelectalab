import type { Metadata } from "next";
import { ApiDocs } from "@/features/admin/ApiDocs";
import { getApiAccess } from "@/lib/server/adminSections";

export const metadata: Metadata = { title: "Documentación de la API" };

const PUBLIC_API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

export default async function ApiDocumentacionPage() {
  const data = await getApiAccess();
  if (!data) return null;
  return <ApiDocs openapiUrl={`${PUBLIC_API.replace(/\/$/, "")}/docs/openapi.json`} version={data.api_version} />;
}
