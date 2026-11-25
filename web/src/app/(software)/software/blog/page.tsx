import type { Metadata } from "next";
import { BlogIndex, type BlogSearchParams, blogMetadata } from "@/features/software/blog/BlogIndex";

export async function generateMetadata({ searchParams }: { searchParams: BlogSearchParams }): Promise<Metadata> {
  return blogMetadata(searchParams);
}

export default function BlogPage({ searchParams }: { searchParams: BlogSearchParams }) {
  return <BlogIndex searchParams={searchParams} />;
}
