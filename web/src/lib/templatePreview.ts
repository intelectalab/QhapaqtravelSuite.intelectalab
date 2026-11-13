export const TEMPLATE_PREVIEW_COOKIE = "kc_tpl_preview";

export const TEMPLATE_PREVIEW_SECONDS = 60 * 60 * 24;

export interface TemplatePreview {
  code: string;
  name: string;
  version: string | null;
}

export interface PublicSiteTheme {
  template: { code: string; slug: string; name: string } | null;
  version: string | null;
  site_style: "actual" | "andes" | null;
  preview: boolean;
  noindex: boolean;
  expires_at: string | null;
}

export function templatePreviewToken(value: string | null | undefined): string | null {
  return value && /^[A-Za-z0-9]{32,64}$/.test(value) ? value : null;
}
