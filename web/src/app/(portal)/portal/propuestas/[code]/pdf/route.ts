import { proxyPdf } from "@/lib/server/download";

export async function GET(_request: Request, { params }: RouteContext<"/portal/propuestas/[code]/pdf">) {
  const { code } = await params;
  return proxyPdf(`/portal/client/quotes/${encodeURIComponent(code)}/pdf`);
}
