import { proxyPdf } from "@/lib/server/download";

export async function GET(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return proxyPdf(`/finance/corporate-statements/${encodeURIComponent(code)}/pdf`);
}
