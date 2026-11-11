import type { NextRequest } from "next/server";
import { helpScreenResponse } from "@/lib/server/help";

export const dynamic = "force-dynamic";

export function GET(request: NextRequest) {
  return helpScreenResponse(request, "/platform/help/screen", "platform");
}
