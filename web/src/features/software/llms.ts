import "server-only";
import { formatMoney } from "@/lib/format";
import { getBlogList, getBlogPost, softwareOrigin } from "@/lib/server/landing-content";
import { MODULE_AREAS } from "@/lib/software";
import { getPlansCatalog } from "./data";
import { buildFaq } from "./faq";
import { SOFTWARE_DESCRIPTION } from "./seo";

const PAGES = [
  ["/", "Inicio: qué resuelve KipuControl, recorrido del lead a la cobranza y preguntas frecuentes."],
  ["/software/modulos", "Módulos del sistema agrupados por área de trabajo."],
  ["/software/planes", "Planes, precios en soles, comparativo de funciones y adicionales."],
  ["/software/agencias", "Agencias y operadores que usan KipuControl."],
  ["/software/blog", "Blog con guías de ventas, SUNAT, operación, SEO e IA para agencias."],
  ["/software/contacto", "Solicitar una demo o hablar con ventas."],
  ["/software/legal/terminos", "Términos del servicio (texto provisional)."],
  ["/software/legal/privacidad", "Política de privacidad según la Ley 29733 (texto provisional)."],
];

export async function llmsText(full: boolean): Promise<string> {
  const [origin, catalog, blog] = await Promise.all([softwareOrigin(), getPlansCatalog(), getBlogList({ site: "kipucontrol" })]);
  const lines: string[] = ["# KipuControl", "", `> ${SOFTWARE_DESCRIPTION}`, ""];

  lines.push("## Producto", "");
  for (const area of MODULE_AREAS) lines.push(`- ${area.title}: ${area.pitch}`);
  lines.push("");

  if (catalog) {
    lines.push("## Planes", "", "Precios mensuales en soles, sin IGV.", "");
    for (const plan of catalog.plans) {
      const trial = plan.trial_days > 0 ? `, ${plan.trial_days} días de prueba` : "";
      lines.push(`- ${plan.name}: ${formatMoney(plan.price_month, plan.currency)} al mes o ${formatMoney(plan.price_year, plan.currency)} al año${trial}. ${plan.highlights.slice(0, 3).join(". ")}`.trim());
    }
    lines.push("", "## Preguntas frecuentes", "");
    for (const item of buildFaq(catalog)) lines.push(`- ${item.question} ${item.answer}`);
    lines.push("");
  }

  lines.push("## Páginas", "");
  for (const [path, text] of PAGES) lines.push(`- [${path}](${origin}${path === "/" ? "" : path}): ${text}`);
  lines.push("");

  if (blog && blog.items.length > 0) {
    lines.push("## Artículos del blog", "");
    if (!full) {
      for (const card of blog.items) lines.push(`- [${card.title}](${origin}${card.href}): ${card.excerpt}`);
    } else {
      const posts = await Promise.all(blog.items.map((card) => getBlogPost(card.slug)));
      for (const post of posts) {
        if (!post) continue;
        lines.push(`### ${post.title}`, "", `${origin}${post.href}`, "", post.excerpt, "", post.body.replace(/\[\[maqueta:[a-z-]+\]\]\n?/g, ""), "");
        for (const item of post.faq) lines.push(`- ${item.q} ${item.a}`);
        lines.push("");
      }
    }
  }

  return `${lines.join("\n").replace(/\n{3,}/g, "\n\n").trim()}\n`;
}

export function llmsResponse(body: string): Response {
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
}
