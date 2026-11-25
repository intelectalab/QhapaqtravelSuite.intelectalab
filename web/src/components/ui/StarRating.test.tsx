import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { StarRating } from "./StarRating";

afterEach(cleanup);

const hidden = (container: HTMLElement) => container.querySelector<HTMLInputElement>('input[name="nota"]');

describe("calificación con estrellas del portal", () => {
  it("guarda la nota elegida en el formulario y la nombra", () => {
    const { container } = render(<StarRating label="Guía" name="nota" hint="Elige de 1 a 5" />);
    expect(screen.getByText("Elige de 1 a 5")).toBeInTheDocument();
    expect(hidden(container)?.value).toBe("");

    fireEvent.click(screen.getByRole("radio", { name: "4 de 5" }));
    expect(hidden(container)?.value).toBe("4");
    expect(screen.getByRole("radio", { name: "4 de 5" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByText("Muy bueno")).toBeInTheDocument();
  });

  it("si no es obligatoria, volver a tocar la misma estrella la quita", () => {
    const { container } = render(<StarRating label="Hotel" name="nota" defaultValue={3} />);
    fireEvent.click(screen.getByRole("radio", { name: "3 de 5" }));
    expect(hidden(container)?.value).toBe("");
  });

  it("si es obligatoria, la nota no se puede quitar", () => {
    const { container } = render(<StarRating label="Viaje" name="nota" required defaultValue={5} />);
    fireEvent.click(screen.getByRole("radio", { name: "5 de 5" }));
    expect(hidden(container)?.value).toBe("5");
    expect(screen.getByText("Excelente")).toBeInTheDocument();
  });
});
