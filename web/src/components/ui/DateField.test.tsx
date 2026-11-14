import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { addMonths, formatTyped, maskTyped, monthMatrix, parseTyped, splitDateTime, timeSlots } from "@/lib/date-field";
import { DateField } from "./DateField";
import { DateTimeField } from "./DateTimeField";

beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  globalThis.requestAnimationFrame = (callback: FrameRequestCallback) => setTimeout(() => callback(0), 0) as unknown as number;
  globalThis.cancelAnimationFrame = (handle: number) => clearTimeout(handle);
});

afterEach(cleanup);

const hidden = (container: HTMLElement) => container.querySelector<HTMLInputElement>('input[type="hidden"][name="fecha"]');

const flush = () => act(() => new Promise((resolve) => setTimeout(resolve, 5)));

describe("ayudantes de fecha", () => {
  it("lee la fecha escrita a mano en varios formatos", () => {
    expect(parseTyped("15/12/2026")).toBe("2026-12-15");
    expect(parseTyped("5-1-2027")).toBe("2027-01-05");
    expect(parseTyped("15122026")).toBe("2026-12-15");
    expect(parseTyped("2026-12-15")).toBe("2026-12-15");
    expect(parseTyped("31/02/2026")).toBeNull();
    expect(parseTyped("hola")).toBeNull();
    expect(formatTyped("2026-12-15")).toBe("15/12/2026");
    expect(maskTyped("1512")).toBe("15/12");
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
  });

  it("arma el mes con la semana desde el lunes", () => {
    const weeks = monthMatrix(2026, 11);
    expect(weeks).toHaveLength(6);
    expect(weeks[0][0].iso).toBe("2026-10-26");
    expect(weeks[0].find((day) => day.inMonth)?.iso).toBe("2026-11-01");
    expect(weeks[0][6].iso).toBe("2026-11-01");
  });
});

describe("DateField", () => {
  it("acepta la fecha escrita y la entrega en ISO en el campo oculto", () => {
    const onChange = vi.fn();
    const { container } = render(<DateField label="Fecha del viaje" name="fecha" today="2026-11-13" onChange={onChange} />);
    const input = screen.getByLabelText("Fecha del viaje");

    fireEvent.change(input, { target: { value: "15122026" } });
    expect(input).toHaveValue("15/12/2026");
    fireEvent.blur(input);

    expect(hidden(container)).toHaveValue("2026-12-15");
    expect(onChange).toHaveBeenCalledWith("2026-12-15");
  });

  it("avisa si la fecha escrita no es válida o está fuera de lo permitido", () => {
    const { container } = render(<DateField label="Fecha" name="fecha" today="2026-11-13" disablePast />);
    const input = screen.getByLabelText("Fecha");

    fireEvent.change(input, { target: { value: "99/99/2026" } });
    fireEvent.blur(input);
    expect(screen.getByRole("alert")).toHaveTextContent("Escribe la fecha como dd/mm/aaaa.");

    fireEvent.change(input, { target: { value: "01/11/2026" } });
    fireEvent.blur(input);
    expect(screen.getByRole("alert")).toHaveTextContent("Esa fecha no está disponible.");
    expect(hidden(container)).toHaveValue("");
  });

  it("abre el calendario desde el lunes, bloquea días pasados y elige con el teclado", async () => {
    const { container } = render(<DateField label="Fecha" name="fecha" today="2026-11-13" disablePast />);

    fireEvent.click(screen.getByRole("button", { name: "Abrir calendario" }));
    await flush();

    const headers = screen.getAllByRole("columnheader").map((cell) => cell.textContent);
    expect(headers).toEqual(["Lu", "Ma", "Mi", "Ju", "Vi", "Sá", "Do"]);

    const past = container.ownerDocument.querySelector<HTMLButtonElement>('[data-date="2026-11-10"]');
    expect(past).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(past!);
    expect(hidden(container)).toHaveValue("");

    const today = container.ownerDocument.querySelector<HTMLButtonElement>('[data-date="2026-11-13"]')!;
    expect(today).toHaveFocus();
    fireEvent.keyDown(today, { key: "ArrowRight" });
    await flush();
    const next = container.ownerDocument.querySelector<HTMLButtonElement>('[data-date="2026-11-14"]')!;
    expect(next).toHaveFocus();
    fireEvent.keyDown(next, { key: "PageDown" });
    await flush();
    const december = container.ownerDocument.querySelector<HTMLButtonElement>('[data-date="2026-12-14"]')!;
    expect(december).toHaveFocus();
    fireEvent.click(december);

    expect(hidden(container)).toHaveValue("2026-12-14");
    expect(screen.getByLabelText("Fecha")).toHaveValue("14/12/2026");
  });

  it("pone el data-testid en el campo escrito y no envía la fecha si está deshabilitado", () => {
    const { container } = render(<DateField label="Fecha" name="fecha" today="2026-11-13" defaultValue="2026-11-20" disabled />);
    expect(screen.getByTestId("field:fecha").tagName).toBe("INPUT");
    expect(screen.getByTestId("field:fecha")).toHaveValue("20/11/2026");
    expect(hidden(container)).toBeDisabled();
  });

  it("arma fecha y hora en un solo valor ISO local", () => {
    const onChange = vi.fn();
    const { container } = render(<DateTimeField label="Llegada" name="llegada" defaultValue="2026-11-20T14:37" onChange={onChange} />);
    const value = () => container.querySelector<HTMLInputElement>('input[type="hidden"][name="llegada"]');
    expect(value()).toHaveValue("2026-11-20T14:37");
    expect(timeSlots(30, "14:37")).toContain("14:37");
    expect(splitDateTime("2026-11-20 08:15:00")).toEqual({ date: "2026-11-20", time: "08:15" });

    const input = screen.getByTestId("field:llegada");
    fireEvent.change(input, { target: { value: "21112026" } });
    fireEvent.blur(input);
    expect(value()).toHaveValue("2026-11-21T14:37");
    expect(onChange).toHaveBeenCalledWith("2026-11-21T14:37");
  });

  it("habla inglés en el sitio y limpia la fecha", async () => {
    const onChange = vi.fn();
    const { container } = render(<DateField label="Trip date" name="fecha" locale="en" today="2026-11-13" defaultValue="2026-11-20" onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Open calendar" }));
    await flush();
    expect(screen.getAllByRole("columnheader")[0]).toHaveTextContent("Mo");
    expect(screen.getByText("November 2026")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(hidden(container)).toHaveValue("");
    expect(onChange).toHaveBeenCalledWith(null);
  });
});
