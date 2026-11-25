import type { Metadata } from "next";
import { CommentsTable } from "@/features/platform/LandingConsole";
import type { CommentsOverview } from "@/lib/landing-content";
import { platformGet } from "@/lib/server/platform";

export const metadata: Metadata = { title: "Comentarios del blog" };

export default async function LandingCommentsPage() {
  return <CommentsTable overview={await platformGet<CommentsOverview>("/landing/comments")} />;
}
