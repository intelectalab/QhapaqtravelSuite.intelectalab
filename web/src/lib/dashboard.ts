import type { NavCountKey } from "@/config/navigation";

export type PanelName = "executive" | "manager" | "sales" | "operations" | "finance" | "accounting" | "general";

export interface MonthPoint {
  key: string;
  label: string;
  sales: number;
  cost: number;
  margin: number | null;
  reservations: number;
  leads: number;
  quotes: number;
}

export interface SalesKpis {
  sales: { value: number; previous: number; previous_label: string | null };
  margin: { value: number | null; previous: number | null };
}

export interface ServiceRow {
  id: string;
  date: string;
  time: string | null;
  name: string;
  provider: string | null;
  reservation: string;
  pax: number;
  status: string;
}

export interface DepartureRow {
  ref: string;
  product: string;
  date: string;
  time: string | null;
  capacity: number;
  sold: number;
  guide: string | null;
}

export interface IncidentRow {
  code: string;
  title: string;
  type: string;
  severity: string;
  status: string;
  reservation: string | null;
}

export interface ActivityRow {
  code: string;
  type: string;
  subject: string;
  due_at: string | null;
  status: string;
  owner: string | null;
}

export interface QuoteRow {
  code: string;
  title: string;
  client: string;
  status: string;
  version: number;
  valid_until: string | null;
  viewed: boolean;
  total: number;
  currency: string;
  margin: number | null;
}

export interface ShareRow {
  label: string;
  sales: number;
  count: number;
}

export interface ExecutiveData {
  today: string;
  month: string;
  kpis: SalesKpis & {
    pipeline: { amount: number; count: number };
    active: { reservations: number; passengers: number };
    receivable: { open: number; overdue: number; overdue_count: number };
  };
  critical: IncidentRow | null;
  months: MonthPoint[];
  funnel: { steps: { key: string; label: string; count: number }[]; conversion: number | null; ticket: number | null; cycle_days: number | null };
  services: ServiceRow[];
  departures: DepartureRow[];
  activities: ActivityRow[];
  quotes: QuoteRow[];
  incidents: IncidentRow[];
  channels: ShareRow[];
  manager?: ManagerData;
}

export interface ManagerData {
  approvals: {
    by_type: { type: string; label: string; count: number }[];
    items: { code: string; type: string; title: string; subject: string | null; amount: number | null; currency: string | null; due_at: string | null; level: string; requester: string | null }[];
  };
  targets: { period: string; count: number; goal_sales: number; sales: number; goal_margin: number; margin: number } | null;
  team: { overdue_activities: number; uncontacted: number; unassigned: number };
  advisors: { name: string; leads: number; pipeline: number; open: number; quotes: number; sold: number; conversion: number | null; margin: number | null; overdue: number }[];
}

export interface SalesData {
  today: string;
  month: string;
  kpis: {
    pipeline: { amount: number; count: number; weighted: number };
    quotes: { open: number; expiring: number };
    activities: { due: number; pending: number };
    conversion: { opportunities: number | null; leads: number | null };
    commission: { amount: number; by_currency: { currency: string; amount: number }[] };
  };
  stages: { code: string; name: string; count: number; amount: number }[];
  closing: { code: string; title: string; stage: string; close: string | null }[];
  activities: { due: ActivityRow[]; next: ActivityRow[] };
  expiring: QuoteRow[];
  leads: { code: string; name: string; destination: string | null; pax: number | null; score: number | null; status: string }[];
  pool: { code: string; name: string; source: string | null; destination: string | null; pax: number | null; lock_version: number }[];
  trips: { code: string; title: string; date: string; status: string; passengers: number }[];
  can: { take: boolean; complete: boolean; quote: boolean };
}

export interface OperationsData {
  today: string;
  kpis: {
    soon: { services: number; pax: number };
    unconfirmed: { services: number; providers: number };
    assignments: { pending: number; within3: number };
    vouchers: { to_issue: number };
    incidents: { open: number; by_severity: { severity: string; count: number }[] };
  };
  critical: IncidentRow | null;
  soon: (ServiceRow & { confirmation: string | null; order: string | null; assignment: { status: string; guide: string | null; driver: string | null; vehicle: string | null } | null })[];
  unconfirmed: { provider: string; total: number; items: { reservation: string; date: string; name: string; status: string }[] }[];
  assignments: { date: string; time: string | null; service: string; order: string; missing: string[] }[];
  vouchers: ServiceRow[];
  incidents: IncidentRow[];
  arrivals: { hotel: string | null; check_in: string; check_out: string; rooms: number; reservation: string; status: string; hotel_confirmed?: boolean }[];
  departures: DepartureRow[];
}

export interface FinanceData {
  today: string;
  month: string;
  kpis: {
    cash: { amount: number; count: number };
    receivable: { open: number; overdue: number; overdue_count: number };
    to_validate: { count: number; amount: number };
    payables: { amount: number; count: number };
    margin: { value: number | null; previous: number | null };
  };
  margins: { code: string; title: string; currency: string; sale: number; cost: number; pct: number }[];
  aging: { label: string; amount: number; count: number }[];
  overdue: { code: string; client: string; due: string; balance: number; currency: string }[];
  to_validate: { code: string; method: string; reservation: string | null; date: string; by: string | null; amount: number; currency: string }[];
  payables: { code: string; provider: string | null; due: string; overdue: boolean; document: string | null; balance: number; currency: string }[];
  commissions: { code: string; beneficiary: string | null; kind: string; reservation: string | null; pct: number; base: number; amount: number; currency: string }[];
  months: MonthPoint[];
  methods: ShareRow[];
}

export interface AccountingData {
  today: string;
  month: string;
  kpis: {
    invoices: { count: number; amount: number };
    observed: { count: number };
    undocumented: { count: number; amount: number };
    receivables: { count: number; amount: number };
  };
  observed: { number: string; detail: string | null }[];
  invoices: { number: string; type: string; client: string; date: string; total: number; currency: string; credit: boolean; status: string }[];
  close: { period: string; label: string; status: string; done: number; total: number; checks: { label: string; ok: boolean; manual: boolean }[] };
  undocumented: { code: string; method: string; reservation: string | null; date: string; amount: number; currency: string }[];
  receivables: { code: string; client: string; concept: string | null; due: string; overdue: boolean; balance: number; currency: string; status: string }[];
}

export type HomePanel =
  | { panel: "executive" | "manager"; data: ExecutiveData }
  | { panel: "sales"; data: SalesData }
  | { panel: "operations"; data: OperationsData }
  | { panel: "finance"; data: FinanceData }
  | { panel: "accounting"; data: AccountingData }
  | { panel: "general"; data: null };

export type NavCounts = Partial<Record<NavCountKey, number>>;
