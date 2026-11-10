import { proxyPdf } from "@/lib/server/download";

export async function GET(_request: Request, { params }: RouteContext<"/portal/viajes/[code]/itinerario">) {
  const { code } = await params;
  return proxyPdf(`/portal/client/reservations/${encodeURIComponent(code)}/itinerary.pdf`);
}
