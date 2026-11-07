import type { components, paths } from "./schema";

export type Schema<K extends keyof components["schemas"]> = components["schemas"][K];

export type ContractPath = keyof paths;

type JsonOf<R> = R extends { content: { "application/json": infer B } } ? B : never;

export type ContractResponse<P extends ContractPath, M extends keyof paths[P], S extends number = 200> = paths[P][M] extends { responses: infer R }
  ? S extends keyof R
    ? JsonOf<R[S]>
    : never
  : never;

export type ApiErrorBody = Schema<"Error"> & Partial<Pick<Schema<"ValidationError">, "errors">>;

export type CursorMeta = Schema<"CursorMeta">;

export type CursorLinks = Schema<"CursorLinks">;

export type BookingReservation = Schema<"BookingReservation">;

export type QuoteQuote = Schema<"QuoteQuote">;

export type ConvertQuoteResponse = ContractResponse<"/api/v1/quotes/{id}/convert", "post", 201>;
