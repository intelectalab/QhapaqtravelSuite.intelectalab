import { Platform } from "react-native";
import { APP_VERSION } from "../config";

export const UPGRADE_STATUS = 426;

export interface UpgradeInfo {
  message: string;
  minVersion: string | null;
  storeUrl: string | null;
}

type Listener = (info: UpgradeInfo) => void;

const listeners = new Set<Listener>();

export function appHeaders(): Record<string, string> {
  return { "X-App-Version": APP_VERSION, "X-App-Platform": Platform.OS === "ios" ? "ios" : "android" };
}

export function isUpgradeRequired(status: number): boolean {
  return status === UPGRADE_STATUS;
}

export function upgradeFrom(payload: { message?: string; details?: { min_version?: string | null; store_url?: string | null } }): UpgradeInfo {
  return {
    message: payload.message ?? "Hay una versión nueva de la app. Actualízala para seguir usándola.",
    minVersion: payload.details?.min_version ?? null,
    storeUrl: payload.details?.store_url ?? null,
  };
}

export function reportUpgrade(info: UpgradeInfo): void {
  for (const listener of listeners) listener(info);
}

export function onUpgradeRequired(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
