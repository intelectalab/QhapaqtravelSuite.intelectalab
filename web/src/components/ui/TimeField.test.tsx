import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { maskTypedTime, nearestSlot, parseTypedTime, timeSlots } from "@/lib/date-field";
import { TimeField } from "./TimeField";

beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  globalThis.requestAnimationFrame = (callback: FrameRequestCallback) => setTimeout(() => callback(0), 0) as unknown as number;
  globalThis.cancelAnimationFrame = (handle: number) => clearTimeout(handle);
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(cleanup);

const flush = () => act(() => new Promise((resolve) => setTimeout(resolve, 5)));

const hidden = (container: HTMLElement) => container.querySelector<HTMLInputElement>('input[type="hidden"][name="hora"]');

describe("ayudantes de hora", () => {
  it("lee la hora escrita a mano", () => {
    expect(parseTypedTime("04:10")).toBe("04:10");
    expect(parseTypedTime("930")).toBe("09:30");
    expect(parseTypedTime("9")).toBe("09:00");
    expect(parseTypedTime("9:5")).toBe("09:05");
    expect(parseTypedTime("15.20")).toBe("15:20");
    expect(parseTypedTime("24:00")).toBeNull();
    expect(parseTypedTime("08:61")).toBeNull();
    expect(maskTypedTime("0410")).toBe("04:10");
    expect(maskTypedTime("abc5")).toBe("5");
  });

  it("arma la grilla de 5 minutos y busca la más cercana", () => {
    expect(timeSlots(5)).toHaveLength(288);
    expect(timeSlots(5)).toContain("04:10");
    expect(timeSlots(15)).not.toContain("04:10");
    expect(nearestSlot(timeSlots(15), "04:10")).toBe("04:15");
    expect(nearestSlot(timeSlots(5), "13:58")).toBe("14:00");
  });
});

describe("TimeField", () => {
  it("guarda la hora escrita a mano fuera de la grilla", () => {
    const onChange = vi.fn();
    const { container } = render(<TimeField label="Hora" name="hora" step={5} defaultValue="08:00:00" onChange={onChange} />);
    expect(hidden(container)).toHaveValue("08:00");

    const input = screen.getByTestId("field:hora");
    fireEvent.change(input, { target: { value: "0412" } });
    fireEvent.blur(input);
    expect(hidden(container)).toHaveValue("04:12");
    expect(onChange).toHaveBeenCalledWith("04:12");

    fireEvent.change(input, { target: { value: "2575" } });
    fireEvent.blur(input);
    expect(screen.getByText("Escribe la hora como hh:mm, de 00:00 a 23:59.")).toBeInTheDocument();
    expect(hidden(container)).toHaveValue("04:12");
  });

  it("la lista abre en la hora elegida y permite elegir otra", async () => {
    const { container } = render(<TimeField label="Hora" name="hora" step={5} defaultValue="15:20" required />);
    fireEvent.click(screen.getByRole("button", { name: "Elegir la hora" }));
    await flush();

    const selected = screen.getByRole("option", { name: "15:20" });
    expect(selected).toHaveAttribute("aria-selected", "true");
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
    expect(screen.getAllByRole("option")).toHaveLength(288);

    fireEvent.click(screen.getByRole("option", { name: "15:25" }));
    expect(hidden(container)).toHaveValue("15:25");
  });

  it("sin hora elegida la lista se ubica cerca de la hora actual", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true, now: new Date("2026-11-16T15:56:00-05:00") });
    render(<TimeField label="Hora" name="hora" step={15} />);
    fireEvent.click(screen.getByRole("button", { name: "Elegir la hora" }));
    await flush();
    expect(screen.getByRole("option", { name: "16:00" })).toHaveAttribute("data-anchor", "true");
    expect(screen.getByRole("option", { name: "00:00" })).not.toHaveAttribute("data-anchor");
    vi.useRealTimers();
  });
});
