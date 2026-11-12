export const ANALYTICS_CONSENT_KEY = "site_cookie_consent";

export const COOKIE_POLICY_VERSION = "v1.0";

export const COOKIE_PREFERENCES_EVENT = "site:cookie-preferences";

export const SITE_TRACK_EVENT = "site:track";

export type SiteEventName = "page_view" | "view_item" | "view_item_list" | "add_to_cart" | "view_cart" | "begin_checkout" | "purchase" | "purchase_pending" | "search" | "generate_lead" | "share" | "contact_whatsapp";

export interface SiteEvent {
  event: SiteEventName;
  params?: Record<string, string | number | boolean | null>;
}

export function trackSiteEvent(event: SiteEventName, params: SiteEvent["params"] = {}): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<SiteEvent>(SITE_TRACK_EVENT, { detail: { event, params } }));
}
