import { normalize } from "@/lib/format";
import type { FilterConfig, MetricFilter, SortDirection, SortOption, SortType } from "./types";

export const ROW_OPTIONS = [8, 16, 25, 50, 100, 500];

export const MAX_ROWS = 1000;

export const LONG_PAGE = 12;
export const DEFAULT_ROWS = 8;

export const SORT_DIRECTIONS: Record<SortType, { first: SortDirection; asc: string; desc: string }> = {
  text: { first: "asc", asc: "A → Z", desc: "Z → A" },
  number: { first: "desc", asc: "Menor primero", desc: "Mayor primero" },
  date: { first: "desc", asc: "Más antiguo", desc: "Más reciente" },
};

export interface TableQuery {
  search: string;
  metric: string;
  filters: Record<string, string>;
  sortId: string;
  sortDir: SortDirection;
}

function matchesFilters<T>(row: T, filters: FilterConfig<T>[], values: Record<string, string>): boolean {
  return filters.every((filter) => {
    const wanted = values[filter.id];
    if (!wanted) return true;
    const actual = filter.value(row);
    return Array.isArray(actual) ? actual.includes(wanted) : actual === wanted;
  });
}

const isEmpty = (value: unknown) => value === null || value === undefined || value === "";

function compare(a: string | number | null | undefined, b: string | number | null | undefined, type: SortType): number {
  if (isEmpty(a) || isEmpty(b)) return isEmpty(a) === isEmpty(b) ? 0 : isEmpty(a) ? 1 : -1;
  if (type === "number") return Number(a) - Number(b);
  if (type === "date") return new Date(String(a)).getTime() - new Date(String(b)).getTime();
  return String(a).localeCompare(String(b), "es", { sensitivity: "base", numeric: true });
}

export function applyQuery<T>(
  rows: T[],
  query: TableQuery,
  config: { searchText?: (row: T) => string; filters: FilterConfig<T>[]; metrics: MetricFilter<T>[]; sorts: SortOption<T>[] },
): T[] {
  const term = normalize(query.search.trim());
  const metric = config.metrics.find((item) => item.id === query.metric);
  let result = rows.filter(
    (row) =>
      (!term || !config.searchText || normalize(config.searchText(row)).includes(term)) &&
      (!metric || metric.matches(row)) &&
      matchesFilters(row, config.filters, query.filters),
  );
  const sort = config.sorts.find((item) => item.id === query.sortId);
  if (sort) {
    const factor = query.sortDir === "asc" ? 1 : -1;
    result = [...result].sort((a, b) => compare(sort.value(a), sort.value(b), sort.type ?? "text") * factor);
  }
  return result;
}

export function countActiveFilters(values: Record<string, string>): number {
  return Object.values(values).filter(Boolean).length;
}

export function parseRows(raw: string | null): number {
  const saved = Number(raw);
  return Number.isInteger(saved) && saved >= 1 && saved <= MAX_ROWS ? saved : DEFAULT_ROWS;
}
