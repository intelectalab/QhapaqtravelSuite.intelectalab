import { describe, expect, it } from "vitest";
import { articleOutline, blogHref, faqFromText, faqToText, formatReads, parseArticle, popupDue, popupPage, slugify } from "./landing-content";

describe("parseArticle", () => {
  it("reconoce secciones, listas, consejos, tablas y maquetas", () => {
    const blocks = parseArticle(["## Cierre inmediato", "Texto", "- uno", "- dos", "> Dato de conversión: 38 % más", "| A | B |", "| 1 | 2 |", "[[maqueta:cotizador]]"].join("\n"));

    expect(blocks.map((block) => block.kind)).toEqual(["heading", "paragraph", "list", "tip", "table", "mock"]);
    expect(blocks[0]).toEqual({ kind: "heading", id: "cierre-inmediato", text: "Cierre inmediato" });
    expect(blocks[3]).toEqual({ kind: "tip", title: "Dato de conversión", text: "38 % más" });
    expect(blocks[4]).toEqual({ kind: "table", head: ["A", "B"], rows: [["1", "2"]] });
    expect(articleOutline("## Uno\ntexto\n## Matriz de márgenes")).toEqual([{ id: "uno", text: "Uno" }, { id: "matriz-de-margenes", text: "Matriz de márgenes" }]);
  });
});

describe("blogHref", () => {
  it("usa la URL propia de la categoría y deja búsqueda, sitio y orden como parámetros", () => {
    expect(blogHref({})).toBe("/software/blog");
    expect(blogHref({ category: "ventas" })).toBe("/software/blog/categoria/ventas");
    expect(blogHref({ category: "ventas", q: "sunat", site: "kipucontrol", order: "leidos" })).toBe("/software/blog/categoria/ventas?sitio=kipucontrol&q=sunat&orden=leidos");
    expect(blogHref({ order: "recientes" })).toBe("/software/blog");
  });
});

describe("popupPage", () => {
  it("nunca devuelve página en el alta, la bienvenida, el boletín ni lo legal (LND-13)", () => {
    expect(popupPage("/")).toBe("inicio");
    expect(popupPage("/software/planes")).toBe("planes");
    expect(popupPage("/software/blog")).toBe("blog");
    expect(popupPage("/software/blog/categoria/ventas")).toBe("blog");
    expect(popupPage("/software/blog/un-articulo")).toBe("articulo");
    expect(popupPage("/software/suscribirse")).toBeNull();
    expect(popupPage("/software/bienvenido/abc")).toBeNull();
    expect(popupPage("/software/boletin/baja/abc")).toBeNull();
    expect(popupPage("/software/legal/terminos")).toBeNull();
  });
});

describe("popupDue", () => {
  it("respeta la frecuencia en días", () => {
    const now = Date.UTC(2026, 10, 25);
    expect(popupDue(null, 7, now)).toBe(true);
    expect(popupDue(String(now - 6 * 86_400_000), 7, now)).toBe(false);
    expect(popupDue(String(now - 7 * 86_400_000), 7, now)).toBe(true);
    expect(popupDue("basura", 7, now)).toBe(true);
  });
});

describe("faq y formatos", () => {
  it("convierte las preguntas del editor ida y vuelta", () => {
    const faq = [{ q: "¿Funciona en Cusco?", a: "Sí, en todo el Perú." }, { q: "¿Pide tarjeta?", a: "No." }];
    expect(faqFromText(faqToText(faq))).toEqual(faq);
    expect(faqFromText("Pregunta sin respuesta")).toEqual([]);
  });

  it("formatea lecturas y slugs", () => {
    expect(formatReads(2400)).toMatch(/^2[.,]4 k lecturas$/);
    expect(formatReads(1)).toBe("1 lectura");
    expect(slugify("¿Qué es el DL 1125?")).toBe("que-es-el-dl-1125");
  });
});
