export interface AccessInfo {
  experience: "backoffice" | "portal" | "mobile";
  home: string;
  routes: string[];
  screens: Record<string, boolean>;
  required?: Record<string, string[]>;
  locked?: Record<string, LockedFeature | null>;
}

function longestPrefix(keys: string[], path: string): string | undefined {
  return keys.filter((prefix) => path === prefix || path.startsWith(`${prefix}/`)).sort((a, b) => b.length - a.length)[0];
}

export function requiredPermissions(required: Record<string, string[]> | null | undefined, path: string): string[] {
  if (!required) return [];
  const match = longestPrefix(Object.keys(required), path);
  return match === undefined ? [] : required[match];
}

export interface LockedFeature {
  feature: string;
  label: string;
}

export function lockedFeature(locked: Record<string, LockedFeature | null> | null | undefined, path: string): LockedFeature | null {
  if (!locked) return null;
  const match = longestPrefix(Object.keys(locked), path);
  return match === undefined ? null : (locked[match] ?? null);
}

export function isAllowed(screens: Record<string, boolean> | null, path: string): boolean {
  if (!screens) return true;
  const match = longestPrefix(Object.keys(screens), path);
  return match === undefined || screens[match];
}
