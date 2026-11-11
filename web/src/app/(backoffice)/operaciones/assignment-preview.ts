"use server";

import type { AssignmentPreview } from "@/lib/operations";
import { apiFetch } from "@/lib/server/api";

export async function previewAssignment(assignment: string, resources: { guide_id: string; driver_id: string; vehicle_id: string }): Promise<AssignmentPreview | null> {
  const body = Object.fromEntries(Object.entries(resources).map(([key, value]) => [key, value === "" ? null : value]));
  const result = await apiFetch<AssignmentPreview>(`/ops/assignments/${encodeURIComponent(assignment)}/validate`, { method: "POST", body });
  return result.ok && result.data ? result.data : null;
}
