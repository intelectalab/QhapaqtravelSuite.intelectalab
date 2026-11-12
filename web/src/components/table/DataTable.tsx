"use client";

import { Check, Minus, SearchX, Table2, X, type LucideIcon } from "lucide-react";
import { useMemo, useRef, useState, type ReactNode } from "react";
import { EmptyState } from "@/components/ui/EmptyState";
import { MetricCard, MetricCardRow } from "@/components/ui/MetricCard";
import { Select } from "@/components/ui/Select";
import { cn } from "@/lib/cn";
import type { CsvExport } from "@/lib/csv";
import { titleFromSlug } from "@/lib/export";
import { useStoredValue } from "@/lib/useStoredValue";
import { ExportMenu } from "./ExportMenu";
import { Pager } from "./Pager";
import { openRow, ROWS_OPEN } from "./rowOpen";
import { applyQuery, countActiveFilters, LONG_PAGE, parseRows, SORT_DIRECTIONS, type TableQuery } from "./query";
import { Chip, DrawerBar, FilterIcon, SearchBox, SortIcon, ToggleButton } from "./Toolbar";
import type { Column, FilterConfig, MetricFilter, SortOption } from "./types";

interface DataTableProps<T> {
  screen: string;
  rows: T[];
  columns: Column<T>[];
  getKey: (row: T) => string;
  entityLabel: string;
  searchText?: (row: T) => string;
  initialSearch?: string;
  searchPlaceholder?: string;
  metrics?: MetricFilter<T>[];
  filters?: FilterConfig<T>[];
  sorts?: SortOption<T>[];
  selectionActions?: (selected: T[], clear: () => void) => ReactNode;
  toolbarEnd?: ReactNode;
  emptyTitle?: string;
  csv?: CsvExport<T>;
  footer?: Record<string, ReactNode>;
  views?: TableView<T>[];
  defaultView?: string;
}

export interface TableView<T> {
  id: string;
  label: string;
  icon: LucideIcon;
  render: (rows: T[]) => ReactNode;
}

const DEFAULT_VIEW = "predeterminada";

const parseView = (raw: string | null): string => raw ?? DEFAULT_VIEW;

const EMPTY_QUERY: TableQuery = { search: "", metric: "", filters: {}, sortId: "", sortDir: "asc" };

export function DataTable<T>({
  screen,
  rows,
  columns,
  getKey,
  entityLabel,
  searchText,
  initialSearch,
  searchPlaceholder,
  metrics = [],
  filters = [],
  sorts = [],
  selectionActions,
  toolbarEnd,
  emptyTitle = "No hay coincidencias",
  csv,
  footer,
  views = [],
  defaultView = "",
}: DataTableProps<T>) {
  const [storedView, setView] = useStoredValue(`table-view:${screen}`, parseView, String);
  const view = views.find((option) => option.id === (storedView === DEFAULT_VIEW ? defaultView : storedView)) ?? null;
  const [query, setQuery] = useState<TableQuery>(() => ({ ...EMPTY_QUERY, search: initialSearch ?? "" }));
  const [open, setOpen] = useState<"filters" | "sort" | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useStoredValue(`table-rows:${screen}`, parseRows, String);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const card = useRef<HTMLDivElement>(null);

  const update = (patch: Partial<TableQuery>) => {
    setQuery((current) => ({ ...current, ...patch }));
    setPage(1);
  };

  const visible = useMemo(() => applyQuery(rows, query, { searchText, filters, metrics, sorts }), [rows, query, searchText, filters, metrics, sorts]);
  const pages = Math.max(1, Math.ceil(visible.length / pageSize));
  const currentPage = Math.min(page, pages);
  const pageRows = visible.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const activeFilters = countActiveFilters(query.filters);
  const activeSort = sorts.find((sort) => sort.id === query.sortId);
  const selectedRows = visible.filter((row) => selected.has(getKey(row)));
  const allSelected = visible.length > 0 && selectedRows.length === visible.length;

  const toggleRow = (key: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(visible.map(getKey)));
  const clearSelection = () => setSelected(new Set());
  const chooseRows = (value: number) => {
    setPageSize(value);
    setPage(1);
  };
  const goPage = (next: number) => {
    setPage(next);
    const box = card.current;
    if (box && box.getBoundingClientRect().top < 0) box.scrollIntoView({ block: "start", behavior: "smooth" });
  };
  const chooseSort = (id: string) => {
    const option = sorts.find((sort) => sort.id === id);
    update({ sortId: id, sortDir: option ? SORT_DIRECTIONS[option.type ?? "text"].first : "asc" });
  };
  const titleColumn = columns.find((column) => column.mobile === "title") ?? columns[0];
  const detailColumns = columns.filter((column) => column !== titleColumn && column.mobile !== "hidden");
  const selectable = Boolean(selectionActions);
  const describeFilters = (): string[] => {
    const metric = metrics.find((item) => item.id === query.metric);
    const chosen = filters.flatMap((filter) => {
      const value = query.filters[filter.id];
      if (!value) return [];
      return [`${filter.label}: ${filter.options.find((option) => option.value === value)?.label ?? value}`];
    });
    return [
      ...(metric ? [`Tarjeta: ${metric.label}`] : []),
      ...(query.search.trim() ? [`Búsqueda: "${query.search.trim()}"`] : []),
      ...chosen,
      ...(activeSort ? [`Orden: ${activeSort.label} (${SORT_DIRECTIONS[activeSort.type ?? "text"][query.sortDir]})`] : []),
    ];
  };

  return (
    <div>
      {metrics.length > 0 && (
        <MetricCardRow>
          {[{ id: "", label: "Todos", tone: "t1" as const, icon: undefined, matches: () => true }, ...metrics].map((metric) => (
            <MetricCard
              key={metric.id || "all"}
              label={metric.label}
              icon={metric.icon}
              tone={metric.tone}
              value={rows.filter(metric.matches).length}
              active={query.metric === metric.id}
              onClick={() => update({ metric: query.metric === metric.id ? "" : metric.id })}
              testId={`kpi:${metric.id || "all"}`}
            />
          ))}
        </MetricCardRow>
      )}

      <div ref={card} className="relative scroll-mt-20 rounded-card border border-line bg-surface shadow-card max-md:border-0 max-md:bg-transparent max-md:shadow-none">
        <div className="sticky top-16 z-20 flex items-center gap-2 rounded-t-card border-b border-line bg-surface/95 px-3.5 py-3 backdrop-blur-md max-md:border-0 max-md:bg-bg/95 max-md:px-0">
          <SearchBox value={query.search} onChange={(search) => update({ search })} placeholder={searchPlaceholder} />
          {visible.length > 0 && !view && <Pager placement="top" page={currentPage} pages={pages} total={visible.length} rows={pageSize} onPage={goPage} onRows={chooseRows} entityLabel={entityLabel} />}
          <div className="ml-auto flex flex-none items-center gap-2">
            {toolbarEnd && <div className="hidden items-center gap-2 md:flex">{toolbarEnd}</div>}
            {filters.length > 0 && (
              <ToggleButton active={open === "filters"} onClick={() => setOpen(open === "filters" ? null : "filters")} icon={FilterIcon} label="Filtro" badge={activeFilters} collapseLabel />
            )}
            {csv && <ExportMenu title={csv.title ?? titleFromSlug(csv.fileName)} screen={screen} columns={csv.columns} filtered={visible} selected={selectedRows} filters={describeFilters()} />}
            {sorts.length > 0 && (
              <ToggleButton
                active={open === "sort"}
                onClick={() => setOpen(open === "sort" ? null : "sort")}
                icon={SortIcon}
                label={activeSort ? `Orden: ${activeSort.label}` : "Ordenar por"}
                collapseLabel
              />
            )}
            {views.length > 0 && (
              <span className="inline-flex h-9 flex-none items-center rounded-[10px] border border-line bg-surface p-0.5" role="group" aria-label="Vista">
                {[{ id: "", label: "Tabla", icon: Table2 }, ...views].map((option) => {
                  const active = (view?.id ?? "") === option.id;
                  return (
                    <button
                      key={option.id || "table"}
                      type="button"
                      onClick={() => setView(option.id)}
                      title={option.label}
                      aria-label={option.label}
                      aria-pressed={active}
                      data-testid={`table-view-switch:${option.id || "table"}`}
                      className={cn("grid h-7 w-8 place-items-center rounded-[8px] transition", active ? "bg-fg text-surface" : "text-fg-2 hover:text-fg")}
                    >
                      <option.icon size={15} />
                    </button>
                  );
                })}
              </span>
            )}
          </div>
        </div>

        {open === "filters" && (
          <DrawerBar
            label="Filtrar por:"
            onClose={() => setOpen(null)}
            actions={
              activeFilters > 0 && (
                <button type="button" onClick={() => update({ filters: {} })} className="inline-flex h-7 items-center gap-1 rounded-lg px-2 text-[12.5px] font-semibold text-accent hover:bg-surface">
                  <X size={13} />
                  Limpiar filtros
                </button>
              )
            }
          >
            {filters.map((filter) => (
              <Chip key={filter.id} label={filter.label} active={Boolean(query.filters[filter.id])}>
                <Select
                  variant="chip"
                  placeholder="Todos"
                  ariaLabel={filter.label}
                  value={query.filters[filter.id] ?? ""}
                  onChange={(value) => update({ filters: { ...query.filters, [filter.id]: value } })}
                  options={filter.options}
                  testId={`filter:${filter.id}`}
                />
              </Chip>
            ))}
          </DrawerBar>
        )}

        {open === "sort" && (
          <DrawerBar label="Ordenar por:" onClose={() => setOpen(null)}>
            {sorts.map((sort) => (
              <button
                key={sort.id}
                type="button"
                onClick={() => chooseSort(sort.id)}
                className={cn("h-8 rounded-[9px] border px-3 text-[13px] font-medium", query.sortId === sort.id ? "border-accent bg-accent/10 text-accent" : "border-line bg-surface text-fg-2 hover:text-fg")}
              >
                {sort.label}
              </button>
            ))}
            {activeSort && (
              <span className="ml-1 inline-flex rounded-[9px] bg-surface p-0.5">
                {(["asc", "desc"] as const).map((direction) => (
                  <button
                    key={direction}
                    type="button"
                    onClick={() => update({ sortDir: direction })}
                    className={cn("h-7 rounded-[7px] px-2.5 text-[12.5px] font-semibold", query.sortDir === direction ? "bg-fg text-surface" : "text-fg-2")}
                  >
                    {SORT_DIRECTIONS[activeSort.type ?? "text"][direction]}
                  </button>
                ))}
              </span>
            )}
          </DrawerBar>
        )}

        {view && visible.length > 0 ? (
          <div className="p-3.5 max-md:px-0" data-testid={`table-view:${view.id}`}>{view.render(visible)}</div>
        ) : visible.length === 0 ? (
          <div data-testid="table-empty">
            <EmptyState icon={<SearchX size={22} />} title={emptyTitle} description="Prueba con otra búsqueda o quita algún filtro." />
          </div>
        ) : (
          <>
            <div className="scroll-thin overflow-x-auto max-md:hidden">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    {selectable && (
                      <th className="w-11 border-b border-line px-3.5 py-2.5">
                        <CheckBox state={allSelected ? "on" : selectedRows.length ? "some" : "off"} onClick={toggleAll} label="Seleccionar todo" />
                      </th>
                    )}
                    {columns.map((column) => (
                      <th key={column.id} className={cn("whitespace-nowrap border-b border-line px-3 py-2.5 text-left text-xs font-medium text-fg-3", column.align === "right" && "text-right", column.wideOnly && "max-[1600px]:hidden")}>
                        {column.header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className={ROWS_OPEN} onClick={openRow}>
                  {pageRows.map((row) => {
                    const key = getKey(row);
                    const isSelected = selected.has(key);
                    return (
                      <tr key={key} data-testid={`table-row:${key}`} className={cn("border-b border-line-2 last:border-0", isSelected && "bg-accent/5")}>
                        {selectable && (
                          <td className="px-3.5 py-2.5">
                            <CheckBox state={isSelected ? "on" : "off"} onClick={() => toggleRow(key)} label="Seleccionar fila" />
                          </td>
                        )}
                        {columns.map((column) => (
                          <td key={column.id} data-row-title={column === titleColumn ? "" : undefined} className={cn("whitespace-nowrap px-3 py-2.5 align-middle", column.align === "right" && "text-right", column.wideOnly && "max-[1600px]:hidden", column.className)}>
                            {column.cell(row)}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
                {footer && (
                  <tfoot>
                    <tr className="border-t-2 border-line bg-surface-2">
                      {selectable && <td />}
                      {columns.map((column) => (
                        <td key={column.id} className={cn("whitespace-nowrap px-3 py-2.5 text-[13px] font-semibold", column.align === "right" && "text-right", column.wideOnly && "max-[1600px]:hidden")}>
                          {footer[column.id] ?? null}
                        </td>
                      ))}
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>

            <ul className={cn(ROWS_OPEN, "flex flex-col gap-2.5 md:hidden")} onClick={openRow}>
              {pageRows.map((row) => (
                <li key={getKey(row)} className="rounded-tile border border-line bg-surface p-3.5">
                  <div className="mb-2.5" data-row-title="">
                    {titleColumn.cell(row)}
                  </div>
                  <dl className="grid grid-cols-2 gap-x-3 gap-y-2 border-t border-line-2 pt-2.5">
                    {detailColumns.map((column) => (
                      <div key={column.id} className="min-w-0">
                        <dt className="text-[12px] text-fg-3">{column.header}</dt>
                        <dd className="truncate text-[13.5px] font-medium">{column.cell(row)}</dd>
                      </div>
                    ))}
                  </dl>
                </li>
              ))}
            </ul>
          </>
        )}

        {!view && (visible.length === 0 || pageRows.length > LONG_PAGE) && <Pager page={currentPage} pages={pages} total={visible.length} rows={pageSize} onPage={goPage} onRows={chooseRows} entityLabel={entityLabel} />}

        {selectionActions && selectedRows.length > 0 && (
          <div className="fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-1 whitespace-nowrap rounded-2xl bg-fg py-2 pl-4 pr-2 text-[13.5px] text-surface shadow-[0_18px_40px_-12px_rgb(22_24_42/0.45)]">
            <b className="mr-2 font-semibold">
              {selectedRows.length} {selectedRows.length === 1 ? "seleccionado" : "seleccionados"}
            </b>
            {selectionActions(selectedRows, clearSelection)}
            <button type="button" onClick={clearSelection} aria-label="Quitar selección" className="grid h-9 w-9 place-items-center rounded-[10px] text-surface/60 hover:bg-surface/10">
              <X size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function CheckBox({ state, onClick, label }: { state: "on" | "off" | "some"; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={state === "some" ? "mixed" : state === "on"}
      aria-label={label}
      onClick={onClick}
      className={cn("grid h-[18px] w-[18px] place-items-center rounded-md border-[1.5px] transition", state === "off" ? "border-fg-3/40 bg-surface" : "border-accent bg-accent text-white")}
    >
      {state === "on" && <Check size={12} strokeWidth={3} />}
      {state === "some" && <Minus size={12} strokeWidth={3} />}
    </button>
  );
}

export function BulkAction({ icon, children, onClick }: { icon: ReactNode; children: ReactNode; onClick?: () => void }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex h-9 items-center gap-2 rounded-[10px] px-3 font-medium text-surface/90 hover:bg-surface/10">
      {icon}
      {children}
    </button>
  );
}
