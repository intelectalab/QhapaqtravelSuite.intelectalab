import { redirectToDocument } from "@/lib/server/download";

export async function GET(_request: Request, { params }: RouteContext<"/finanzas/facturacion/[number]/archivo/[id]">) {
  const { id } = await params;
  return redirectToDocument(`/documents/${encodeURIComponent(id)}/download`);
}
