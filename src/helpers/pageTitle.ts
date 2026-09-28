export const DEFAULT_PAGE_TITLE = "Music Assistant - Your music, Your way";

export function getPageTitle(title?: string, artist?: string): string {
  const normalizedTitle = title?.trim();
  const normalizedArtist = artist?.trim();

  if (!normalizedTitle || !normalizedArtist) return DEFAULT_PAGE_TITLE;

  return `${normalizedTitle} — ${normalizedArtist}`;
}
