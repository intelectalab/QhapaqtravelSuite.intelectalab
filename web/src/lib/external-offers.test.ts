import { describe, expect, it } from "vitest";
import { offerExpiry, offerTotal, pendingIssue, type ExternalOffer } from "./external-offers";

const now = new Date("2026-11-24T12:00:00Z");

function offer(status: ExternalOffer["status"], sell: string): ExternalOffer {
  return { id: status + sell, provider: "amadeus", kind: "aereo", kind_label: "Aéreo", offer_ref: "SBX", summary: "LATAM", net_amount: sell, sell_amount: sell, currency: "USD", offer_expires_at: null, pnr: null, status, status_label: status, can_hold: false, can_remove: true };
}

describe("offerExpiry", () => {
  it("avisa en minutos y en rojo cuando faltan 10 o menos", () => {
    expect(offerExpiry("2026-11-24T12:08:00Z", now)).toEqual({ label: "Vence en 8 min", tone: "bad" });
    expect(offerExpiry("2026-11-24T12:30:00Z", now)).toEqual({ label: "Vence en 30 min", tone: "warn" });
  });

  it("pasa a horas y luego a días", () => {
    expect(offerExpiry("2026-11-24T15:00:00Z", now)).toEqual({ label: "Vence en 3 h", tone: "warn" });
    expect(offerExpiry("2026-11-27T12:00:00Z", now)).toEqual({ label: "Vence en 3 días", tone: "mute" });
  });

  it("marca la vencida y no inventa vencimiento sin fecha", () => {
    expect(offerExpiry("2026-11-24T11:59:00Z", now)).toEqual({ label: "Venció", tone: "bad" });
    expect(offerExpiry(null, now)).toBeNull();
  });
});

describe("totales de aéreo y hotel", () => {
  const offers = [offer("cotizada", "120.10"), offer("retenida", "80.20"), offer("emitida", "10.00"), offer("vencida", "999.99"), offer("error", "5.00")];

  it("suma al total de la versión solo lo vigente o emitido, sin errores de redondeo", () => {
    expect(offerTotal("1000.00", offers)).toBe("1210.30");
    expect(offerTotal("0.10", [offer("cotizada", "0.20")])).toBe("0.30");
  });

  it("cuenta lo que se emitirá al convertir y lo que bloquea la conversión", () => {
    expect(pendingIssue(offers)).toEqual({ count: 2, blocked: 2 });
  });
});
