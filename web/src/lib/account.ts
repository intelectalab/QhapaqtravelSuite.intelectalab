export interface UserNotification {
  id: string;
  code: string | null;
  event_code: string;
  event_label: string;
  channel: string;
  subject: string;
  body: string | null;
  source_type: string | null;
  status: string;
  created_at: string;
  read_at: string | null;
  read: boolean;
  href?: string | null;
}

export interface NotificationFeed {
  items: UserNotification[];
  unread: number;
  canViewLog: boolean;
}

export interface SearchHit {
  type: string;
  type_label: string;
  code: string;
  title: string;
  subtitle: string | null;
  href: string;
}

export interface SearchResult {
  items: SearchHit[];
  scope: "own" | "tenant" | "platform";
  message: string | null;
}

export interface AccessRequestState {
  message: string | null;
  done: boolean;
}

export interface TenantProfile {
  id: string;
  code: string;
  commercial_name: string;
  legal_name: string;
  ruc: string | null;
  country: string | null;
  subdomain: string | null;
  initials: string | null;
  status: string;
  status_label: string;
  trial_ends_at: string | null;
  plan: { code: string; name: string } | null;
  timezone: string;
  locale: string | null;
  date_format: string | null;
  base_currency: string;
  alt_currency: string | null;
  tax_pct: number | null;
  price_with_tax: boolean;
  contact: { email: string | null; phone: string | null; web: string | null };
  main_sede: { id: string; name: string; city: string | null } | null;
  my_sede: { id: string; name: string } | null;
  sedes: number;
  active_users: number;
  channels: { key: string; label: string }[];
}

export const SEARCH_MIN = 2;
