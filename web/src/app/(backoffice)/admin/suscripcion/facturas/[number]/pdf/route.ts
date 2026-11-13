import { proxyPdf } from "@/lib/server/download";

export async function GET(_request: Request, { params }: { params: Promise<{ number: string }> }) {
  const { number } = await params;
  return proxyPdf(`/billing/invoices/${encodeURIComponent(number)}/pdf`);
}
