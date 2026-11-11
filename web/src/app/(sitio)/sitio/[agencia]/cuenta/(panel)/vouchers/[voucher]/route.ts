import { downloadError, proxyPdf } from "@/lib/server/download";
import { accountToken, siteRequestHeaders } from "@/lib/server/site";

export async function GET(_request: Request, { params }: RouteContext<"/sitio/[agencia]/cuenta/vouchers/[voucher]">) {
  const { agencia, voucher } = await params;
  const token = await accountToken(agencia);
  if (!token) return downloadError("Tu sesión venció. Vuelve a ingresar para descargar el voucher.", 401);
  return proxyPdf(`/public/me/vouchers/${encodeURIComponent(voucher)}.pdf`, { auth: false, headers: await siteRequestHeaders(agencia, { Authorization: `Bearer ${token}` }) });
}
