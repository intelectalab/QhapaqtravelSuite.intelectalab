import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/PageHeader";
import { InfoTip } from "@/components/ui/InfoTip";
import { PreviewPicker } from "@/features/channels/ChannelUi";
import { CUSTOMER_PREVIEW_SECTIONS, CustomerPortalView } from "@/features/channels/CustomerPortal";
import type { CustomerPortalPreview } from "@/lib/channels";
import { getResource } from "@/lib/server/resource";

export const metadata: Metadata = { title: "Portal del cliente" };

export default async function CustomerPortalPage({ searchParams }: PageProps<"/canales/portal-cliente">) {
  const { cliente, seccion } = await searchParams;
  const code = typeof cliente === "string" ? cliente : "";
  const preview = await getResource<CustomerPortalPreview>(`/channels/customer-portal${code ? `?client=${encodeURIComponent(code)}` : ""}`, "No pudimos cargar el portal del cliente.");

  if (!preview) {
    return <PageHeader title="Portal del cliente" subtitle="Tu rol no tiene acceso a esta sección." />;
  }

  const section = CUSTOMER_PREVIEW_SECTIONS.find((item) => item.id === seccion && item.key !== null);
  const client = preview.client;
  const detail = section && section.key && client ? await getResource<{ items: unknown }>(`/channels/portal-preview/clients/${encodeURIComponent(client.code)}/${section.id}`, "No pudimos cargar esta sección del portal.") : null;
  const shown: CustomerPortalPreview = section && section.key && client && detail ? { ...preview, client: { ...client, [section.key]: detail.items } } : preview;

  return (
    <>
      <PageHeader
        title="Portal del cliente"
        subtitle="Lo que ve cada cliente al ingresar: sus viajes, propuestas, pagos y documentos."
        info={<InfoTip>Es una vista previa de solo lectura con los datos reales del cliente. El cliente solo ve lo suyo; las notas internas, los costos y los márgenes nunca se muestran.</InfoTip>}
        actions={<PreviewPicker label="Cliente" param="cliente" value={preview.client?.code} options={preview.clients.map((item) => ({ value: item.code, label: item.name }))} />}
      />
      <CustomerPortalView preview={shown} section={section?.id ?? "home"} />
    </>
  );
}
