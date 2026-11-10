import { proxyPdf } from "@/lib/server/download";

export async function GET(_request: Request, { params }: RouteContext<"/operaciones/vouchers/[code]/pdf">) {
  const { code } = await params;
  return proxyPdf(`/ops/vouchers/${encodeURIComponent(code)}/pdf`);
}
