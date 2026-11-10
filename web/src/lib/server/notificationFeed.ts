import "server-only";
import { NextResponse } from "next/server";
import type { NotificationFeed, UserNotification } from "@/lib/account";
import type { Realm } from "@/lib/realms";
import { apiFetch } from "./api";

export async function notificationFeedResponse(path: string, realm?: Realm): Promise<NextResponse> {
  const result = await apiFetch<{ data: UserNotification[]; meta: { unread_count: number; can_view_log?: boolean } }>(path, { raw: true, realm });

  if (!result.ok || !result.data) {
    return NextResponse.json({ message: result.error?.message ?? null }, { status: result.status || 503, headers: { "Cache-Control": "no-store" } });
  }

  const feed: NotificationFeed = { items: result.data.data, unread: result.data.meta.unread_count, canViewLog: result.data.meta.can_view_log ?? false };

  return NextResponse.json(feed, { headers: { "Cache-Control": "no-store" } });
}
