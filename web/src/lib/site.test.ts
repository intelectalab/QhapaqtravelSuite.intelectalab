import { describe, expect, it } from "vitest";
import { convertForDisplay, tokenizeCard, type SiteCurrencySettings } from "@/lib/site";
import { parseSiteLocale, SITE_TEXT } from "@/lib/site-i18n";

const settings: SiteCurrencySettings = {
  currencies: [
    { code: "PEN", name: "Soles", rate: 1 },
    { code: "USD", name: "Dólares", rate: 3.75 },
    { code: "EUR", name: "Euros", rate: 0 },
  ] as SiteCurrencySettings["currencies"],
  margin_pct: 0,
  charge_multi: false,
};

function shape(value: unknown): unknown {
  if (typeof value === "function") return `fn/${value.length}`;
  if (Array.isArray(value)) return value.map(shape);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, shape(item)]));
  return typeof value;
}

describe("tarjeta del checkout del sitio", () => {
  it("valida con Luhn, enmascara y nunca deja el número completo en el token", () => {
    const card = tokenizeCard("4111 1111 1111 1111");
    expect(card).toEqual({ token: "tok_ok_1111", masked: "•••• 1111", valid: true });
    expect(card.token).not.toContain("411111");
  });

  it("marca las tarjetas de prueba de rechazo y las desconocidas", () => {
    expect(tokenizeCard("4000000000000002").token).toBe("tok_51_0002");
    expect(tokenizeCard("4242424242424242")).toMatchObject({ token: "tok_14_4242", valid: true });
  });

  it("rechaza números que no pasan Luhn o con largo fuera de 13 a 19", () => {
    expect(tokenizeCard("4111111111111112").valid).toBe(false);
    expect(tokenizeCard("411111").valid).toBe(false);
    expect(tokenizeCard("41111111111111111111").valid).toBe(false);
    expect(tokenizeCard("").masked).toBe("•••• 0000");
  });
});

describe("moneda referencial del sitio", () => {
  it("convierte con las tasas de la agencia y suma el margen", () => {
    expect(convertForDisplay(375, "PEN", "USD", settings)).toBeCloseTo(100);
    expect(convertForDisplay(100, "USD", "PEN", { ...settings, margin_pct: 2 })).toBeCloseTo(382.5);
  });

  it("no convierte la misma moneda ni inventa una tasa que falta", () => {
    expect(convertForDisplay(80, "USD", "USD", { ...settings, margin_pct: 5 })).toBe(80);
    expect(convertForDisplay(80, "USD", "EUR", settings)).toBeNull();
    expect(convertForDisplay(80, "USD", "GBP", settings)).toBeNull();
  });
});

describe("idiomas del sitio", () => {
  it("solo acepta inglés como alternativa y cae en español", () => {
    expect(parseSiteLocale("en")).toBe("en");
    expect(parseSiteLocale("EN")).toBe("es");
    expect(parseSiteLocale("fr")).toBe("es");
    expect(parseSiteLocale(null)).toBe("es");
  });

  it("el diccionario en inglés tiene exactamente los mismos textos que el español", () => {
    expect(shape(SITE_TEXT.en)).toEqual(shape(SITE_TEXT.es));
  });

  it("los textos con datos los incluyen en los dos idiomas", () => {
    expect(SITE_TEXT.es.header.paidIn("USD")).toContain("USD");
    expect(SITE_TEXT.en.header.paidIn("USD")).toContain("USD");
  });
});
