import type { Branding } from "@/lib/me";

const HEX = /^#[0-9a-f]{6}$/i;

const contrast = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.6 ? "#141a33" : "#ffffff";
};

export function BrandStyle({ branding }: { branding?: Branding | null }) {
  if (!branding) return null;
  const brand = HEX.test(branding.brand) ? branding.brand : null;
  const accent = HEX.test(branding.accent) ? branding.accent : null;
  const menu = HEX.test(branding.menu) ? branding.menu : null;
  const shared = brand ? `--brand:${brand};--brand-fg:${contrast(brand)};` : "";
  const light = `${accent ? `--accent:${accent};` : ""}${menu ? `--menu:${menu};` : ""}`;
  if (!shared && !light) return null;
  return <style>{`html{${shared}}html:not([data-theme="dark"]){${light}}`}</style>;
}
