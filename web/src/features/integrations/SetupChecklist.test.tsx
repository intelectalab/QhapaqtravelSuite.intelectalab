import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { featureOf, pendingItems, type AgencyIntegration, type AgencyMailSummary, type IntegrationReadiness } from "@/lib/integrations";

vi.mock("@/app/(backoffice)/admin/integraciones/correo-actions", () => ({ connectAgencyMail: vi.fn(), disconnectAgencyMail: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }), usePathname: () => "/dashboard" }));

const { SetupChecklist } = await import("./SetupChecklist");
const { AgencyConnections } = await import("./AgencyConnections");

afterEach(cleanup);

const item = (key: AgencyIntegration["key"], status: AgencyIntegration["status"], label: string): AgencyIntegration => ({ key, label, description: `Descripción de ${label}`, status, detail: status === "conectado" ? null : `Falta ${label}`, usable: true, href: `/ir/${key}`, cta: status === "conectado" ? "Ver conexión" : `Conectar ${label}` });

const readiness = (overrides: Partial<IntegrationReadiness> = {}): IntegrationReadiness => ({
  enforced: false,
  items: [item("email", "sin_configurar", "Correo de salida"), item("whatsapp", "conectado", "Número de WhatsApp"), item("ose", "en_proceso", "Facturación electrónica"), item("payments", "sin_configurar", "Pasarela de pago")],
  pending: 3,
  features: { sales_ai: { available: false, label: "Asistente de ventas con IA", message: "Próximamente." } } as IntegrationReadiness["features"],
  can_manage: true,
  ...overrides,
});

const mail: AgencyMailSummary = {
  status: "sin_configurar",
  provider: null,
  address: "",
  from_name: "",
  host: null,
  port: null,
  encryption: null,
  password_set: false,
  verified_at: null,
  providers: [
    { value: "gmail", label: "Gmail o Google Workspace", help: "Crea una contraseña de aplicación.", host: "smtp.gmail.com", port: 465, encryption: "ssl" },
    { value: "otro", label: "Otro servidor", help: "Pide los datos a tu hosting.", host: null, port: null, encryption: null },
  ],
};

describe("integraciones de la agencia", () => {
  it("solo cuenta como pendiente lo que no está conectado", () => {
    expect(pendingItems(readiness()).map((row) => row.key)).toEqual(["email", "ose", "payments"]);
    expect(pendingItems(null)).toEqual([]);
    expect(featureOf(readiness(), "sales_ai").available).toBe(false);
    expect(featureOf(null, "ota").available).toBe(true);
  });

  it("el inicio muestra «Completa tu configuración» con lo que falta y el avance", () => {
    render(<SetupChecklist readiness={readiness()} />);
    const card = screen.getByTestId("setup-checklist");
    expect(within(card).getByText("Completa tu configuración")).toBeInTheDocument();
    expect(within(card).getByText("1 de 4 listas")).toBeInTheDocument();
    expect(within(card).queryByTestId("connection-whatsapp")).toBeNull();
    expect(within(card).getByTestId("connection-email")).toHaveAttribute("data-status", "sin_configurar");
    expect(within(card).getByRole("progressbar")).toHaveAttribute("aria-valuenow", "1");
    expect(within(card).getByText("Conectar Correo de salida").closest("a")).toHaveAttribute("href", "/admin/integraciones?conectar=correo");
  });

  it("no aparece para quien no administra ni cuando todo está conectado", () => {
    const { container, rerender } = render(<SetupChecklist readiness={readiness({ can_manage: false })} />);
    expect(container).toBeEmptyDOMElement();
    rerender(<SetupChecklist readiness={readiness({ items: [item("email", "conectado", "Correo de salida")], pending: 0 })} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("en Integraciones el correo se conecta en un panel con el proveedor y la clave de aplicación", () => {
    render(<AgencyConnections items={readiness().items} mail={mail} manage openMail={false} />);
    expect(screen.getByText("1 de 4 conectadas")).toBeInTheDocument();
    expect(screen.getAllByText("Sin configurar")).toHaveLength(2);
    fireEvent.click(screen.getByTestId("connect-email"));
    expect(screen.getByText("Conecta tu correo")).toBeInTheDocument();
    expect(screen.getByLabelText("Clave de aplicación")).toBeRequired();
    expect(screen.getByTestId("mail-provider-help")).toHaveTextContent("Gmail o Google Workspace");
    expect(screen.queryByLabelText("Servidor SMTP")).toBeNull();
    fireEvent.click(screen.getByTestId("option:otro"));
    expect(screen.getByLabelText("Servidor SMTP")).toBeRequired();
  });

  it("sin permiso de administrar no ofrece botones para conectar", () => {
    render(<AgencyConnections items={readiness().items} mail={null} manage={false} openMail={false} />);
    expect(screen.queryByTestId("connect-email")).toBeNull();
    expect(screen.queryByTestId("connect-ose")).toBeNull();
  });
});
