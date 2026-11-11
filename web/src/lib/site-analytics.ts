export const ANALYTICS_CONSENT_KEY = "site_analytics_consent";

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
