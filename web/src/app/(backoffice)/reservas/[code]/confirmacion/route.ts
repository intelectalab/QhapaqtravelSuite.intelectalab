import { proxyPdf } from "@/lib/server/download";

export async function GET(_request: Request, { params }: RouteContext<"/reservas/[code]/confirmacion">) {
  const { code } = await params;
  return proxyPdf(`/reservations/${encodeURIComponent(code)}/documents/confirmation`);
}
