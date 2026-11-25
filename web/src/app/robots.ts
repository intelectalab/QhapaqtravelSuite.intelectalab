import type { MetadataRoute } from "next";
import { SITE_PRIVATE_PATHS } from "@/lib/server/site-seo";

const PRIVATE = ["/api/", "/plataforma", "/portal", "/proveedor", "/propuesta", "/widget", "/c/", "/software/suscribirse", "/software/bienvenido", "/software/boletin", ...SITE_PRIVATE_PATHS.map((path) => `/sitio/*${path}`)];

const TRAINING_CRAWLERS = ["GPTBot", "Google-Extended", "CCBot", "anthropic-ai", "ClaudeBot", "Applebot-Extended", "Bytespider", "meta-externalagent"];

const ANSWER_CRAWLERS = ["OAI-SearchBot", "ChatGPT-User", "PerplexityBot", "Claude-SearchBot", "Claude-User"];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: ["/", "/sitio/", "/software", "/llms.txt", "/llms-full.txt"], disallow: PRIVATE },
      { userAgent: ANSWER_CRAWLERS, allow: ["/", "/software", "/llms.txt", "/llms-full.txt"], disallow: PRIVATE },
      { userAgent: TRAINING_CRAWLERS, allow: ["/llms.txt"], disallow: ["/"] },
    ],
  };
}
