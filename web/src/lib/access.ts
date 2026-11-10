export interface AccessInfo {
  experience: "backoffice" | "portal" | "mobile";
  home: string;
  routes: string[];
  screens: Record<string, boolean>;
  locked?: Record<string, LockedFeature>;
}

export interface LockedFeature {
  feature: string;
  label: string;
}

export function lockedFeature(locked: Record<string, LockedFeature> | null | undefined, path: string): LockedFeature | null {
  if (!locked) return null;
  const match = Object.keys(locked)
    .filter((prefix) => path === prefix || path.startsWith(`${prefix}/`))
    .sort((a, b) => b.length - a.length)[0];
  return match === undefined ? null : locked[match];
}

export function isAllowed(screens: Record<string, boolean> | null, path: string): boolean {
  if (!screens) return true;
  const match = Object.keys(screens)
    .filter((prefix) => path === prefix || path.startsWith(`${prefix}/`))
    .sort((a, b) => b.length - a.length)[0];
  return match === undefined || screens[match];
}
