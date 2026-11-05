import type { NavCountKey } from "@/config/navigation";

export type AttentionKind = "incident" | "collection" | "quote";

export interface HomeDashboard {
  today: string;
  kpis: {
    sales: number;
    sales_previous: number;
    previous_month: string | null;
    margin: number | null;
    margin_previous: number | null;
    receivable: number;
    overdue: number;
    active_reservations: number;
    passengers: number;
  };
  months: { key: string; label: string; sales: number; cost: number; margin: number | null }[];
  attention: { kind: AttentionKind; title: string; detail: string; action: string; href: string; amount?: number }[];
  departures: { code: string; title: string; date: string; status: string; passengers: number }[];
}

export type NavCounts = Partial<Record<NavCountKey, number>>;
