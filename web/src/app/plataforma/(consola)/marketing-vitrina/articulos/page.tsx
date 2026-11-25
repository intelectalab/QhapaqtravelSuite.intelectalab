import type { Metadata } from "next";
import { PostsTable } from "@/features/platform/LandingConsole";
import type { PostsOverview } from "@/lib/landing-content";
import { platformGet } from "@/lib/server/platform";

export const metadata: Metadata = { title: "Blog de KipuControl" };

export default async function LandingPostsPage() {
  return <PostsTable overview={await platformGet<PostsOverview>("/landing/posts")} />;
}
