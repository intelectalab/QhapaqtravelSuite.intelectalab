export const ANALYTICS_CONSENT_KEY = "site_cookie_consent";

export const COOKIE_POLICY_VERSION = "v1.0";

export const COOKIE_PREFERENCES_EVENT = "site:cookie-preferences";

export const SITE_TRACK_EVENT = "site:track";

export type SiteEventName =
  | "page_view"
  | "search"
  | "view_item_list"
  | "view_item"
  | "add_to_wishlist"
  | "remove_from_wishlist"
  | "add_to_cart"
  | "remove_from_cart"
  | "view_cart"
  | "apply_promo"
  | "select_promotion"
  | "begin_checkout"
  | "add_shipping_info"
  | "add_payment_info"
  | "payment_failed"
  | "purchase"
  | "purchase_pending"
  | "purchase_balance"
  | "generate_lead"
  | "sign_up"
  | "sign_up_newsletter"
  | "login"
  | "share"
  | "contact_whatsapp"
  | "select_language"
  | "select_currency"
  | "claim_submitted";

export interface SiteEvent {
  event: SiteEventName;
  params?: Record<string, string | number | boolean | null>;
}

export function trackSiteEvent(event: SiteEventName, params: SiteEvent["params"] = {}): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<SiteEvent>(SITE_TRACK_EVENT, { detail: { event, params } }));
}
