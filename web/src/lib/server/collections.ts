import "server-only";
import { cache } from "react";
import type { ReceivableRow, ReceivablesOverview } from "@/lib/finance";
import type { OrderList, OrderRow } from "@/lib/operations";
import { getCollection } from "./resource";

export const getReceivablesOverview = cache(async (): Promise<ReceivablesOverview | null> => {
  const list = await getCollection<ReceivableRow, Omit<ReceivablesOverview, "rows">>("/finance/receivables", "No pudimos cargar las cuentas por cobrar.");
  return list && { ...list.meta, rows: list.items };
});

export const getOrderList = cache(async (): Promise<OrderList | null> => {
  const list = await getCollection<OrderRow, Omit<OrderList, "items">>("/ops/orders", "No pudimos cargar las órdenes operativas.");
  return list && { ...list.meta, items: list.items };
});
