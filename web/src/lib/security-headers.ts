export const NONCE_HEADER = "x-nonce";

const isProduction = process.env.NODE_ENV === "production";

export function createNonce(): string {
  return btoa(crypto.randomUUID());
}

export type ExtraSources = Partial<Record<"script" | "style" | "connect" | "frame", string[]>>;

function withSources(base: string[], extra: string[] | undefined): string {
  return [...base, ...(extra ?? []).filter((origin) => /^https:\/\/[a-z0-9.-]+$/i.test(origin) && !base.includes(origin))].join(" ");
}

export function contentSecurityPolicy(nonce: string, frameable = false, ancestors: string[] = [], secure = false, payment: ExtraSources = {}): string {
  const scripts = [`'self'`, `'nonce-${nonce}'`, `'strict-dynamic'`, ...(isProduction ? [] : [`'unsafe-eval'`])];
  return [
    `default-src 'self'`,
    `script-src ${withSources(scripts, payment.script)}`,
    `style-src ${withSources([`'self'`, `'unsafe-inline'`], payment.style)}`,
    `img-src 'self' data: blob: https:`,
    `font-src ${withSources([`'self'`, "data:"], payment.style)}`,
    `connect-src ${withSources([`'self'`], payment.connect)}`,
    `frame-src ${withSources([`'self'`, "https://challenges.cloudflare.com"], payment.frame)}`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    frameable ? ["frame-ancestors 'self'", ...ancestors].join(" ") : `frame-ancestors 'none'`,
    ...(secure ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}

export const STATIC_SECURITY_HEADERS: { key: string; value: string }[] = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(self)" },
];

export const FRAMEABLE_PREFIX = "/sitio/";

export const WIDGET_PREFIX = "/widget/";

export const WIDGET_ASSETS_PREFIX = "/widget/v1/";

export const FRAME_HEADERS = { deny: [{ key: "X-Frame-Options", value: "DENY" }], sameOrigin: [{ key: "X-Frame-Options", value: "SAMEORIGIN" }] };

export const HSTS_HEADER = { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" };

export function isSecureRequest(forwardedProto: string | null, protocol: string): boolean {
  return (forwardedProto?.split(",")[0].trim() ?? protocol.replace(":", "")) === "https";
}
