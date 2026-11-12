import type { MetadataRoute } from "next";
import { SITE_PRIVATE_PATHS } from "@/lib/server/site-seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/sitio/", "/software"],
        disallow: ["/api/", "/plataforma", "/portal", "/proveedor", "/propuesta", "/widget", "/c/", ...SITE_PRIVATE_PATHS.map((path) => `/sitio/*${path}`)],
      },
    ],
  };
}
