import type { ApiResult } from "@/lib/server/api";

export interface WizardFailure {
  message: string;
  step: number | null;
  fields: Record<string, string>;
}

export type WizardResult<T> = { ok: true; data: T } | { ok: false; error: WizardFailure };

const firstMessage = (value: unknown): string | null => (Array.isArray(value) && typeof value[0] === "string" ? value[0] : null);

export const stepByField =
  (steps: Record<string, number>, fallback: number) =>
  (field: string): number =>
    steps[field.split(".")[0]] ?? fallback;

export function wizardFailure(result: ApiResult<unknown>, fallback: string, stepOf: (field: string) => number): { ok: false; error: WizardFailure } {
  const details: Record<string, unknown> = result.error?.details ?? {};
  const fields: Record<string, string> = {};
  for (const [field, messages] of Object.entries(result.error?.errors ?? {})) {
    const message = firstMessage(messages);
    if (message) fields[field] = message;
  }
  const validation = Object.keys(fields)[0];
  for (const [field, messages] of Object.entries(details)) {
    const message = firstMessage(messages);
    if (message && !(field in fields)) fields[field] = message;
  }
  const message = (validation ? fields[validation] : null) ?? result.error?.message ?? fallback;
  const detailField = typeof details.field === "string" ? details.field : null;
  if (detailField) fields[detailField] = message;
  const detailStep = typeof details.step === "number" ? details.step : null;
  const field = detailField ?? Object.keys(fields)[0];
  return { ok: false, error: { message, step: detailStep ?? (field ? stepOf(field) : null), fields } };
}
