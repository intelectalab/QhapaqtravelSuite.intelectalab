import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BlogIndex, type BlogSearchParams, blogMetadata } from "@/features/software/blog/BlogIndex";
import { getBlogList } from "@/lib/server/landing-content";

async function category(slug: string) {
  const list = await getBlogList({});
  return list?.categories.find((item) => item.value === slug) ?? null;
}

export async function generateMetadata({ params, searchParams }: { params: Promise<{ cat: string }>; searchParams: BlogSearchParams }): Promise<Metadata> {
  const { cat } = await params;
  const found = await category(cat);
  return found ? blogMetadata(searchParams, { slug: found.value, label: found.label }) : { title: "Categoría no encontrada" };
}

export default async function BlogCategoryPage({ params, searchParams }: { params: Promise<{ cat: string }>; searchParams: BlogSearchParams }) {
  const { cat } = await params;
  if (!(await category(cat))) notFound();
  return <BlogIndex searchParams={searchParams} category={cat} />;
}
