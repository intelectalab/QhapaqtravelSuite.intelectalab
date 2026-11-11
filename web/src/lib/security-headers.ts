export const NONCE_HEADER = "x-nonce";

const isProduction = process.env.NODE_ENV === "production";

export function createNonce(): string {
  return btoa(crypto.randomUUID());
}

export function contentSecurityPolicy(nonce: string, frameable = false, ancestors: string[] = []): string {
  const scripts = [`'self'`, `'nonce-${nonce}'`, `'strict-dynamic'`, ...(isProduction ? [] : [`'unsafe-eval'`])];
  return [
    `default-src 'self'`,
    `script-src ${scripts.join(" ")}`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: blob: https:`,
    `font-src 'self' data:`,
    `connect-src 'self'`,
    `frame-src 'self' https://challenges.cloudflare.com`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    frameable ? ["frame-ancestors 'self'", ...ancestors].join(" ") : `frame-ancestors 'none'`,
    ...(isProduction ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}

export const STATIC_SECURITY_HEADERS: { key: string; value: string }[] = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(self)" },
  ...(isProduction ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }] : []),
];

export const FRAMEABLE_PREFIX = "/sitio/";

export const WIDGET_PREFIX = "/widget/";

export const WIDGET_ASSETS_PREFIX = "/widget/v1/";

export const FRAME_HEADERS = { deny: [{ key: "X-Frame-Options", value: "DENY" }], sameOrigin: [{ key: "X-Frame-Options", value: "SAMEORIGIN" }] };
