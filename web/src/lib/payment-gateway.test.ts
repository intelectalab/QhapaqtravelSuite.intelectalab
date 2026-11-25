import { describe, expect, it } from "vitest";
import { paymentTarget } from "./payment-csp";
import { embedOf, parseGatewayInfo, testModeNote } from "./payment-gateway";
import { contentSecurityPolicy } from "./security-headers";

describe("pasarela de la agencia", () => {
  it("lee la pasarela del API y descarta dominios que no son https", () => {
    const info = parseGatewayInfo({ provider: "mercadopago", label: "Mercado Pago", mode: "sandbox", embedded: true, sources: { script: ["https://sdk.mercadopago.com", "http://malo.com", "javascript:alert(1)"], frame: ["https://www.mercadopago.com.pe"] } });

    expect(info).toMatchObject({ provider: "mercadopago", embedded: true, mode: "sandbox" });
    expect(info.sources?.script).toEqual(["https://sdk.mercadopago.com"]);
    expect(info.sources?.frame).toEqual(["https://www.mercadopago.com.pe"]);
  });

  it("sin datos o con un proveedor desconocido vuelve a la pasarela de prueba local", () => {
    expect(parseGatewayInfo(null)).toMatchObject({ provider: "sandbox", embedded: false });
    expect(parseGatewayInfo({ provider: "otra", embedded: true })).toMatchObject({ provider: "sandbox", embedded: false });
  });

  it("el aviso de prueba solo sale para pasarelas reales en modo prueba", () => {
    expect(testModeNote({ provider: "izipay", label: "Izipay", mode: "sandbox" })).toContain("Izipay está en modo prueba");
    expect(testModeNote({ provider: "izipay", label: "Izipay", mode: "produccion" })).toBeNull();
    expect(testModeNote({ provider: "sandbox", label: "Pasarela de prueba", mode: "sandbox" })).toBeNull();
  });

  it("la sesión sin datos incrustados se trata como pasarela local", () => {
    expect(embedOf({ session_id: "x", gateway: "fake", amount: "1", currency: "PEN", expires_at: "", embed: "sandbox" }).provider).toBe("sandbox");
    expect(embedOf({ session_id: "x", gateway: "culqi", amount: "1", currency: "PEN", expires_at: "", embed: { provider: "culqi", public_key: "pk_test_1" } }).public_key).toBe("pk_test_1");
  });
});

describe("CSP de las páginas de pago", () => {
  it("solo las páginas de pago piden los dominios de la pasarela", () => {
    expect(paymentTarget("/sitio/andes/checkout", "localhost:3200")).toEqual({ kind: "site", host: "andes.localhost" });
    expect(paymentTarget("/sitio/andes/confirmacion/WEB-1", null)).toMatchObject({ kind: "site" });
    expect(paymentTarget("/sitio/andes/cuenta/pagos", null)).toMatchObject({ kind: "site" });
    expect(paymentTarget("/portal/pagos", null)).toEqual({ kind: "portal" });
    expect(paymentTarget("/sitio/andes/tours", "localhost:3200")).toBeNull();
    expect(paymentTarget("/finanzas/pasarelas", "localhost:3200")).toBeNull();
    expect(paymentTarget("/checkout", "viajes.andes.pe")).toEqual({ kind: "site", host: "viajes.andes.pe" });
  });

  it("agrega a la política solo los orígenes https de la pasarela activa", () => {
    const policy = contentSecurityPolicy("n0nce", true, [], true, { script: ["https://checkout.culqi.com", "https://x.com/../evil"], frame: ["https://checkout.culqi.com"], connect: ["https://api.culqi.com"] });

    expect(policy).toContain("script-src 'self' 'nonce-n0nce' 'strict-dynamic'");
    expect(policy).toMatch(/script-src [^;]*https:\/\/checkout\.culqi\.com/);
    expect(policy).toMatch(/frame-src 'self' https:\/\/challenges\.cloudflare\.com https:\/\/checkout\.culqi\.com/);
    expect(policy).toContain("connect-src 'self' https://api.culqi.com");
    expect(policy).not.toContain("evil");
    expect(contentSecurityPolicy("n0nce")).toContain("connect-src 'self';");
  });
});
