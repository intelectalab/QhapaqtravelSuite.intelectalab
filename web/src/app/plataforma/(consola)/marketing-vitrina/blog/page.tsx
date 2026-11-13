import type { Metadata } from "next";
import { BlogSyncPanel } from "@/features/tracking/PlatformMarketing";
import { platformGet } from "@/lib/server/platform";
import type { BlogSyncStatus } from "@/lib/tracking";

export const metadata: Metadata = { title: "Blog en Payload" };

export default async function BlogVitrinaPage() {
  return <BlogSyncPanel status={await platformGet<BlogSyncStatus>("/blog/sync-status")} />;
}
