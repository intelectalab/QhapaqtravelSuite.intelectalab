const RECENT_MAX = 8;

const recentKey = (userId: string) => `menu.recent.${userId}`;

export function readRecent(userId: string): string[] {
  try {
    const value = JSON.parse(localStorage.getItem(recentKey(userId)) ?? "[]");
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

export function rememberScreen(userId: string, href: string): void {
  try {
    const next = [href, ...readRecent(userId).filter((item) => item !== href)].slice(0, RECENT_MAX);
    localStorage.setItem(recentKey(userId), JSON.stringify(next));
  } catch {}
}
