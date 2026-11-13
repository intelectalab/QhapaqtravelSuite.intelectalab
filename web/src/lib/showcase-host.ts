export const SHOWCASE_PREFIX = "/vitrina";

export function showcaseDomain(): string | null {
  return process.env.SHOWCASE_DOMAIN?.trim().toLowerCase() || null;
}

export function isShowcaseHost(host: string | null): boolean {
  const domain = showcaseDomain();
  const hostname = (host ?? "").split(",")[0].trim().split(":")[0].toLowerCase();
  return domain !== null && (hostname === domain || hostname === `www.${domain}`);
}

export function showcasePath(host: string | null, pathname: string): string | null {
  if (!isShowcaseHost(host)) return null;
  if (pathname === SHOWCASE_PREFIX || pathname.startsWith(`${SHOWCASE_PREFIX}/`) || pathname.startsWith("/_next/")) return null;
  return pathname === "/" ? SHOWCASE_PREFIX : `${SHOWCASE_PREFIX}${pathname}`;
}
