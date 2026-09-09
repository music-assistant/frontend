import type { GuestSessionKind } from "./guest_session";

/**
 * AI Radio prefetches require the full account scope, not a session-scoped
 * guest token. Keep this policy independent from the composables so it can be
 * tested without importing the API/auth dependency graph.
 */
export function shouldPrefetchAiRadio(
  available: boolean,
  guestSessionKind: GuestSessionKind | null,
): boolean {
  return available && guestSessionKind === null;
}
