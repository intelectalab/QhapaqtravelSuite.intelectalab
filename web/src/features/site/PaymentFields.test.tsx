import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CheckoutTerms } from "@/lib/site";
import { PaymentFields, type PaymentValue } from "./PaymentFields";

afterEach(cleanup);

const methods: CheckoutTerms["methods"] = [
  { value: "tarjeta", label: "Tarjeta" },
  { value: "transferencia", label: "Transferencia" },
  { value: "yape", label: "Yape", currency: "PEN" },
  { value: "plin", label: "Plin", available: false, note: "Plin no está disponible para esta reserva." },
];

const accounts: CheckoutTerms["bank_accounts"] = [{ bank: "BCP", name: "Andes Travel", currency: "USD", account_number: "193-1234567-1-01", cci: "00219300123456710112" }];

function setup() {
  const onChange = vi.fn<(value: PaymentValue) => void>();
  render(<PaymentFields methods={methods} accounts={accounts} walletPhone="987654321" onChange={onChange} />);
  const last = () => onChange.mock.calls.at(-1)?.[0];
  const type = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
  return { last, type };
}

describe("medios de pago del checkout", () => {
  it("con tarjeta queda listo solo con número válido, titular, vencimiento y código, y manda el token, no el número", () => {
    const { last, type } = setup();
    expect(last()).toMatchObject({ method: "tarjeta", ready: false });

    type("Número de tarjeta", "4111 1111 1111 1111");
    type("Nombre en la tarjeta", "Lucía Quispe");
    type("Vencimiento (MM/AA)", "13/29");
    type("Código de seguridad", "123");
    expect(last()?.ready).toBe(false);

    type("Vencimiento (MM/AA)", "08/29");
    expect(last()).toEqual({ method: "tarjeta", card_token: "tok_ok_1111", card_holder: "Lucía Quispe", ready: true });
    expect(JSON.stringify(last())).not.toContain("4111111111111111");
  });

  it("avisa cuando el número de tarjeta no es válido", () => {
    const { type } = setup();
    type("Número de tarjeta", "4111 1111 1111 1112");
    expect(screen.getByText("El número de tarjeta no es válido.")).toBeInTheDocument();
  });

  it("la transferencia muestra las cuentas y pide el número de operación", () => {
    const { last, type } = setup();
    fireEvent.click(screen.getByRole("radio", { name: /Transferencia/ }));
    expect(screen.getByText(/Cuenta 193-1234567-1-01 · CCI 00219300123456710112/)).toBeInTheDocument();
    expect(screen.getByText("BCP · Dólares")).toBeInTheDocument();

    type("Número de operación", "123");
    expect(last()).toMatchObject({ method: "transferencia", ready: false });
    type("Número de operación", " 0045871 ");
    expect(last()).toEqual({ method: "transferencia", operation_ref: "0045871", ready: true });
  });

  it("Yape muestra el número de la agencia y que se cobra en soles; un medio no disponible queda deshabilitado con su motivo", () => {
    setup();
    fireEvent.click(screen.getByRole("radio", { name: /Yape/ }));
    expect(screen.getByText("987654321")).toBeInTheDocument();
    expect(screen.getByText(/El cobro es en soles/)).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Plin/ })).toBeDisabled();
    expect(screen.getByText("Plin no está disponible para esta reserva.")).toBeInTheDocument();
  });

  it("con la pasarela de la agencia no pide la tarjeta aquí: queda listo y avisa que se paga en su formulario seguro", () => {
    const onChange = vi.fn<(value: PaymentValue) => void>();
    render(<PaymentFields methods={methods} accounts={accounts} walletPhone={null} onChange={onChange} gateway={{ provider: "izipay", label: "Izipay", mode: "produccion", embedded: true }} />);

    expect(onChange.mock.calls.at(-1)?.[0]).toEqual({ method: "tarjeta", ready: true });
    expect(screen.queryByLabelText("Número de tarjeta")).not.toBeInTheDocument();
    expect(screen.getByText(/Pagarás en el formulario seguro de Izipay/)).toBeInTheDocument();
  });
});
