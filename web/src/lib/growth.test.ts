import { describe, expect, it } from "vitest";
import { otaConversionNote } from "./growth";

describe("otaConversionNote", () => {
  it("avisa que se usa el cliente que ya existe", () => {
    expect(otaConversionNote({ customer: { name: "Emma Larsen", email: "emma@example.com", client: { code: "CLI-0007", name: "Emma Larsen" }, creatable: false } })).toBe("Emma Larsen ya es tu cliente: se usa si no eliges otro.");
  });

  it("avisa que se registra un cliente nuevo cuando la OTA envió documento y contacto", () => {
    expect(otaConversionNote({ customer: { name: "Emma Larsen", email: "emma@example.com", client: null, creatable: true } })).toBe("Se registra a Emma Larsen como cliente nuevo con los datos que envió la OTA.");
  });

  it("pide elegir el cliente cuando faltan el documento o los datos del viajero", () => {
    expect(otaConversionNote({ customer: { name: "Emma Larsen", email: null, client: null, creatable: false } })).toBe("La OTA envió a Emma Larsen sin documento: elige el cliente de tu cartera.");
    expect(otaConversionNote({ customer: null })).toBe("La OTA no envió datos del viajero: elige el cliente de tu cartera.");
  });
});
