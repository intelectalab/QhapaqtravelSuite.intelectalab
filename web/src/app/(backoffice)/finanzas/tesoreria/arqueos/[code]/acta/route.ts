import { proxyPdf } from "@/lib/server/download";

export async function GET(_request: Request, { params }: RouteContext<"/finanzas/tesoreria/arqueos/[code]/acta">) {
  const { code } = await params;
  return proxyPdf(`/treasury/counts/${encodeURIComponent(code)}/pdf`);
}
