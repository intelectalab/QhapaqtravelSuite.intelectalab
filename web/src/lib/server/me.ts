import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import type { Me } from "@/lib/me";
import { apiFetch } from "./api";

export const currentUser = cache(async (): Promise<Me> => {
  const result = await apiFetch<Me>("/me");
  if (result.status === 403 && result.error?.code === "MFA_REQUIRED") redirect("/mfa");
  if (!result.ok || !result.data) redirect("/salir");
  return result.data;
});
