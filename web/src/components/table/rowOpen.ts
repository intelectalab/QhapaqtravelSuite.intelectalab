import type { MouseEvent } from "react";

const INTERACTIVE = "a, button, input, select, textarea, label, summary, [role='button'], [role='checkbox'], [role='menuitem'], [data-row-ignore]";

const OPENER = "[data-row-open], [data-row-title] a[href]";

const VIEW_LABEL = /^(ver|vista)\b/i;

export const ROWS_OPEN = "rows-open";

export const opensRow = (tone: string, label: string) => tone === "view" && VIEW_LABEL.test(label.trim());

function rowOpener(row: HTMLElement): HTMLElement | null {
  return row.querySelector<HTMLElement>(OPENER) ?? row.querySelector<HTMLElement>(":scope > td:first-child a[href]");
}

export function openRow(event: MouseEvent<HTMLElement>) {
  if (event.button !== 0 || event.defaultPrevented) return;
  const target = event.target as HTMLElement | null;
  const container = event.currentTarget;
  if (!target || !container.contains(target) || target.closest(INTERACTIVE)) return;
  if (window.getSelection()?.toString()) return;
  let row: HTMLElement | null = target;
  while (row && row.parentElement !== container) row = row.parentElement;
  if (!row) return;
  const opener = rowOpener(row);
  if (!opener) return;
  if (opener instanceof HTMLAnchorElement && (event.metaKey || event.ctrlKey)) {
    window.open(opener.href, "_blank", "noopener");
    return;
  }
  opener.click();
}
