import { proxyFile } from "@/lib/server/corporate-download";

export async function GET(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return proxyFile(`/finance/payments/${encodeURIComponent(code)}/transfer-proof`);
}
