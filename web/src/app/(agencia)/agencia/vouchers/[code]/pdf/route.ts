import { proxyPdf } from "@/lib/server/download";

export async function GET(_request: Request, { params }: RouteContext<"/agencia/vouchers/[code]/pdf">) {
  const { code } = await params;
  return proxyPdf(`/b2b/vouchers/${encodeURIComponent(code)}/pdf`);
}
