export interface ReportMonth {
  key: string;
  label: string;
  sales: number;
  cost: number;
  margin_pct: number | null;
  reservations: number;
  leads: number;
  quotes: number;
}

export interface Breakdown {
  label: string;
  sales: number;
  count: number;
}

export interface KpiOverview {
  today: string;
  scope: "own" | "tenant";
  kpis: {
    sales: number;
    sales_previous: number;
    sales_period: number;
    margin_pct: number | null;
    reservations: number;
    ticket: number | null;
    lead_conversion: number | null;
    quote_win_rate: number | null;
    receivable_open: number;
    receivable_overdue: number;
    collected_period: number;
    collection_rate: number | null;
  };
  months: ReportMonth[];
  leads: { total: number; converted: number; rate: number | null; by_status: { status: string; count: number }[] };
  quotes: { total: number; open: number; won: number; win_rate: number | null; pipeline_pen: number; avg_margin: number | null; by_status: { status: string; count: number }[] };
  collection: { open: number; overdue: number; overdue_count: number; collected: number; billed: number; rate: number | null; aging: { label: string; amount: number; count: number }[] };
  channels: Breakdown[];
  advisors: Breakdown[];
}

export interface FlowStage {
  id: string;
  title: string;
  description: string;
  href: string;
  value: number;
  value_label: string;
  amount?: number;
  facts: { label: string; value: number }[];
  alert: string | null;
}

export interface ProcessMapData {
  stages: FlowStage[];
  conversion: { lead_to_opportunity: number; opportunity_win: number | null; quote_to_reservation: number | null };
  scope: "own" | "tenant";
}
