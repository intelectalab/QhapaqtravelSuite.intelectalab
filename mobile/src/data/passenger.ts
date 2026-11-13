import { Linking } from "react-native";
import { useCallback, useEffect, useState } from "react";
import { api, ApiRequestError } from "../api/client";
import { getState, setState } from "../offline/db";
import { useApp } from "../state/AppProvider";

export interface PaxService {
  code: string;
  name: string;
  date: string;
  time: string | null;
  kind: string;
  status: string;
  state: string;
  pax: number;
  nights: number | null;
  confirmation: string | null;
  guide?: { name: string; phone: string | null } | string | null;
  driver?: { name: string; phone: string | null } | string | null;
  vehicle?: string | null;
  guide_languages?: string[];
  meeting_point?: string | null;
  provider?: { name: string; phone: string | null } | null;
  includes?: string[];
}

export interface Stay {
  hotel: string;
  city: string | null;
  check_in: string;
  check_out: string;
  room: string | null;
  room_type: string | null;
}

export interface CriticalAlert {
  id: string;
  code: string;
  severity: string;
  title: string;
  message: string | null;
}

export interface Contact {
  name: string;
  phone: string | null;
  email?: string | null;
}

export interface Trip {
  today: string;
  code: string;
  title: string;
  status: string;
  phase: string;
  from: string;
  to: string;
  day: number;
  days_total: number;
  days_left: number;
  today_services: PaxService[];
  next: PaxService | null;
  passengers: { seq: number; name: string; type: string; nationality: string | null; document: string | null; lead: boolean; missing: boolean }[];
  advisor: Contact | null;
  alerts: number;
  next_detail: (PaxService & { starts_at: string }) | null;
  critical_alert: CriticalAlert | null;
  hotel: Stay | null;
}

export interface Itinerary {
  code: string;
  days: { date: string; number: number; services: PaxService[]; stay: Stay | null }[];
}

export interface TravelDocLine {
  passenger: string;
  status: string | null;
  number?: string | null;
  document?: string | null;
  nationality?: string | null;
  expires_on: string | null;
  note?: string | null;
}

export interface FeedbackOverview {
  trip: { code: string; title: string };
  types: { value: string; label: string }[];
  services: { code: string; name: string; date: string }[];
  history: { code: string; type: string; type_label: string; rating: number | null; text: string; status: string; reply: string | null; created_at: string; service: string | null }[];
}

export interface ReviewItem {
  product: { id: string; code: string; name: string };
  date: string;
  eligible: boolean;
  reason: string | null;
  review: { code: string; stars: number; title: string; status: string } | null;
}

export interface ReviewOverview {
  trip: { code: string; title: string; status: string };
  subratings: { key: string; label: string }[];
  items: ReviewItem[];
}

export interface Vouchers {
  code: string;
  items: { code: string; label: string; date: string; status: string; version: number; pax: number }[];
}

export interface Documents {
  code: string;
  items: { kind: string; code?: string; label: string; available: boolean }[];
  policy: { cancellation: string | null; tiers: unknown[] };
  invoices?: { number: string; type: string; date: string; status: string }[];
  insurance?: TravelDocLine[];
  passports?: TravelDocLine[];
}

export interface Alerts {
  code: string;
  alerts: { id: string; code: string; type: string; severity: string; title: string; message: string | null; at: string; acked: boolean }[];
  notices: { code: string; subject: string; body: string; at: string; channel: string; read?: boolean }[];
}

export function unreadAlerts(data: Alerts | null): number {
  if (!data) return 0;
  return data.alerts.filter((alert) => !alert.acked).length + data.notices.filter((notice) => notice.read === false).length;
}

export interface Messages {
  code: string;
  unread: number;
  items: { id: string; from: string; sender: string; body: string; read: boolean; at: string }[];
}

export interface Support {
  code: string;
  emergency: { label: string; phone: string; office: { name: string; phone: string | null; address: string | null } | null } | null;
  coordinator: Contact | null;
  advisor: Contact | null;
  guide: (Contact & { service?: string; date?: string }) | null;
}

export interface Remote<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  stale: boolean;
  reload: () => Promise<void>;
}

export function usePassenger<T>(path: string, base = "/mobile/passenger"): Remote<T> {
  const { version } = useApp();
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const key = `pax:${base}/${path}`;

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const fresh = await api<T>(`${base}/${path}`);
      setData(fresh);
      setStale(false);
      setError(null);
      await setState(key, JSON.stringify(fresh));
    } catch (failure) {
      const cached = await getState(key);
      if (cached) {
        setData(JSON.parse(cached) as T);
        setStale(true);
      }
      setError(failure instanceof ApiRequestError ? failure.message : "No pudimos cargar la información.");
    } finally {
      setLoading(false);
    }
  }, [path, base, key]);

  useEffect(() => {
    void reload();
  }, [reload, version]);

  return { data, loading, error, stale, reload };
}

export function contactName(value: PaxService["guide"]): string | null {
  if (!value) return null;
  return typeof value === "string" ? value : value.name;
}

export async function openDocument(id: string): Promise<void> {
  const document = await api<{ url: string | null }>(`/mobile/passenger/documents/${encodeURIComponent(id)}/download`);
  if (!document.url) throw new ApiRequestError({ status: 409, message: "El documento todavía no está disponible." });
  await Linking.openURL(document.url);
}
