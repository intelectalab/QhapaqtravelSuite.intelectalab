import { NextResponse, type NextRequest } from "next/server";
import { apiFetch } from "@/lib/server/api";
import { siteRequestHeaders } from "@/lib/server/site";

const TARGETS = ["google", "tripadvisor"];

export async function GET(request: NextRequest, { params }: { params: Promise<{ agencia: string; code: string; destino: string }> }) {
  const { agencia, code, destino } = await params;
  const token = request.nextUrl.searchParams.get("t") ?? "";
  const back = new URL(`${request.nextUrl.pathname.replace(/\/[^/]+$/, "")}?t=${encodeURIComponent(token)}`, request.nextUrl.origin);
  if (!TARGETS.includes(destino) || token === "") return NextResponse.redirect(back);
  const result = await apiFetch<{ url: string }>(`/public/reviews/by-token/${encodeURIComponent(code)}/external-click`, { method: "POST", auth: false, body: { target: destino, t: token }, headers: await siteRequestHeaders(agencia) });
  const target = result.ok && result.data?.url && /^https:\/\//.test(result.data.url) ? result.data.url : null;
  return NextResponse.redirect(target ?? back, { status: 302 });
}
