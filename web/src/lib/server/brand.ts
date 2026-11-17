import "server-only";
import { cache } from "react";
import { DEFAULT_LOGO, isLogoMark, type LogoMark } from "@/lib/brand";
import { apiFetch } from "./api";

export const currentLogo = cache(async (): Promise<LogoMark> => {
  try {
    const result = await apiFetch<{ logo: string }>("/public/software/brand", { auth: false });
    return result.ok && isLogoMark(result.data?.logo) ? result.data.logo : DEFAULT_LOGO;
  } catch {
    return DEFAULT_LOGO;
  }
});
