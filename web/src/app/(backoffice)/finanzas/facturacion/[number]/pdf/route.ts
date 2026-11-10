import { proxyPdf } from "@/lib/server/download";

export async function GET(_request: Request, { params }: RouteContext<"/finanzas/facturacion/[number]/pdf">) {
  const { number } = await params;
  return proxyPdf(`/finance/invoices/${encodeURIComponent(number)}/pdf`);
}
