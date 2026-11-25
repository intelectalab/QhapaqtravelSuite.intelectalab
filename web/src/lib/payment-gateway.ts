export type GatewayProvider = "sandbox" | "izipay" | "culqi" | "niubiz" | "mercadopago";

export type CspDirective = "script" | "style" | "connect" | "frame";

export interface GatewayInfo {
  provider: GatewayProvider;
  label: string;
  mode: "sandbox" | "produccion";
  embedded: boolean;
  sources?: Partial<Record<CspDirective, string[]>>;
}

export interface GatewayEmbed {
  provider: GatewayProvider;
  label?: string;
  mode?: "sandbox" | "produccion";
  script?: string;
  theme_css?: string;
  theme_js?: string;
  public_key?: string;
  form_token?: string;
  session_key?: string;
  merchant_id?: string;
  purchase_number?: string;
  amount?: string | number;
  currency?: string;
  email?: string;
  title?: string;
}

export interface GatewaySession {
  session_id: string;
  gateway: string;
  amount: string;
  currency: string;
  expires_at: string;
  embed: GatewayEmbed | string | null;
}

export type SessionResult = { ok: true; session: GatewaySession } | { ok: false; message: string };

export type PayResult = { ok: boolean; message: string | null };

export const LOCAL_GATEWAY: GatewayInfo = { provider: "sandbox", label: "Pasarela de prueba", mode: "sandbox", embedded: false };

const PROVIDERS: GatewayProvider[] = ["sandbox", "izipay", "culqi", "niubiz", "mercadopago"];

const ORIGIN = /^https:\/\/[a-z0-9.-]+\.[a-z]{2,}$/i;

export function parseGatewayInfo(value: unknown): GatewayInfo {
  if (!value || typeof value !== "object") return LOCAL_GATEWAY;
  const raw = value as Record<string, unknown>;
  const provider = PROVIDERS.find((item) => item === raw.provider) ?? "sandbox";
  const sources: Partial<Record<CspDirective, string[]>> = {};
  const given = raw.sources && typeof raw.sources === "object" ? (raw.sources as Record<string, unknown>) : {};
  for (const directive of ["script", "style", "connect", "frame"] as const) {
    const list = given[directive];
    if (Array.isArray(list)) sources[directive] = list.filter((item): item is string => typeof item === "string" && ORIGIN.test(item));
  }
  return { provider, label: typeof raw.label === "string" ? raw.label : LOCAL_GATEWAY.label, mode: raw.mode === "produccion" ? "produccion" : "sandbox", embedded: provider !== "sandbox" && raw.embedded === true, sources };
}

export function embedOf(session: GatewaySession): GatewayEmbed {
  return session.embed && typeof session.embed === "object" ? session.embed : { provider: "sandbox" };
}

export function testModeNote(info: Pick<GatewayInfo, "provider" | "label" | "mode">): string | null {
  return info.provider !== "sandbox" && info.mode !== "produccion" ? `${info.label} está en modo prueba: usa sus tarjetas de prueba; no se cobra dinero real.` : null;
}

const loading = new Map<string, Promise<void>>();

export function loadScript(src: string, attributes: Record<string, string> = {}): Promise<void> {
  const known = loading.get(src);
  if (known) return known;
  const promise = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    for (const [name, value] of Object.entries(attributes)) script.setAttribute(name, value);
    script.onload = () => resolve();
    script.onerror = () => {
      loading.delete(src);
      script.remove();
      reject(new Error("script"));
    };
    document.head.appendChild(script);
  });
  loading.set(src, promise);
  return promise;
}

export function loadStyle(href: string): void {
  if (document.querySelector(`link[data-gateway="${href}"]`)) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  link.dataset.gateway = href;
  document.head.appendChild(link);
}
