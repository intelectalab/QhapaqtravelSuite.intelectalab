jest.mock("expo-sqlite", () => ({ openDatabaseAsync: jest.fn() }));
jest.mock("expo-crypto", () => ({ getRandomValues: (bytes: Uint8Array) => bytes }));
jest.mock("expo-secure-store", () => ({ getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn() }));
jest.mock("../src/api/session", () => ({ deviceId: jest.fn(async () => null) }));

import { ApiRequestError } from "../src/api/client";
import { outcomeFromError, outcomeFromScan, readPassToken } from "../src/data/checkin";

describe("lectura del QR del pase (spec 19 SC-14)", () => {
  it("acepta solo pases de check-in y descarta vouchers u otros códigos", () => {
    expect(readPassToken("  KPQabcdefghijklmnopqrstuvwxyz012345  ")).toBe("KPQabcdefghijklmnopqrstuvwxyz012345");
    expect(readPassToken("VOU-0001|RES-2026-000348|2")).toBeNull();
    expect(readPassToken("KPQcorto")).toBeNull();
    expect(readPassToken("https://example.com/pase")).toBeNull();
  });
});

describe("mensajes del escaneo", () => {
  it("marca el ingreso con el pasajero devuelto por el servidor", () => {
    const outcome = outcomeFromScan({ result: "ingreso", passenger: "Ana", passenger_id: "p-1", service: { id: "s", code: "RS-1", name: "Tour" }, scanned_at: "2026-11-18T14:00:00Z", counts: { total: 2, checked_in: 1, pending: 1 }, message: "Ana registró su ingreso." });
    expect(outcome).toMatchObject({ tone: "ok", title: "Ingreso registrado", passengerId: "p-1" });
  });

  it("distingue ya registrado, otro servicio y servicio no asignado", () => {
    expect(outcomeFromError(new ApiRequestError({ status: 409, code: "PASS_ALREADY_USED", message: "Ana ya ingresó a las 09:05." }))).toMatchObject({ tone: "warn", title: "Ya registrado", message: "Ana ya ingresó a las 09:05." });
    expect(outcomeFromError(new ApiRequestError({ status: 422, code: "PASS_OTHER_SERVICE", message: "otro" })).title).toBe("No pertenece a este servicio");
    expect(outcomeFromError(new ApiRequestError({ status: 403, code: "CHECKIN_NOT_ASSIGNED", message: "no" })).title).toBe("No pertenece a tu servicio");
    expect(outcomeFromError(new ApiRequestError({ status: 404, message: "El código QR no corresponde a un pase de esta agencia." })).title).toBe("Pase no reconocido");
    expect(outcomeFromError(new ApiRequestError({ status: 0, message: "Sin conexión con el servidor." })).title).toBe("Sin conexión");
  });
});
