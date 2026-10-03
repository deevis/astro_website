export const RECENT_GAMES_KEY = 'darrenhicks.recent-games';
export const RECENT_GAMES_LIMIT = 24;

export function pathKey(href: string) {
  const trimmed = href.replace(/\/+$/, '');
  return trimmed || '/';
}

export function loadRecentGameIds(): string[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(RECENT_GAMES_KEY) ?? '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === 'string' && id.length > 0);
  } catch {
    return [];
  }
}

export function rememberGame(id: string) {
  if (!id || typeof localStorage === 'undefined') return;
  const next = [id, ...loadRecentGameIds().filter((entry) => entry !== id)].slice(
    0,
    RECENT_GAMES_LIMIT
  );
  localStorage.setItem(RECENT_GAMES_KEY, JSON.stringify(next));
}

export function matchGameId(
  entries: { id: string; href: string }[],
  pathname: string
): string | undefined {
  const current = pathKey(pathname);
  return entries.find((entry) => pathKey(entry.href) === current)?.id;
}
