import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { assistantReturnPath, onComposerFill, orderedKinds, quotaLine, sendToComposer, suggestedPrompt, type AssistantContext } from "@/lib/assistant";

vi.mock("@/app/(backoffice)/asistente/actions", () => ({ askAssistant: vi.fn(), assistantStep: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }), usePathname: () => "/inbox" }));

const { AssistantSidePanel } = await import("./AssistantSidePanel");

afterEach(cleanup);

const KINDS = { itinerary: "Itinerario", quote_draft: "Borrador de cotización", reply_draft: "Respuesta al cliente", summary: "Resumen" };

const context = (overrides: Partial<AssistantContext> = {}): AssistantContext => ({
  source: { type: "conversation", label: "Conversación", code: "CNV-0042", title: "Viaje a Cusco" },
  facts: [
    { key: "client", label: "Contacto", value: "Ana" },
    { key: "channel", label: "Canal", value: "WhatsApp" },
    { key: "last", label: "Último del cliente", value: "Quiero ir a Cusco en mayo" },
  ],
  usage: { enabled: true, limit: 100, remaining: 37, exhausted: false, warning: false },
  kinds: KINDS,
  recent: [
    { id: "r1", kind: "reply_draft", kind_label: "Respuesta al cliente", status: "completed", prompt: "Responde", source: { type: "conversation", label: "Conversación", code: "CNV-0042" }, text: "Hola Ana, gracias por escribirnos.", tokens_in: 10, tokens_out: 20, cost_usd: "0.0001", error: null, created_at: "2026-11-24T10:00:00Z", applied_at: null },
  ],
  ...overrides,
});

describe("lógica del asistente lateral", () => {
  it("ordena los tipos de pedido según el registro", () => {
    expect(orderedKinds("conversation", KINDS).map((kind) => kind.value)).toEqual(["reply_draft", "summary", "itinerary", "quote_draft"]);
    expect(orderedKinds("quote", KINDS)[0]?.value).toBe("quote_draft");
    expect(orderedKinds("lead", KINDS)[0]?.value).toBe("itinerary");
  });

  it("propone un pedido con el nombre y el destino del registro", () => {
    const facts = [
      { key: "client", label: "Cliente", value: "Luis" },
      { key: "destinations", label: "Destinos", value: "Cusco, Puno" },
    ];
    expect(suggestedPrompt("quote", "itinerary", facts)).toBe("Arma un itinerario día por día para Luis en Cusco, Puno.");
    expect(suggestedPrompt("conversation", "reply_draft", [{ key: "client", label: "Contacto", value: "Sin nombre" }])).toContain("el cliente");
    expect(suggestedPrompt("lead", "summary", facts).length).toBeGreaterThanOrEqual(8);
  });

  it("solo revalida rutas propias del back-office", () => {
    expect(assistantReturnPath("/cotizaciones/COT-2026-00191")).toBe("/cotizaciones/COT-2026-00191");
    expect(assistantReturnPath("/inbox?c=CNV-0042")).toBe("/inbox");
    expect(assistantReturnPath("/crm/leads/LEA-0003#notas")).toBe("/crm/leads/LEA-0003");
    expect(assistantReturnPath("https://otro.com/cotizaciones/x")).toBeNull();
    expect(assistantReturnPath("//otro.com/inbox")).toBeNull();
    expect(assistantReturnPath("/cotizaciones/../admin")).toBeNull();
    expect(assistantReturnPath("/admin/usuarios")).toBeNull();
    expect(assistantReturnPath(null)).toBeNull();
  });

  it("describe el cupo restante, agotado o sin límite", () => {
    expect(quotaLine({ enabled: true, limit: 1000, remaining: 950, exhausted: false, warning: false })).toBe("Quedan 950 de 1 000 pedidos este mes.");
    expect(quotaLine({ enabled: true, limit: 100, remaining: 0, exhausted: true, warning: true })).toBe("La agencia ya usó los 100 pedidos del mes.");
    expect(quotaLine({ enabled: true, limit: null, remaining: null, exhausted: false, warning: false })).toBe("Tu plan no tiene cupo mensual de pedidos.");
  });

  it("entrega el borrador solo a la respuesta de su conversación", () => {
    const fill = vi.fn();
    const other = vi.fn();
    const stop = onComposerFill("CNV-0042", fill);
    const stopOther = onComposerFill("CNV-0043", other);
    sendToComposer("CNV-0042", "Hola Ana");
    expect(fill).toHaveBeenCalledWith("Hola Ana");
    expect(other).not.toHaveBeenCalled();
    stop();
    stopOther();
    sendToComposer("CNV-0042", "Otra vez");
    expect(fill).toHaveBeenCalledTimes(1);
  });
});

describe("AssistantSidePanel", () => {
  it("sin proveedor muestra Próximamente y no deja pedir", () => {
    render(<AssistantSidePanel source={{ type: "quote", code: "COT-2026-00191" }} context={null} available={false} unavailableMessage="El asistente de ventas con IA estará disponible próximamente." returnPath="/cotizaciones/COT-2026-00191" />);
    fireEvent.click(screen.getByTestId("assistant-side-open"));
    expect(screen.getByTestId("coming-soon")).toHaveTextContent("Próximamente");
    expect(screen.queryByTestId("assistant-side-ask")).not.toBeInTheDocument();
  });

  it("abre con el contexto cargado, el pedido sugerido y el botón Responder en la bandeja", () => {
    render(<AssistantSidePanel source={{ type: "conversation", code: "CNV-0042" }} context={context()} available returnPath="/inbox" />);
    fireEvent.click(screen.getByTestId("assistant-side-open"));
    expect(screen.getByTestId("assistant-context")).toHaveTextContent("Quiero ir a Cusco en mayo");
    expect(screen.getByTestId("field:kind")).toHaveAttribute("data-value", "reply_draft");
    expect(screen.getByTestId("field:prompt")).toHaveValue("Responde con amabilidad al último mensaje de Ana y propón el siguiente paso.");
    fireEvent.click(screen.getByTestId("option:summary"));
    expect(screen.getByTestId("field:prompt")).toHaveValue("Resume la conversación con Ana: qué pide, fechas y dudas pendientes.");
    expect(screen.getByRole("button", { name: "Responder" })).toBeInTheDocument();
    expect(screen.getByText("Quedan 37 de 100 pedidos este mes.")).toBeInTheDocument();
  });

  it("con el cupo agotado desactiva el pedido", () => {
    render(<AssistantSidePanel source={{ type: "lead", code: "LEA-0003" }} context={context({ source: { type: "lead", label: "Lead", code: "LEA-0003", title: "Ana Pérez" }, usage: { enabled: true, limit: 100, remaining: 0, exhausted: true, warning: true }, recent: [] })} available returnPath="/crm/leads/LEA-0003" />);
    fireEvent.click(screen.getByTestId("assistant-side-open"));
    expect(screen.getByTestId("assistant-side-ask")).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Responder" })).not.toBeInTheDocument();
  });
});
