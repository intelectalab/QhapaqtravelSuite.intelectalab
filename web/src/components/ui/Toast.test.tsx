import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Toaster, toast } from "./Toast";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("Toaster", () => {
  it("muestra el aviso con su variante y lo retira solo", () => {
    vi.useFakeTimers();
    render(<Toaster />);
    act(() => {
      toast("Pago registrado y aplicado a la cuota.");
      toast("No pudimos emitir el comprobante.", "bad");
    });
    const items = screen.getAllByTestId("toast");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveAttribute("data-variant", "ok");
    expect(items[1]).toHaveAttribute("data-variant", "bad");
    expect(items[1]).toHaveAttribute("role", "alert");
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(screen.queryAllByTestId("toast")).toHaveLength(0);
  });

  it("se cierra con el botón", () => {
    render(<Toaster />);
    act(() => {
      toast("Cambios guardados.");
    });
    fireEvent.click(screen.getByRole("button", { name: "Cerrar aviso" }));
    expect(screen.queryAllByTestId("toast")).toHaveLength(0);
  });
});
