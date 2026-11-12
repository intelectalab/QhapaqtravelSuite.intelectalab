import { tripLabel } from "../src/format";

describe("fase del viaje", () => {
  it("cuenta los días que faltan", () => {
    expect(tripLabel({ days_left: 5, day: 0, days_total: 4 })).toBe("Faltan 5 días para tu viaje");
    expect(tripLabel({ days_left: 1, day: 0, days_total: 4 })).toBe("Tu viaje empieza mañana");
  });

  it("muestra el día en curso", () => {
    expect(tripLabel({ days_left: 0, day: 2, days_total: 4 })).toBe("Día 2 de 4");
  });

  it("marca el viaje finalizado", () => {
    expect(tripLabel({ days_left: 0, day: 6, days_total: 4 })).toBe("Viaje finalizado");
  });
});
