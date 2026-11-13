import type { CostBreakdown } from "@/lib/catalog";
import { formatMoney } from "@/lib/format";

export function costRange(breakdown: CostBreakdown): string {
  const costs = breakdown.groups.map((group) => Number(group.cost));
  const low = Math.min(...costs);
  const high = Math.max(...costs);
  return low === high ? `${formatMoney(low)} por persona` : `${formatMoney(low)} a ${formatMoney(high)} por persona`;
}

export function costAtMinimum(breakdown: CostBreakdown | null | undefined): string | null {
  return breakdown?.groups[0]?.cost ?? null;
}
