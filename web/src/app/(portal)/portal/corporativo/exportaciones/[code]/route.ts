import { proxyFile } from "@/lib/server/corporate-download";

export async function GET(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return proxyFile(`/portal/client/corporate/exports/${encodeURIComponent(code)}?download=1`);
}
