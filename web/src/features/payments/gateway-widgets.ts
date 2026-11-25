import { loadScript, loadStyle, type GatewayEmbed } from "@/lib/payment-gateway";

export interface WidgetHandlers {
  container: string;
  onToken: (token: string) => Promise<void> | void;
  onError: (message: string) => void;
  onClose?: () => void;
}

type Cleanup = () => void;

interface KryptonEvent {
  rawClientAnswer?: string;
  hash?: string;
  hashKey?: string;
}

interface Krypton {
  setFormConfig: (config: Record<string, string>) => Promise<unknown>;
  renderElements: (selector: string) => Promise<unknown>;
  onSubmit: (callback: (event: KryptonEvent) => boolean) => Promise<unknown>;
  onError: (callback: (event: { errorMessage?: string }) => void) => Promise<unknown>;
  removeForms?: () => Promise<unknown>;
}

interface CulqiGlobal {
  publicKey: string;
  settings: (config: Record<string, unknown>) => void;
  options: (config: Record<string, unknown>) => void;
  open: () => void;
  close: () => void;
  token?: { id: string } | null;
  error?: { user_message?: string } | null;
}

interface NiubizGlobal {
  configure: (config: Record<string, unknown>) => void;
  open: () => void;
}

interface BrickController {
  unmount: () => void;
}

interface MercadoPagoInstance {
  bricks: () => { create: (kind: string, container: string, settings: Record<string, unknown>) => Promise<BrickController> };
}

type GatewayWindow = Window & {
  KR?: Krypton;
  Culqi?: CulqiGlobal;
  culqi?: () => void;
  VisanetCheckout?: NiubizGlobal;
  MercadoPago?: new (key: string, options?: Record<string, unknown>) => MercadoPagoInstance;
};

const NOT_LOADED = "No pudimos cargar el formulario de pago. Revisa tu conexión y vuelve a intentarlo.";

function win(): GatewayWindow {
  return window as GatewayWindow;
}

async function izipay(embed: GatewayEmbed, handlers: WidgetHandlers): Promise<Cleanup> {
  if (embed.theme_css) loadStyle(embed.theme_css);
  await loadScript(String(embed.script), { "kr-public-key": String(embed.public_key ?? ""), "kr-language": "es-ES" });
  if (embed.theme_js) await loadScript(embed.theme_js);
  const kr = win().KR;
  if (!kr) throw new Error("izipay");
  await kr.setFormConfig({ formToken: String(embed.form_token ?? ""), "kr-language": "es-ES" });
  await kr.renderElements(`#${handlers.container}`);
  await kr.onError((event) => handlers.onError(event.errorMessage ?? "Revisa los datos de la tarjeta."));
  await kr.onSubmit((event) => {
    void handlers.onToken(JSON.stringify({ "kr-answer": event.rawClientAnswer ?? "", "kr-hash": event.hash ?? "", "kr-hash-key": event.hashKey ?? "" }));
    return false;
  });
  return () => void kr.removeForms?.();
}

async function culqi(embed: GatewayEmbed, handlers: WidgetHandlers): Promise<Cleanup> {
  await loadScript(String(embed.script));
  const sdk = win().Culqi;
  if (!sdk) throw new Error("culqi");
  sdk.publicKey = String(embed.public_key ?? "");
  sdk.settings({ title: embed.title ?? "Pago con tarjeta", currency: embed.currency ?? "PEN", amount: Number(embed.amount ?? 0) });
  sdk.options({ lang: "auto", installments: false, paymentMethods: { tarjeta: true, yape: false, bancaMovil: false, agente: false, billetera: false, cuotealo: false } });
  win().culqi = () => {
    const current = win().Culqi;
    if (current?.token?.id) {
      const id = current.token.id;
      current.close();
      void handlers.onToken(id);
    } else if (current?.error) {
      handlers.onError(current.error.user_message ?? "Revisa los datos de la tarjeta.");
    }
  };
  sdk.open();
  return () => {
    win().culqi = undefined;
  };
}

async function niubiz(embed: GatewayEmbed, handlers: WidgetHandlers): Promise<Cleanup> {
  await loadScript(String(embed.script));
  const sdk = win().VisanetCheckout;
  if (!sdk) throw new Error("niubiz");
  sdk.configure({
    sessiontoken: embed.session_key,
    channel: "web",
    merchantid: embed.merchant_id,
    purchasenumber: embed.purchase_number,
    amount: String(embed.amount ?? ""),
    expirationminutes: "20",
    timeouturl: window.location.href,
    merchantname: embed.title ?? "",
    formbuttoncolor: "#1f2937",
    action: window.location.href,
    complete: (params: { transactionToken?: string }) => {
      if (params?.transactionToken) void handlers.onToken(params.transactionToken);
      else handlers.onError("Niubiz no confirmó la tarjeta. Vuelve a intentarlo.");
    },
  });
  sdk.open();
  return () => undefined;
}

async function mercadopago(embed: GatewayEmbed, handlers: WidgetHandlers): Promise<Cleanup> {
  await loadScript(String(embed.script));
  const Sdk = win().MercadoPago;
  if (!Sdk) throw new Error("mercadopago");
  const mp = new Sdk(String(embed.public_key ?? ""), { locale: "es-PE" });
  const controller = await mp.bricks().create("cardPayment", handlers.container, {
    initialization: { amount: Number(embed.amount ?? 0), payer: { email: embed.email ?? "" } },
    customization: { paymentMethods: { maxInstallments: 1 }, visual: { hideFormTitle: true } },
    callbacks: {
      onReady: () => undefined,
      onSubmit: (formData: unknown) => Promise.resolve(handlers.onToken(JSON.stringify(formData))),
      onError: () => handlers.onError("Revisa los datos de la tarjeta."),
    },
  });
  return () => controller.unmount();
}

const MOUNTERS: Record<string, (embed: GatewayEmbed, handlers: WidgetHandlers) => Promise<Cleanup>> = { izipay, culqi, niubiz, mercadopago };

export function inlineWidget(provider: string): boolean {
  return provider === "izipay" || provider === "mercadopago";
}

export async function mountWidget(embed: GatewayEmbed, handlers: WidgetHandlers): Promise<Cleanup> {
  const mount = MOUNTERS[embed.provider];
  if (!mount) throw new Error("provider");
  try {
    return await mount(embed, handlers);
  } catch {
    handlers.onError(NOT_LOADED);
    return () => undefined;
  }
}
