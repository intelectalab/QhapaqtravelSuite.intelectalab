import { notificationFeedResponse } from "@/lib/server/notificationFeed";

export const dynamic = "force-dynamic";

export function GET() {
  return notificationFeedResponse("/me/notifications");
}
