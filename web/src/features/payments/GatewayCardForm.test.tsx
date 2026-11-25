import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LOCAL_GATEWAY, type GatewayInfo, type GatewaySession, type PayResult, type SessionResult } from "@/lib/payment-gateway";
import { GatewayCardForm } from "./GatewayCardForm";

afterEach(cleanup);

const localSession: GatewaySession = { session_id: "firmada.abc", gateway: "fake", amount: "120.00", currency: "PEN", expires_at: "2026-11-25T10:00:00-05:00", embed: "sandbox" };

const culqi: GatewayInfo = { provider: "culqi", label: "Culqi", mode: "sandbox", embedded: true };

function setup(info: GatewayInfo, session: SessionResult, results: PayResult[]) {
  const openSession = vi.fn(async () => session);
  const onToken = vi.fn(async () => results.shift() ?? { ok: false, message: "sin respuesta" });
  const onPaid = vi.fn();
  render(<GatewayCardForm info={info} amountLabel="S/ 120.00" openSession={openSession} onToken={onToken} onPaid={onPaid} />);
  return { openSession, onToken, onPaid };
}

function fillLocalCard(number = "4111 1111 1111 1111") {
  fireEvent.change(screen.getByLabelText("Número de tarjeta"), { target: { value: number } });
  fireEvent.change(screen.getByLabelText("Nombre en la tarjeta"), { target: { value: "Lucía Quispe" } });
  fireEvent.change(screen.getByLabelText("Vencimiento (MM/AA)"), { target: { value: "08/29" } });
  fireEvent.change(screen.getByLabelText("Código de seguridad"), { target: { value: "123" } });
}

describe("formulario de pago con la pasarela de la agencia", () => {
  it("abre la sesión al pedir pagar y envía solo el token con el id de sesión", async () => {
    const { openSession, onToken, onPaid } = setup(LOCAL_GATEWAY, { ok: true, session: localSession }, [{ ok: true, message: "Aprobado" }]);

    fireEvent.click(screen.getByRole("button", { name: "Pagar S/ 120.00 con tarjeta" }));
    await waitFor(() => expect(screen.getByLabelText("Número de tarjeta")).toBeInTheDocument());
    expect(openSession).toHaveBeenCalledTimes(1);

    fillLocalCard();
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Pagar" })));

    expect(onToken).toHaveBeenCalledWith("tok_ok_1111", "firmada.abc");
    expect(JSON.stringify(onToken.mock.calls)).not.toContain("4111111111111111");
    expect(onPaid).toHaveBeenCalledWith("Aprobado");
    expect(screen.getByText("Aprobado")).toBeInTheDocument();
  });

  it("un rechazo muestra el mensaje y el reintento abre una sesión nueva", async () => {
    const { openSession } = setup(LOCAL_GATEWAY, { ok: true, session: localSession }, [{ ok: false, message: "Fondos insuficientes." }]);

    fireEvent.click(screen.getByRole("button", { name: "Pagar S/ 120.00 con tarjeta" }));
    await waitFor(() => expect(screen.getByLabelText("Número de tarjeta")).toBeInTheDocument());
    fillLocalCard("4000 0000 0000 0002");
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Pagar" })));

    expect(screen.getByText("Fondos insuficientes.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Intentar de nuevo" }));
    await waitFor(() => expect(openSession).toHaveBeenCalledTimes(2));
  });

  it("si la pasarela no abre la sesión lo explica y no muestra campos de tarjeta", async () => {
    setup(culqi, { ok: false, message: "La pasarela no respondió. Intenta de nuevo en unos minutos." }, []);

    fireEvent.click(screen.getByRole("button", { name: "Pagar S/ 120.00 con tarjeta" }));

    expect(await screen.findByText("La pasarela no respondió. Intenta de nuevo en unos minutos.")).toBeInTheDocument();
    expect(screen.queryByLabelText("Número de tarjeta")).not.toBeInTheDocument();
  });

  it("en modo prueba de una pasarela real avisa que no se cobra dinero y nombra a la pasarela", () => {
    setup(culqi, { ok: false, message: "x" }, []);

    expect(screen.getByText("Culqi está en modo prueba: usa sus tarjetas de prueba; no se cobra dinero real.")).toBeInTheDocument();
    expect(screen.getByText("Los datos de la tarjeta los recibe Culqi directamente; la agencia no los ve.")).toBeInTheDocument();
  });

  it("en producción no muestra el aviso de prueba", () => {
    setup({ ...culqi, mode: "produccion" }, { ok: false, message: "x" }, []);

    expect(screen.queryByText(/modo prueba/)).not.toBeInTheDocument();
  });
});
