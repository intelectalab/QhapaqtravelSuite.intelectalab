jest.mock("expo-sqlite", () => ({ openDatabaseAsync: jest.fn() }));
jest.mock("expo-crypto", () => ({ getRandomValues: (bytes: Uint8Array) => bytes }));
jest.mock("expo-secure-store", () => ({ getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn() }));

import { applyCheckin, applyCheckinAll, applyConfirm, applyEvidence, applyFinish, applyStart } from "../src/data/actions";
import { addDays, dayLabel, stepIndex } from "../src/format";
import type { Assignment } from "../src/types";

const AT = "2026-11-11T15:00:00.000Z";

function assignment(overrides: Partial<Assignment> = {}): Assignment {
  return {
    id: "a-1",
    status: "asignada",
    lock_version: 1,
    date: "2026-11-11",
    time: "08:00",
    label: "Valle Sagrado",
    kind: "tour",
    service: { code: "RS-1", name: "Tour Valle Sagrado", status: "confirmado" },
    order: { code: "OP-1", title: "Grupo", status: "asignada" },
    reservation: "RES-1",
    notes: null,
    vehicle: null,
    meeting_point: null,
    partner: null,
    coordinator: null,
    confirmed_at: null,
    started_at: null,
    first_checkin_at: null,
    finished_at: null,
    updated_at: null,
    passengers: [
      { id: "p-1", name: "Ana", type: "ADT", doc: null, diet: null, lead: true, phone: null, checked_at: null, no_show: false },
      { id: "p-2", name: "Luis", type: "ADT", doc: null, diet: null, lead: false, phone: null, checked_at: null, no_show: false },
    ],
    checked_in: 0,
    evidences: [],
    can: { confirm: true, start: false, checkin: false, evidence: false, finish: false },
    ...overrides,
  };
}

describe("cambios optimistas (MOB-BR-02)", () => {
  it("confirmar habilita iniciar", () => {
    const next = applyConfirm(assignment(), AT);
    expect(next.status).toBe("confirmada");
    expect(next.can).toMatchObject({ confirm: false, start: true });
  });

  it("finalizar exige check-in y evidencia, y marca no-show a quien no llegó", () => {
    let next = applyStart(applyConfirm(assignment(), AT), AT);
    expect(next.can.finish).toBe(false);
    next = applyCheckin(next, "p-1", AT, false);
    expect(next.checked_in).toBe(1);
    expect(next.can.finish).toBe(false);
    next = applyEvidence(next, { id: "e-1", name: "foto.jpg", mime: "image/jpeg", sha256: "x" });
    expect(next.can.finish).toBe(true);
    next = applyFinish(next, AT);
    expect(next.status).toBe("completada");
    expect(next.passengers.find((passenger) => passenger.id === "p-2")?.no_show).toBe(true);
  });

  it("deshacer el check-in lo quita y check-in del grupo marca a todos", () => {
    const started = applyStart(applyConfirm(assignment(), AT), AT);
    expect(applyCheckin(applyCheckin(started, "p-1", AT, false), "p-1", AT, true).checked_in).toBe(0);
    expect(applyCheckinAll(started, AT).checked_in).toBe(2);
  });
});

describe("formatos", () => {
  it("muestra Hoy, Mañana y Ayer", () => {
    expect(dayLabel("2026-11-11", "2026-11-11")).toBe("Hoy");
    expect(dayLabel("2026-11-12", "2026-11-11")).toBe("Mañana");
    expect(dayLabel("2026-11-10", "2026-11-11")).toBe("Ayer");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("ubica el paso del servicio", () => {
    expect(stepIndex("asignada", 0, 0)).toBe(1);
    expect(stepIndex("en_curso", 0, 0)).toBe(3);
    expect(stepIndex("en_curso", 2, 0)).toBe(4);
    expect(stepIndex("en_curso", 2, 1)).toBe(5);
    expect(stepIndex("completada", 2, 1)).toBe(6);
  });
});
