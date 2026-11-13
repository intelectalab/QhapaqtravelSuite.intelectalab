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
  conversion: { lead_to_opportunity: number; opportunity_to_quote?: number | null; opportunity_win: number | null; quote_to_reservation: number | null };
  scope: "own" | "tenant";
}

export type ReportKey = "comercial" | "cotizaciones" | "reservas" | "operaciones" | "finanzas" | "proveedores" | "clientes";

export type ReportValueFormat = "money" | "number" | "percent" | "hours" | "days" | "rating" | "text" | "date" | "datetime" | "status";

export interface ReportKpi {
  key: string;
  label: string;
  value: number | null;
  format: ReportValueFormat;
  hint: string | null;
}

export interface ReportPoint {
  label: string;
  value?: number;
  value2?: number;
  count?: number;
  [key: string]: string | number | undefined;
}

export interface ReportChart {
  key: string;
  title: string;
  type: "bar" | "hbar" | "donut" | "funnel" | "lines" | "pair" | "line";
  format: ReportValueFormat;
  series: ReportPoint[];
  keys?: Record<string, string>;
  labels?: [string, string];
}

export interface ReportColumn {
  key: string;
  label: string;
  format: ReportValueFormat;
  warn_below?: number;
  filter?: boolean;
}

export interface ReportTab {
  key: ReportKey;
  title: string;
}

export interface ReportPayload {
  key: ReportKey;
  title: string;
  filters: { period: string; label: string; from: string | null; to: string; sede: { id: string; name: string } | null };
  scope: "own" | "tenant";
  tabs: ReportTab[];
  periods: { key: string; label: string }[];
  sedes: { id: string; name: string }[];
  can_export: boolean;
  variant: "rentabilidad" | "contable" | null;
  kpis: ReportKpi[];
  charts: ReportChart[];
  table: { columns: ReportColumn[]; rows: Record<string, string | number | null>[]; totals: Record<string, string | number | null> | null; link: string | null };
}

export interface ReportExport {
  id: string;
  code: string;
  name: string;
  report: string;
  format: "CSV" | "XLSX" | "PDF";
  rows: number | null;
  size: number | null;
  status: "en_cola" | "procesando" | "disponible" | "fallido" | "expirado";
  scheduled: boolean;
  expires_at: string | null;
  created_at: string;
}

export interface ReportSchedule {
  code: string;
  report: string;
  title: string;
  format: string;
  label: string;
  recipients: string[];
  period: string | null;
  paused: boolean;
  last_run_at: string | null;
  last_status: string | null;
  owner: string | null;
}

export interface ReportExportsData {
  exports: ReportExport[];
  schedules: ReportSchedule[];
  can_export: boolean;
  tabs: ReportTab[];
  periods: { key: string; label: string }[];
  frequencies: { key: string; label: string }[];
}

