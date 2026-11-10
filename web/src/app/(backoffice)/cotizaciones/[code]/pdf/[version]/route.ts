import { proxyPdf } from "@/lib/server/download";

export async function GET(_request: Request, { params }: RouteContext<"/cotizaciones/[code]/pdf/[version]">) {
  const { code, version } = await params;
  return proxyPdf(`/quotes/${encodeURIComponent(code)}/versions/${encodeURIComponent(version)}/pdf`);
}
