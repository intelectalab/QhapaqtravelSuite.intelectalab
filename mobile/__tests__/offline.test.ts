jest.mock("expo-sqlite", () => ({ openDatabaseAsync: jest.fn() }));
jest.mock("@react-native-community/netinfo", () => ({ addEventListener: jest.fn(() => jest.fn()), fetch: jest.fn(async () => ({ isConnected: true })) }));
jest.mock("expo-crypto", () => ({ getRandomValues: (bytes: Uint8Array) => bytes.fill(7) }));

import { coalesceKey, uuidv7, type OutboxAction } from "../src/offline/outbox";
import { describeStatus } from "../src/offline/status";
import { backoffDelay, toWire } from "../src/offline/sync";

const EMPTY = { pending: 0, syncing: 0, synced: 0, failed: 0, conflict: 0 };

function action(overrides: Partial<OutboxAction>): OutboxAction {
  return {
    client_action_id: "01890000-0000-7000-8000-000000000001",
    type: "checkin",
    assignment_id: "a-1",
    coalesce_key: "checkin:a-1:p-1",
    payload_json: JSON.stringify({ passenger_id: "p-1" }),
    occurred_at: "2026-11-11T15:00:00.000Z",
    offline: 1,
    state: "pending",
    attempts: 0,
    next_attempt_at: null,
    last_error: null,
    conflict_message: null,
    ...overrides,
  };
}

describe("uuidv7", () => {
  it("genera un UUID versión 7 ordenable por tiempo", () => {
    const first = uuidv7(1_700_000_000_000);
    const later = uuidv7(1_700_000_000_500);
    expect(first).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(first < later).toBe(true);
  });
});

describe("coalesceKey (MOB-BR-03)", () => {
  it("usa la misma clave para check-in y su deshacer del mismo pasajero", () => {
    expect(coalesceKey("checkin", "a-1", { passenger_id: "p-1" })).toBe("checkin:a-1:p-1");
    expect(coalesceKey("checkin_undo", "a-1", { passenger_id: "p-1" })).toBe("checkin:a-1:p-1");
    expect(coalesceKey("confirm", "a-1", {})).toBe("confirm:a-1");
  });
});

describe("backoffDelay (MOB-BR-04)", () => {
  it("duplica la espera desde 2 s, con tope de 5 min", () => {
    const fixed = () => 0.5;
    expect(backoffDelay(1, fixed)).toBe(2_000);
    expect(backoffDelay(2, fixed)).toBe(4_000);
    expect(backoffDelay(4, fixed)).toBe(16_000);
    expect(backoffDelay(20, fixed)).toBe(300_000);
  });

  it("agrega un margen aleatorio de hasta 20 %", () => {
    expect(backoffDelay(3, () => 0)).toBe(6_400);
    expect(backoffDelay(3, () => 1)).toBe(9_600);
  });
});

describe("toWire", () => {
  it("envía el deshacer de check-in como check-in con undo, con el dispositivo", () => {
    const wire = toWire(action({ type: "checkin_undo" }), "dev-1");
    expect(wire).toMatchObject({ type: "checkin", device_id: "dev-1", offline: true, payload: { passenger_id: "p-1", undo: true } });
  });

  it("deja igual las demás acciones", () => {
    const wire = toWire(action({ type: "confirm", payload_json: "{}", offline: 0 }), "dev-1");
    expect(wire).toMatchObject({ type: "confirm", offline: false, payload: {} });
  });
});

describe("describeStatus", () => {
  it("prioriza errores, luego conflictos, luego la falta de conexión", () => {
    expect(describeStatus(true, { ...EMPTY, failed: 2, conflict: 1 })).toEqual({ label: "2 con error", tone: "bad" });
    expect(describeStatus(true, { ...EMPTY, conflict: 1 }).tone).toBe("warn");
    expect(describeStatus(false, { ...EMPTY, pending: 3 })).toEqual({ label: "Sin conexión · 3 por enviar", tone: "warn" });
    expect(describeStatus(true, { ...EMPTY, pending: 1 }).tone).toBe("info");
    expect(describeStatus(true, EMPTY)).toEqual({ label: "Todo sincronizado", tone: "ok" });
  });
});
