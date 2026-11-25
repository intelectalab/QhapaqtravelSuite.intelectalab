import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { countdownLabel, portalStatus, type PortalAlert, type PortalTripSummary } from "@/lib/portal";
import { AlertList, TripCard } from "./PortalUi";

afterEach(cleanup);

const trip = (overrides: Partial<PortalTripSummary> = {}): PortalTripSummary => ({ code: "RES-2026-000348", title: "Cusco y Machu Picchu", status: "confirmada", from: "2026-12-10", to: "2026-12-14", total: 23444, currency: "USD", services: 4, confirmed: 3, passengers: 2, phase: "proximo", ...overrides });

describe("estados del portal en palabras del cliente", () => {
  it("cada alcance traduce sus propios estados", () => {
    expect(portalStatus("abierta", "message")).toEqual({ label: "Esperando respuesta", tone: "warn" });
    expect(portalStatus("pendiente", "message")).toEqual({ label: "Respondida", tone: "ok" });
    expect(portalStatus("pendiente", "service").label).toBe("Por confirmar");
    expect(portalStatus("rechazado", "service").label).toBe("Sin cupo, buscando alternativa");
    expect(portalStatus("cancelada", "trip")).toEqual({ label: "Cancelado", tone: "bad" });
    expect(portalStatus("parcial", "trip").label).toBe("Cancelado en parte");
  });

  it("la cuenta regresiva habla del viaje del cliente", () => {
    expect(countdownLabel(12)).toBe("Faltan 12 días");
    expect(countdownLabel(1)).toBe("Sales mañana");
    expect(countdownLabel(0)).toBe("Sales hoy");
    expect(countdownLabel(-2)).toBe("En viaje");
  });
});

describe("tarjeta de viaje del portal", () => {
  it("lleva al detalle y muestra fechas, avance de confirmación, pasajeros y total", () => {
    render(<ul><TripCard trip={trip()} index={0} /></ul>);
    expect(screen.getByRole("link")).toHaveAttribute("href", "/portal/viajes/RES-2026-000348");
    expect(screen.getByText("3/4 confirmados")).toBeInTheDocument();
    expect(screen.getByText(/2 pasajeros/)).toBeInTheDocument();
    expect(screen.getByText("US$ 23 444")).toBeInTheDocument();
  });

  it("sin total muestra la etapa del viaje y usa el singular con un pasajero", () => {
    render(<ul><TripCard trip={trip({ total: null, passengers: 1, phase: "en_curso" })} index={0} /></ul>);
    expect(screen.getByText("En viaje")).toBeInTheDocument();
    expect(screen.getByText(/1 pasajero$/)).toBeInTheDocument();
  });
});

describe("pendientes del cliente", () => {
  it("sin pendientes lo dice en lugar de dejar la lista vacía", () => {
    render(<AlertList alerts={[]} />);
    expect(screen.getByText("Todo en orden. No tienes pendientes por ahora.")).toBeInTheDocument();
  });

  it("cada pendiente lleva a su pantalla con el monto", () => {
    const alert: PortalAlert = { kind: "payment", tone: "warn", title: "Saldo por pagar", detail: "Cusco y Machu Picchu", amount: 1200.5, currency: "PEN", date: null, href: "/portal/pagos" };
    render(<AlertList alerts={[alert]} />);
    expect(screen.getByRole("link", { name: /Saldo por pagar/ })).toHaveAttribute("href", "/portal/pagos");
    expect(screen.getByText("S/ 1 200.50")).toBeInTheDocument();
  });
});
