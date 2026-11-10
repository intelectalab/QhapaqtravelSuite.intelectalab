import { notificationFeedResponse } from "@/lib/server/notificationFeed";

export const dynamic = "force-dynamic";

export function GET() {
  return notificationFeedResponse("/platform/notifications", "platform");
}
