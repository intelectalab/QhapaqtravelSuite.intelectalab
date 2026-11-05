import type { ReactNode } from "react";
import type { SelectOption } from "@/components/ui/Select";
import type { Tone } from "@/lib/tone";

export interface Column<T> {
  id: string;
  header: string;
  cell: (row: T) => ReactNode;
  align?: "left" | "right";
  mobile?: "title" | "detail" | "hidden";
  wideOnly?: boolean;
  className?: string;
}

export interface FilterConfig<T> {
  id: string;
  label: string;
  options: SelectOption[];
  value: (row: T) => string | string[];
}

export type SortType = "text" | "number" | "date";

export interface SortOption<T> {
  id: string;
  label: string;
  type?: SortType;
  value: (row: T) => string | number | null | undefined;
}

export interface MetricFilter<T> {
  id: string;
  label: string;
  icon?: ReactNode;
  tone?: Tone;
  matches: (row: T) => boolean;
}

export type SortDirection = "asc" | "desc";
