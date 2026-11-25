import type { MetadataRoute } from "next";
import { BLOG_BASE, blogHref } from "@/lib/landing-content";
import { getBlogList, softwareOrigin } from "@/lib/server/landing-content";

const PAGES = ["/", "/software/modulos", "/software/planes", "/software/agencias", "/software/contacto", BLOG_BASE, "/software/legal/terminos", "/software/legal/privacidad"];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [origin, blog] = await Promise.all([softwareOrigin(), getBlogList({ site: "kipucontrol" })]);
  const posts = blog?.items ?? [];
  return [
    ...PAGES.map((path) => ({ url: `${origin}${path === "/" ? "" : path}`, changeFrequency: "weekly" as const, priority: path === "/" ? 1 : 0.7 })),
    ...(blog?.categories.filter((category) => category.site === "kipucontrol").map((category) => ({ url: `${origin}${blogHref({ category: category.value })}`, changeFrequency: "weekly" as const, priority: 0.5 })) ?? []),
    ...posts.map((card) => ({ url: `${origin}${card.href}`, lastModified: card.published_at, changeFrequency: "monthly" as const, priority: 0.6 })),
  ];
}
