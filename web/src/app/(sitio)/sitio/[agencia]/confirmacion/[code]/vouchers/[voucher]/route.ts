import { cookies } from "next/headers";
import { downloadError, proxyPdf } from "@/lib/server/download";
import { siteRequestHeaders } from "@/lib/server/site";
import { orderCookie } from "@/lib/site";

export async function GET(_request: Request, { params }: RouteContext<"/sitio/[agencia]/confirmacion/[code]/vouchers/[voucher]">) {
  const { agencia, code, voucher } = await params;
  const token = (await cookies()).get(orderCookie(code))?.value;
  if (!token) return downloadError("Abre el pedido desde el mismo navegador con el que lo hiciste para descargar sus vouchers.", 404);
  return proxyPdf(`/public/orders/${encodeURIComponent(code)}/vouchers/${encodeURIComponent(voucher)}.pdf`, { auth: false, headers: await siteRequestHeaders(agencia, { "X-Order-Token": token }) });
}
