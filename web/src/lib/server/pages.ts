import "server-only";
import type { Realm } from "@/lib/realms";
import { apiFetch, type ApiResult } from "./api";

export interface CursorMeta {
  per_page: number;
  next_cursor: string | null;
  prev_cursor: string | null;
}

export interface Collection<T, M> {
  data: T[];
  meta: M & CursorMeta;
  more: boolean;
}

const PAGE_SIZE = 100;

export async function fetchPages<T, M = Record<string, unknown>>(path: string, limit = 500, realm?: Realm): Promise<ApiResult<Collection<T, M>>> {
  const items: T[] = [];
  let meta: (M & CursorMeta) | null = null;
  let cursor: string | null = null;

  do {
    const size = Math.min(PAGE_SIZE, limit - items.length);
    const query = `page[size]=${size}${cursor ? `&page[cursor]=${encodeURIComponent(cursor)}` : ""}`;
    const result: ApiResult<{ data: T[]; meta: M & CursorMeta }> = await apiFetch(`${path}${path.includes("?") ? "&" : "?"}${query}`, { raw: true, realm });
    if (!result.ok || !result.data) return { ...result, data: null };
    items.push(...result.data.data);
    meta ??= result.data.meta;
    cursor = result.data.meta.next_cursor;
  } while (cursor && items.length < limit);

  return { ok: true, status: 200, error: null, data: { data: items, meta: meta as M & CursorMeta, more: cursor !== null } };
}
