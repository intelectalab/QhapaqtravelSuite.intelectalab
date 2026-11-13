import type { NextRequest } from "next/server";
import { endPreviewSession } from "@/lib/server/preview-session";

export async function GET(request: NextRequest) {
  return endPreviewSession(request);
}
