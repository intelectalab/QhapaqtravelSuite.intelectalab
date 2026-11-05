export interface AccessInfo {
  experience: "backoffice" | "portal" | "mobile";
  home: string;
  routes: string[];
  screens: Record<string, boolean>;
}

export function isAllowed(screens: Record<string, boolean> | null, path: string): boolean {
  if (!screens) return true;
  const match = Object.keys(screens)
    .filter((prefix) => path === prefix || path.startsWith(`${prefix}/`))
    .sort((a, b) => b.length - a.length)[0];
  return match === undefined || screens[match];
}
