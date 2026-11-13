import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { redirectTo } from "@/lib/server/redirect";
import { TEMPLATE_PREVIEW_COOKIE } from "@/lib/templatePreview";

export async function GET(request: NextRequest, { params }: RouteContext<"/sitio/[agencia]/vista-plantilla">) {
  const { agencia } = await params;
  const store = await cookies();
  store.delete(TEMPLATE_PREVIEW_COOKIE);
  const code = request.nextUrl.searchParams.get("aplicar");

  if (code && /^[A-Z0-9-]{3,20}$/.test(code)) {
    return redirectTo(request, `/canales/plantillas?aplicar=${encodeURIComponent(code)}`);
  }

  return redirectTo(request, request.nextUrl.searchParams.has("panel") ? "/canales/plantillas" : `/sitio/${agencia}`);
}
